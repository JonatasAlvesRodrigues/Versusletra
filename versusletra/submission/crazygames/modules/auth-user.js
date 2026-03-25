function toBooleanFlag(value) {
    if (value === true) return true;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return ['1', 'true', 'yes', 'sim', 'admin'].includes(normalized);
    }
    return false;
}

function resolveAdminFromUser(user) {
    if (!user) return false;

    const app = user.app_metadata || {};
    const meta = user.user_metadata || {};

    return (
        toBooleanFlag(user.is_admin) ||
        toBooleanFlag(app.is_admin) ||
        toBooleanFlag(app.admin) ||
        toBooleanFlag(meta.is_admin) ||
        toBooleanFlag(meta.admin) ||
        String(app.role || '').toLowerCase() === 'admin' ||
        String(meta.role || '').toLowerCase() === 'admin'
    );
}

export async function checkSession(ctx) {
    if (!ctx.supabase) return;

    try {
        const { data: { session } } = await ctx.supabase.auth.getSession();
        const lastScreen = localStorage.getItem('versus-letra-last-screen') || 'home';

        if (session) {
            ctx.user = session.user;
            ctx.user.is_admin = resolveAdminFromUser(ctx.user);
            ctx.isGuest = false;
            if (['login', 'signup'].includes(lastScreen)) {
                ctx.showScreen('home');
            } else {
                ctx.showScreen(lastScreen);
            }
            ctx.updateUIForUser();
            await ctx.loadUserData();
            ctx.updateUIForUser();
        } else if (ctx.isGuest) {
            ctx.updateUIForUser();
            if (['login', 'signup'].includes(lastScreen)) {
                ctx.showScreen('home');
            } else {
                ctx.showScreen(lastScreen);
            }
        } else {
            if (ctx.crazyBridge?.isCrazyGames) {
                ctx.playAsGuest();
                ctx.startCrazyGamesOnboarding();
            } else {
                ctx.showScreen('login');
            }
        }
    } catch (e) {
        console.error('Session check error:', e);
        if (ctx.crazyBridge?.isCrazyGames) {
            ctx.playAsGuest();
            ctx.startCrazyGamesOnboarding();
        } else {
            ctx.showScreen('login');
        }
    }
}

export async function signup(ctx) {
    try {
        const rawNick = document.getElementById('signup-nick').value.trim();
        const nick = typeof ctx.sanitizePlayerName === 'function' ? ctx.sanitizePlayerName(rawNick, '') : rawNick;
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;

        if (!nick || !email || !password) return ctx.showFloatingMessage('Preencha todos os campos!', 'warning');
        if (password.length < 6) return ctx.showFloatingMessage('A senha deve ter pelo menos 6 caracteres!', 'warning');

        const { data: existingNick } = await ctx.supabase
            .from('profiles')
            .select('nickname')
            .ilike('nickname', nick)
            .maybeSingle();

        if (existingNick) {
            return ctx.showFloatingMessage('Este nickname já está em uso. Escolha outro!', 'error');
        }

        const { data, error } = await ctx.supabase.auth.signUp({
            email,
            password,
            options: {
                data: { nickname: nick }
            }
        });

        if (error) {
            if (error.message.includes('User already registered')) {
                return ctx.showFloatingMessage('Este e-mail já está cadastrado. Tente fazer login!', 'error');
            }
            return ctx.showFloatingMessage('Erro ao criar conta: ' + error.message, 'error');
        }

        if (data.user) {
            const { error: profileError } = await ctx.supabase.from('profiles').upsert({
                id: data.user.id,
                nickname: nick,
                achievements: { dicionario: false, flash: false, invencivel: 0 }
            });

            if (profileError) console.error('Erro ao criar perfil:', profileError);

            if (data.session) {
                ctx.showFloatingMessage('Conta criada com sucesso!', 'success');
                ctx.user = data.user;
                ctx.user.nickname = nick;
                ctx.isGuest = false;
                ctx.isDataLoaded = true;
                ctx.updateUIForUser();
                ctx.showScreen('home');
            } else {
                ctx.showFloatingMessage('Verifique seu e-mail para confirmar a conta!', 'info');
                ctx.showScreen('login');
            }
        }
    } catch (e) {
        console.error('Signup error:', e);
        ctx.showFloatingMessage('Ocorreu um erro inesperado no cadastro.', 'error');
    }
}

