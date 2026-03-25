export function startOnlinePresence(ctx) {
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
    if (!ctx.user || !ctx.supabase || ctx.user.id === 'adm-bypass') return;

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
        const onlineCount = friends.filter(f => isOnlineNow(f.last_seen)).length;
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
    return (now - lastSeenDate) < 120000;
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

    return data.map(f => ({
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
        const friendIds = friends.map(f => f.id);
        const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();

        const { data: onlinePlayers, error } = await ctx.supabase
            .from('profiles')
            .select('id, nickname, last_seen, selected_avatar, level, current_room')
            .gt('last_seen', twoMinutesAgo)
            .neq('id', ctx.user ? ctx.user.id : 'anonymous')
            .limit(10);

        if (error) throw error;

        const others = onlinePlayers.filter(p => !friendIds.includes(p.id));

        if (others.length === 0) {
            container.innerHTML = '<p class="empty-msg">Nenhum outro jogador online.</p>';
            return;
        }

        container.innerHTML = '';
        others.forEach(player => {
            const isInRoom = player.current_room;
            const div = document.createElement('div');
            div.className = 'friend-item';
            div.innerHTML = `
                    <div class="friend-info">
                        <span class="friend-avatar">${player.selected_avatar || '👤'}</span>
                        <div class="friend-text">
                            <span class="friend-name">${player.nickname}</span>
                            <span class="friend-status online">
                                ${isInRoom ? '🎮 Em Sala' : '● Online'}
                            </span>
                        </div>
                    </div>
                    <div class="friend-actions">
                        ${isInRoom ? `<button class="btn-join-friend" data-id="${player.current_room}" style="background: linear-gradient(135deg, #1e90ff, #7451eb);">Entrar</button>` : ''}
                        <button class="btn-follow-global" data-nick="${player.nickname}">Seguir</button>
                    </div>
                `;

            if (isInRoom) {
                div.querySelector('.btn-join-friend').onclick = () => ctx.joinFriendRoom(player.current_room);
            }
            div.querySelector('.btn-follow-global').onclick = () => {
                document.getElementById('input-search-friend').value = player.nickname;
                ctx.searchAndFollowFriend();
            };

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

    friends.forEach(friend => {
        const isOnline = isOnlineNow(friend.last_seen);
        const isInRoom = isOnline && friend.current_room;
        const div = document.createElement('div');
        div.className = 'friend-item';
        div.innerHTML = `
                <div class="friend-info">
                    <span class="friend-avatar">${friend.avatar}</span>
                    <div class="friend-text">
                        <span class="friend-name">${friend.nickname}</span>
                        <span class="friend-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? (isInRoom ? '🎮 Em Sala' : '● Online') : 'Offline'}
                        </span>
                    </div>
                </div>
                <div class="friend-actions">
                    ${isInRoom ? `<button class="btn-join-friend" data-id="${friend.current_room}">Entrar</button>` : ''}
                    ${isOnline && !isInRoom ? `<button class="btn-invite-friend" data-id="${friend.id}">Convidar</button>` : ''}
                    <button class="btn-unfollow" data-id="${friend.id}" title="Deixar de seguir">×</button>
                </div>
            `;

        if (isInRoom) {
            div.querySelector('.btn-join-friend').onclick = () => ctx.joinFriendRoom(friend.current_room);
        } else if (isOnline) {
            div.querySelector('.btn-invite-friend').onclick = () => ctx.inviteFriendToRoom(friend);
        }
        div.querySelector('.btn-unfollow').onclick = () => ctx.unfollowFriend(friend.id);

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
    document.getElementById('input-join-id').value = roomId;
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

export function inviteFriendToRoom(ctx, friend) {
    if (!ctx.isOnline || !ctx.isHost) {
        if (confirm(`Deseja criar uma sala e convidar ${friend.nickname}?`)) {
            ctx.showSetup(true);
            ctx.startCreatingRoom();
            ctx.showFloatingMessage(`Sala criada! Envie o ID ${ctx.myPlayerId} para ele.`, 'info');
        }
    } else {
        ctx.showFloatingMessage(`Convide ${friend.nickname} informando o ID da sala: ${ctx.myPlayerId}`, 'info');
        ctx.copyRoomId();
    }
}
