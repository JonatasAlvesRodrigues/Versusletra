function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeRoomId(value) {
    return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

const FRIEND_INVITE_CHANNEL = 'friend-room-invites';

function buildInviteId() {
    return `invite-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function isValidInvitePayload(payload) {
    return Boolean(
        payload &&
        typeof payload === 'object' &&
        typeof payload.inviteId === 'string' &&
        typeof payload.fromUserId === 'string' &&
        typeof payload.toUserId === 'string'
    );
}

export function startOnlinePresence(ctx) {
    ctx.setupFriendInviteChannel();
    setInterval(() => {
        ctx.updateOnlineStatus();
    }, 30000);

    setInterval(() => {
        if (ctx.screens.friends && ctx.screens.friends.classList.contains('active')) {
            ctx.renderFriendsList();
            ctx.renderGlobalOnlinePlayers();
        }
        ctx.updateOnlineFriendsCount();
    }, 15000);
}

export async function updateOnlineStatus(ctx) {
    if (!ctx.user || !ctx.supabase) return;
    ctx.setupFriendInviteChannel();

    const updateData = { last_seen: new Date().toISOString() };

    if (ctx.isOnline && ctx.isHost && ctx.myPlayerId) {
        updateData.current_room = ctx.myPlayerId;
    } else if (!ctx.isOnline) {
        updateData.current_room = null;
    }

    await ctx.supabase
        .from('profiles')
        .update(updateData)
        .eq('id', ctx.user.id);
}

export async function updateOnlineFriendsCount(ctx) {
    if (!ctx.user || !ctx.supabase) return;

    try {
        const friends = await ctx.getFriends();
        const onlineCount = friends.filter((f) => isOnlineNow(f.last_seen)).length;
        const badge = document.getElementById('online-friends-count');

        if (onlineCount > 0) {
            badge.textContent = onlineCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {
        console.error('Erro ao contar amigos online:', e);
    }
}

export function isOnlineNow(lastSeen) {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    return now - lastSeenDate < 120000;
}

export async function getFriends(ctx) {
    if (!ctx.user || !ctx.supabase) return [];

    const { data, error } = await ctx.supabase
        .from('friends')
        .select('friend_id, profiles!friends_friend_id_fkey(nickname, last_seen, selected_avatar, level, current_room)')
        .eq('user_id', ctx.user.id);

    if (error) {
        console.error('Erro ao buscar amigos:', error);
        return [];
    }

    return data.map((f) => ({
        id: f.friend_id,
        nickname: f.profiles.nickname,
        last_seen: f.profiles.last_seen,
        avatar: f.profiles.selected_avatar || '👤',
        level: f.profiles.level || 1,
        current_room: f.profiles.current_room
    }));
}

export async function renderGlobalOnlinePlayers(ctx) {
    const container = document.getElementById('global-online-list');
    if (!container || !ctx.supabase) return;

    try {
        const friends = await ctx.getFriends();
        const friendIds = friends.map((f) => f.id);
        const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();

        const { data: onlinePlayers, error } = await ctx.supabase
            .from('profiles')
            .select('id, nickname, last_seen, selected_avatar, level, current_room')
            .gt('last_seen', twoMinutesAgo)
            .neq('id', ctx.user ? ctx.user.id : 'anonymous')
            .limit(10);

        if (error) throw error;

        const others = onlinePlayers.filter((p) => !friendIds.includes(p.id));

        if (others.length === 0) {
            container.innerHTML = '<p class="empty-msg">Nenhum outro jogador online.</p>';
            return;
        }

        container.innerHTML = '';
        others.forEach((player) => {
            const isInRoom = player.current_room;
            const safeNickname = escapeHtml(player.nickname);
            const safeAvatar = escapeHtml(player.selected_avatar || '👤');
            const safeRoomId = sanitizeRoomId(player.current_room);
            const div = document.createElement('div');
            div.className = 'friend-item';
            div.innerHTML = `
                    <div class="friend-info">
                        <span class="friend-avatar">${safeAvatar}</span>
                        <div class="friend-text">
                            <span class="friend-name">${safeNickname}</span>
                            <span class="friend-status online">
                                ${isInRoom ? 'Em Sala' : 'Online'}
                            </span>
                        </div>
                    </div>
                    <div class="friend-actions">
                        <button class="btn-view-profile">Perfil</button>
                        ${isInRoom ? `<button class="btn-join-friend" data-id="${safeRoomId}" style="background: linear-gradient(135deg, #1e90ff, #7451eb);">Entrar</button>` : ''}
                        <button class="btn-follow-global">Seguir</button>
                    </div>
                `;

            if (isInRoom) {
                const joinBtn = div.querySelector('.btn-join-friend');
                if (joinBtn) joinBtn.onclick = () => ctx.joinFriendRoom(safeRoomId);
            }
            const followBtn = div.querySelector('.btn-follow-global');
            if (followBtn) {
                followBtn.onclick = () => {
                    document.getElementById('input-search-friend').value = player.nickname;
                    ctx.searchAndFollowFriend();
                };
            }
            const viewProfileBtn = div.querySelector('.btn-view-profile');
            if (viewProfileBtn) {
                viewProfileBtn.onclick = () => ctx.openFriendProfile(player.id);
            }

            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao buscar jogadores globais:', e);
    }
}

export async function searchAndFollowFriend(ctx) {
    if (!ctx.user) return ctx.showFloatingMessage('Faça login para seguir amigos!', 'error');

    const input = document.getElementById('input-search-friend');
    const nickname = input.value.trim();
    if (!nickname) return ctx.showFloatingMessage('Digite um nickname!', 'warning');
    if (nickname.toLowerCase() === ctx.getDisplayName().toLowerCase()) {
        return ctx.showFloatingMessage('Você não pode seguir a si mesmo!', 'warning');
    }

    try {
        const { data: friend, error: findError } = await ctx.supabase
            .from('profiles')
            .select('id, nickname')
            .ilike('nickname', nickname)
            .maybeSingle();

        if (findError || !friend) {
            return ctx.showFloatingMessage('Jogador não encontrado!', 'error');
        }

        const { data: existing } = await ctx.supabase
            .from('friends')
            .select('*')
            .eq('user_id', ctx.user.id)
            .eq('friend_id', friend.id)
            .maybeSingle();

        if (existing) {
            return ctx.showFloatingMessage('Você já segue este jogador!', 'info');
        }

        const { error: followError } = await ctx.supabase
            .from('friends')
            .insert({
                user_id: ctx.user.id,
                friend_id: friend.id
            });

        if (followError) throw followError;

        ctx.showFloatingMessage(`Agora você segue ${friend.nickname}!`, 'success');
        input.value = '';

        const friends = await ctx.getFriends();
        if (friends.length >= 10) {
            ctx.unlockAchievement('socialite', 'Socialite (Seguiu 10+ jogadores)');
        }

        ctx.renderFriendsList();
    } catch (e) {
        console.error('Erro ao seguir amigo:', e);
        ctx.showFloatingMessage('Erro ao seguir amigo.', 'error');
    }
}

export async function renderFriendsList(ctx) {
    const container = document.getElementById('friends-list');
    if (!container) return;

    const friends = await ctx.getFriends();

    if (friends.length === 0) {
        container.innerHTML = `<p class="empty-msg">${ctx.t('no_friends_yet')}</p>`;
        return;
    }

    container.innerHTML = '';
    friends.sort((a, b) => {
        const aOnline = isOnlineNow(a.last_seen);
        const bOnline = isOnlineNow(b.last_seen);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        return a.nickname.localeCompare(b.nickname);
    });

    friends.forEach((friend) => {
        const isOnline = isOnlineNow(friend.last_seen);
        const isInRoom = isOnline && friend.current_room;
        const safeNickname = escapeHtml(friend.nickname);
        const safeAvatar = escapeHtml(friend.avatar);
        const safeRoomId = sanitizeRoomId(friend.current_room);
        const safeFriendId = sanitizeRoomId(friend.id);

        const div = document.createElement('div');
        div.className = 'friend-item';
        div.innerHTML = `
                <div class="friend-info">
                    <span class="friend-avatar">${safeAvatar}</span>
                    <div class="friend-text">
                        <span class="friend-name">${safeNickname}</span>
                        <span class="friend-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? (isInRoom ? 'Em Sala' : 'Online') : 'Offline'}
                        </span>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="btn-view-profile" data-id="${safeFriendId}">Perfil</button>
                    ${isInRoom ? `<button class="btn-join-friend" data-id="${safeRoomId}">Entrar</button>` : ''}
                    ${isOnline && !isInRoom ? `<button class="btn-invite-friend" data-id="${safeFriendId}">Convidar</button>` : ''}
                    <button class="btn-unfollow" data-id="${safeFriendId}" title="Deixar de seguir">×</button>
                </div>
            `;

        if (isInRoom) {
            const joinBtn = div.querySelector('.btn-join-friend');
            if (joinBtn) joinBtn.onclick = () => ctx.joinFriendRoom(safeRoomId);
        } else if (isOnline) {
            const inviteBtn = div.querySelector('.btn-invite-friend');
            if (inviteBtn) inviteBtn.onclick = () => ctx.inviteFriendToRoom(friend);
        }

        const unfollowBtn = div.querySelector('.btn-unfollow');
        if (unfollowBtn) unfollowBtn.onclick = () => ctx.unfollowFriend(friend.id);
        const viewProfileBtn = div.querySelector('.btn-view-profile');
        if (viewProfileBtn) viewProfileBtn.onclick = () => ctx.openFriendProfile(friend.id);

        container.appendChild(div);
    });
}

export function joinFriendRoom(ctx, roomId) {
    if (ctx.isOnline) {
        ctx.showFloatingMessage('Você já está em uma sala!', 'warning');
        return;
    }
    ctx.showSetup(true);
    ctx.startJoiningMode();
    document.getElementById('input-join-id').value = sanitizeRoomId(roomId);
    ctx.joinRoom();
}

export async function joinFriendRoomByNick(ctx, nick) {
    if (ctx.isOnline) {
        ctx.showFloatingMessage('Você já está em uma sala!', 'warning');
        return;
    }
    ctx.showSetup(true);
    ctx.startJoiningMode();
    document.getElementById('input-join-id').value = nick;
    await ctx.joinRoom();
}

export async function unfollowFriend(ctx, friendId) {
    if (!confirm('Deseja deixar de seguir este amigo?')) return;

    const { error } = await ctx.supabase
        .from('friends')
        .delete()
        .eq('user_id', ctx.user.id)
        .eq('friend_id', friendId);

    if (error) {
        ctx.showFloatingMessage('Erro ao deixar de seguir.', 'error');
    } else {
        ctx.renderFriendsList();
    }
}

export function setupFriendInviteChannel(ctx) {
    if (!ctx.supabase || !ctx.user) return;
    if (ctx.friendInviteChannel && ctx.friendInviteUserId === ctx.user.id) return;
    if (ctx.friendInviteChannel && ctx.friendInviteUserId !== ctx.user.id) {
        ctx.supabase.removeChannel(ctx.friendInviteChannel);
        ctx.friendInviteChannel = null;
        ctx.friendInviteReady = false;
    }

    const channel = ctx.supabase.channel(FRIEND_INVITE_CHANNEL, {
        config: { broadcast: { self: false } }
    });
    ctx.friendInviteChannel = channel;
    ctx.friendInviteUserId = ctx.user.id;

    channel.on('broadcast', { event: 'ROOM_INVITE' }, ({ payload }) => {
        if (!isValidInvitePayload(payload)) return;
        if (payload.toUserId !== ctx.user?.id) return;
        if (!payload.roomId || !sanitizeRoomId(payload.roomId)) return;

        const safeNick = ctx.sanitizePlayerName(payload.fromNickname, 'Seu amigo');
        const accepted = confirm(`${safeNick} convidou você para uma sala. Aceitar agora?`);

        if (!accepted) {
            channel.send({
                type: 'broadcast',
                event: 'ROOM_INVITE_DECLINED',
                payload: {
                    inviteId: payload.inviteId,
                    fromUserId: ctx.user.id,
                    fromNickname: ctx.getDisplayName(),
                    toUserId: payload.fromUserId
                }
            });
            return;
        }

        if (ctx.isOnline) {
            ctx.showFloatingMessage('Você já está em uma sala. Saia dela para aceitar convites.', 'warning');
            return;
        }

        channel.send({
            type: 'broadcast',
            event: 'ROOM_INVITE_ACCEPTED',
            payload: {
                inviteId: payload.inviteId,
                fromUserId: ctx.user.id,
                fromNickname: ctx.getDisplayName(),
                toUserId: payload.fromUserId
            }
        });

        ctx.joinFriendRoom(payload.roomId);
    });

    channel.on('broadcast', { event: 'ROOM_INVITE_ACCEPTED' }, ({ payload }) => {
        if (!isValidInvitePayload(payload)) return;
        if (payload.toUserId !== ctx.user?.id) return;
        if (!ctx.pendingRoomInvite || ctx.pendingRoomInvite.inviteId !== payload.inviteId) return;

        const safeNick = ctx.sanitizePlayerName(payload.fromNickname, 'Seu amigo');
        ctx.pendingRoomInvite = null;
        ctx.showFloatingMessage(`${safeNick} aceitou seu convite e entrou na sala!`, 'success');
    });

    channel.on('broadcast', { event: 'ROOM_INVITE_DECLINED' }, ({ payload }) => {
        if (!isValidInvitePayload(payload)) return;
        if (payload.toUserId !== ctx.user?.id) return;
        if (!ctx.pendingRoomInvite || ctx.pendingRoomInvite.inviteId !== payload.inviteId) return;

        const safeNick = ctx.sanitizePlayerName(payload.fromNickname, 'Seu amigo');
        ctx.pendingRoomInvite = null;
        ctx.showFloatingMessage(`${safeNick} recusou o convite para a sala.`, 'info');
    });

    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            ctx.friendInviteReady = true;
            if (ctx.pendingRoomInvite && ctx.isHost && ctx.myPlayerId) {
                ctx.sendPendingRoomInvite();
            }
        }
    });
}

export async function sendPendingRoomInvite(ctx) {
    if (!ctx.pendingRoomInvite) return;
    if (!ctx.friendInviteReady || !ctx.friendInviteChannel) return;
    if (!ctx.myPlayerId || !ctx.isHost) return;

    const roomId = sanitizeRoomId(ctx.myPlayerId);
    if (!roomId) return;

    const pending = ctx.pendingRoomInvite;
    ctx.pendingRoomInvite = { ...pending, roomId };

    try {
        await ctx.friendInviteChannel.send({
            type: 'broadcast',
            event: 'ROOM_INVITE',
            payload: {
                inviteId: pending.inviteId,
                fromUserId: ctx.user.id,
                fromNickname: ctx.getDisplayName(),
                fromAvatar: ctx.sanitizeAvatar(ctx.myAvatar),
                toUserId: pending.friendId,
                roomId
            }
        });
    } catch (error) {
        console.error('Erro ao enviar convite pendente:', error);
        ctx.showFloatingMessage('Nao foi possivel enviar o convite automatico.', 'error');
        return;
    }

    const safeNick = ctx.sanitizePlayerName(pending.friendNickname, 'seu amigo');
    ctx.showFloatingMessage(`Convite enviado para ${safeNick}. Aguardando aceite...`, 'info');
}

export async function inviteFriendToRoom(ctx, friend) {
    try {
        if (!ctx.user || !ctx.supabase) {
            ctx.showFloatingMessage('Faça login para usar convites de sala.', 'warning');
            return;
        }
        if (!friend?.id) return;
        if (!isOnlineNow(friend.last_seen)) {
            ctx.showFloatingMessage('Esse amigo não está online no momento.', 'warning');
            return;
        }

        ctx.setupFriendInviteChannel();
        if (!ctx.friendInviteReady || !ctx.friendInviteChannel) {
            ctx.showFloatingMessage('Conexão de convites não pronta. Tente novamente em alguns segundos.', 'warning');
            return;
        }

        if (ctx.pendingRoomInvite) {
            ctx.showFloatingMessage('Você já tem um convite pendente.', 'info');
            return;
        }

        const inviteId = buildInviteId();

        if (!ctx.isOnline || !ctx.isHost) {
            const shouldCreate = confirm(`Criar uma sala agora e convidar ${friend.nickname}?`);
            if (!shouldCreate) return;

            ctx.pendingRoomInvite = {
                inviteId,
                friendId: friend.id,
                friendNickname: friend.nickname,
                roomId: null
            };

            ctx.showSetup(true);
            ctx.startCreatingRoom();
            ctx.showFloatingMessage('Criando sala para enviar convite automático...', 'info');
            return;
        }

        const roomId = sanitizeRoomId(ctx.myPlayerId);
        if (!roomId) {
            ctx.showFloatingMessage('A sala ainda não está pronta. Tente novamente.', 'warning');
            return;
        }

        ctx.pendingRoomInvite = {
            inviteId,
            friendId: friend.id,
            friendNickname: friend.nickname,
            roomId
        };

        await ctx.friendInviteChannel.send({
            type: 'broadcast',
            event: 'ROOM_INVITE',
            payload: {
                inviteId,
                fromUserId: ctx.user.id,
                fromNickname: ctx.getDisplayName(),
                fromAvatar: ctx.sanitizeAvatar(ctx.myAvatar),
                toUserId: friend.id,
                roomId
            }
        });
        ctx.showFloatingMessage(`Convite enviado para ${friend.nickname}.`, 'success');
    } catch (error) {
        console.error('Erro ao convidar amigo para sala:', error);
        ctx.pendingRoomInvite = null;
        ctx.showFloatingMessage('Nao foi possivel enviar o convite agora.', 'error');
    }
}