export async function login(ctx) {
    try {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        if (!email || !password) return ctx.showFloatingMessage('Preencha e-mail e senha!', 'warning');
        const { data, error } = await ctx.supabase.auth.signInWithPassword({ email, password });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                return ctx.showFloatingMessage('E-mail ou senha incorretos.', 'error');
            }
            if (error.message.includes('Email not confirmed')) {
                return ctx.showFloatingMessage('Por favor, confirme seu e-mail antes de entrar.', 'warning');
            }
            return ctx.showFloatingMessage('Erro ao entrar: ' + error.message, 'error');
        }

        if (data.user) {
            ctx.user = data.user;
            ctx.isGuest = false;
            await ctx.loadUserData();
            ctx.updateUIForUser();
            ctx.showScreen('home');
        }
    } catch (e) {
        console.error('Login error:', e);
        ctx.showFloatingMessage('Ocorreu um erro inesperado ao entrar.', 'error');
    }
}

export async function updateNickname(ctx) {
    try {
        if (!ctx.user || !ctx.supabase) return;
        const rawNick = document.getElementById('profile-nick').value.trim();
        const newNick = typeof ctx.sanitizePlayerName === 'function' ? ctx.sanitizePlayerName(rawNick, '') : rawNick;
        if (!newNick) return ctx.showFloatingMessage('O nickname não pode ser vazio!', 'warning');

        const { data: existingNick } = await ctx.supabase
            .from('profiles')
            .select('nickname, id')
            .ilike('nickname', newNick)
            .maybeSingle();

        if (existingNick && existingNick.id !== ctx.user.id) {
            return ctx.showFloatingMessage('Este nickname já está em uso. Escolha outro!', 'error');
        }

        const { error } = await ctx.supabase
            .from('profiles')
            .update({ nickname: newNick })
            .eq('id', ctx.user.id);

        if (error) {
            console.error('Erro ao atualizar nickname:', error);
            ctx.showFloatingMessage('Erro ao atualizar nickname: ' + error.message, 'error');
        } else {
            ctx.showFloatingMessage('Nickname atualizado com sucesso!', 'success');
            ctx.user.nickname = newNick;

            const myPlayer = ctx.players.find(p => p.id === ctx.myPlayerId);
            if (myPlayer) myPlayer.name = newNick;

            ctx.updateUIForUser();
            ctx.renderPlayerInputs();

            if (ctx.isOnline) {
                if (ctx.isHost) {
                    ctx.syncLobby();
                } else {
                    ctx.sendData({
                        type: 'NAME_CHANGE',
                        id: ctx.myPlayerId,
                        name: newNick
                    });
                }
            }
        }
    } catch (e) {
        console.error('Update nick error:', e);
        ctx.showFloatingMessage('Erro ao atualizar nickname.', 'error');
    }
}

export async function sendSuggestion(ctx) {
    const input = document.getElementById('input-suggestion');
    const suggestion = input.value.trim();
    if (!suggestion) return ctx.showFloatingMessage('Digite uma sugestão!', 'warning');

    const { error } = await ctx.supabase
        .from('suggestions')
        .insert({
            user_id: ctx.user ? ctx.user.id : null,
            category_name: suggestion
        });

    if (error) {
        ctx.showFloatingMessage('Erro ao enviar sugestão: ' + error.message, 'error');
    } else {
        ctx.showFloatingMessage('Sugestão enviada com sucesso! Obrigado.', 'success');
        input.value = '';
    }
}

export async function logout(ctx) {
    if (ctx.user) {
        await ctx.supabase.auth.signOut();
        ctx.showFloatingMessage('Você saiu da conta.', 'info');
    }
    ctx.user = null;
    ctx.isGuest = false;
    localStorage.removeItem('versus-letra-guest');
    localStorage.removeItem('versus-letra-last-screen');
    localStorage.removeItem('versus-letra-guest-xp');
    localStorage.removeItem('versus-letra-guest-level');

    ctx.xp = 0;
    ctx.level = 1;

    ctx.updateUIForUser();
    ctx.showScreen('login');
}

export async function loadUserData(ctx) {
    try {
        if (!ctx.user || !ctx.supabase) return;
        const { data, error } = await ctx.supabase
            .from('profiles')
            .select('achievements, nickname, games_played, games_won, high_score, xp, level, nick_color, selected_theme, unlocked_items, selected_avatar, is_admin')
            .eq('id', ctx.user.id)
            .maybeSingle();

        if (error) {
            console.error('Erro ao carregar dados:', error);
            return;
        }

        if (data) {
            console.log('Dados carregados do Supabase:', data);
            if (data.achievements) {
                const localAchievements = JSON.parse(localStorage.getItem('achievements') || '{}');
                ctx.achievements = { ...ctx.achievements, ...localAchievements, ...data.achievements };
                Object.keys(localAchievements).forEach(key => {
                    if (localAchievements[key] === true) ctx.achievements[key] = true;
                });
                localStorage.setItem('achievements', JSON.stringify(ctx.achievements));
            }
            if (data.nickname) {
                ctx.user.nickname = data.nickname;
            }
            const profileAdmin = toBooleanFlag(data.is_admin);
            const authAdmin = resolveAdminFromUser(ctx.user);
            ctx.user.is_admin = profileAdmin || authAdmin;

            ctx.user.stats = {
                games_played: data.games_played || 0,
                games_won: data.games_won || 0,
                high_score: data.high_score || 0
            };
            ctx.xp = data.xp || 0;
            ctx.level = data.level || 1;
            ctx.selectedColor = data.nick_color || ctx.selectedColor;
            ctx.selectedTheme = data.selected_theme || ctx.selectedTheme;
            ctx.myAvatar = data.selected_avatar || ctx.myAvatar;
            ctx.unlockedItems = data.unlocked_items || ctx.unlockedItems;

            console.log('Aplicando tema carregado:', ctx.selectedTheme);
            ctx.applyTheme(ctx.selectedTheme, { silent: true });
            ctx.updateUIForUser();
            ctx.renderCustomizationPickers();
            ctx.renderAvatarPicker();
        } else {
            const initialNick = ctx.user.user_metadata?.nickname || ctx.user.email.split('@')[0];
            const initialIsAdmin = resolveAdminFromUser(ctx.user);
            const initialData = {
                id: ctx.user.id,
                nickname: initialNick,
                achievements: {
                    dicionario: false,
                    flash: false,
                    invencivel: 0,
                    perfeccionista_count: 0,
                    estrategista_count: 0,
                    rei_da_sala_count: 0,
                    online_wins_count: 0
                },
                games_played: 0,
                games_won: 0,
                high_score: 0,
                xp: 0,
                level: 1,
                nick_color: '#ff4757',
                selected_theme: 'default',
                is_admin: initialIsAdmin
            };
            const { error: insertError } = await ctx.supabase.from('profiles').insert(initialData);
            if (insertError) console.error('Erro ao criar perfil inicial:', insertError.message);
            else console.log('Perfil inicial criado no Supabase!');
            ctx.user.nickname = initialNick;
            ctx.user.is_admin = initialIsAdmin;
            ctx.user.stats = { games_played: 0, games_won: 0, high_score: 0 };
        }
        ctx.isDataLoaded = true;
    } catch (e) {
        console.error('Load user data error:', e);
    }
}

export async function addXP(ctx, amount) {
    if (!ctx.user && !ctx.isGuest) return;

    if (ctx.user && !ctx.isDataLoaded) {
        console.warn('Tentativa de adicionar XP antes de carregar dados do usuário.');
        return;
    }

    ctx.xp = Number(ctx.xp) + amount;
    let xpNeeded = ctx.level * 100;

    while (ctx.xp >= xpNeeded) {
        ctx.level++;
        ctx.xp -= xpNeeded;
        xpNeeded = ctx.level * 100;
        ctx.showFloatingMessage(`🎉 Nível ${ctx.level} Alcançado!`, 'success');
        ctx.playSound('victory');
    }

    ctx.updateUIForUser();

    if (ctx.user || ctx.isGuest) {
        ctx.saveUserData();
    }
}

export async function saveUserData(ctx) {
    if (ctx.isGuest) {
        localStorage.setItem('versus-letra-guest-xp', ctx.xp);
        localStorage.setItem('versus-letra-guest-level', ctx.level);
        localStorage.setItem('versus-letra-guest-color', ctx.selectedColor);
        localStorage.setItem('versus-letra-guest-theme', ctx.selectedTheme);
        localStorage.setItem('versus-letra-guest-avatar', ctx.myAvatar);
        localStorage.setItem('achievements', JSON.stringify(ctx.achievements));
        return;
    }

    if (!ctx.user || !ctx.supabase) return;

    if (!ctx.isDataLoaded) {
        console.warn('Tentativa de salvar dados antes do carregamento completo.');
        return;
    }

    const nicknameToSave = ctx.user.nickname || ctx.user.user_metadata?.nickname || ctx.user.email?.split('@')[0];
    console.log('Salvando dados no Supabase para:', nicknameToSave);

    try {
        const { error } = await ctx.supabase
            .from('profiles')
            .upsert({
                id: ctx.user.id,
                nickname: nicknameToSave,
                achievements: ctx.achievements,
                games_played: ctx.user.stats ? ctx.user.stats.games_played : 0,
                games_won: ctx.user.stats ? ctx.user.stats.games_won : 0,
                high_score: ctx.user.stats ? ctx.user.stats.high_score : 0,
                xp: Number(ctx.xp),
                level: Number(ctx.level),
                nick_color: ctx.selectedColor,
                selected_theme: ctx.selectedTheme,
                selected_avatar: ctx.myAvatar,
                unlocked_items: ctx.unlockedItems
            });

        if (error) {
            console.error('Erro detalhado ao salvar:', error.message, error.details, error.hint);
            const fallbackPayload = {
                nickname: nicknameToSave,
                achievements: ctx.achievements,
                games_played: ctx.user.stats ? ctx.user.stats.games_played : 0,
                games_won: ctx.user.stats ? ctx.user.stats.games_won : 0,
                high_score: ctx.user.stats ? ctx.user.stats.high_score : 0,
                xp: Number(ctx.xp),
                level: Number(ctx.level),
                nick_color: ctx.selectedColor,
                selected_theme: ctx.selectedTheme,
                selected_avatar: ctx.myAvatar
            };
            const { error: simpleError } = await ctx.supabase
                .from('profiles')
                .update(fallbackPayload)
                .eq('id', ctx.user.id);

            if (simpleError) console.error('Erro no fallback de salvamento:', simpleError.message);
        } else {
            console.log('Dados salvos com sucesso no Supabase!');
        }
    } catch (e) {
        console.error('Exceção ao salvar dados:', e);
    }
}

export async function updateEndGameStats(ctx, isWinner, score) {
    if (!ctx.user && !ctx.isGuest) return;

    try {
        const xpGain = 20 + (isWinner ? 50 : 0);

        if (ctx.user && !ctx.user.stats) {
            ctx.user.stats = { games_played: 0, games_won: 0, high_score: 0 };
        }

        if (ctx.user) {
            const newStats = {
                games_played: (ctx.user.stats.games_played || 0) + 1,
                games_won: (ctx.user.stats.games_won || 0) + (isWinner ? 1 : 0),
                high_score: Math.max(ctx.user.stats.high_score || 0, score)
            };

            ctx.user.stats = newStats;
        }

        await ctx.addXP(xpGain);

        if (ctx.user) {
            await ctx.saveUserData();
        }
    } catch (e) {
        console.error('Error updating endgame stats:', e);
    }
}



