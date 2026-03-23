import { SUPABASE_URL, SUPABASE_KEY, REWARDS } from './modules/config.js';
import { DEFAULT_CATEGORIES, CATEGORY_BANKS } from './modules/game-data.js';
import { TRANSLATIONS } from './modules/translations.js';
import { registerServiceWorker } from './modules/bootstrap.js';
import { initCrazyGamesBridge } from './modules/crazygames.js';
import { getHowToContentByLang, getAboutContentByLang, getLegalModalHtml, getModeInstructionByLang, localizeRuntimeTextByLang } from './modules/i18n-content.js';
import { DEFAULT_ACHIEVEMENTS, buildScreensMap } from './modules/state-defaults.js';
import {
    checkSession as checkSessionModule,
    signup as signupModule,
    login as loginModule,
    updateNickname as updateNicknameModule,
    sendSuggestion as sendSuggestionModule,
    logout as logoutModule,
    loadUserData as loadUserDataModule,
    addXP as addXPModule,
    saveUserData as saveUserDataModule,
    updateEndGameStats as updateEndGameStatsModule
} from './modules/auth-user.js';
import {
    startOnlinePresence as startOnlinePresenceModule,
    updateOnlineStatus as updateOnlineStatusModule,
    updateOnlineFriendsCount as updateOnlineFriendsCountModule,
    isOnlineNow as isOnlineNowModule,
    getFriends as getFriendsModule,
    renderGlobalOnlinePlayers as renderGlobalOnlinePlayersModule,
    searchAndFollowFriend as searchAndFollowFriendModule,
    renderFriendsList as renderFriendsListModule,
    joinFriendRoom as joinFriendRoomModule,
    joinFriendRoomByNick as joinFriendRoomByNickModule,
    unfollowFriend as unfollowFriendModule,
    inviteFriendToRoom as inviteFriendToRoomModule
} from './modules/friends-online.js';
import {
    startPartyGame as startPartyGameModule,
    getPartyCategories as getPartyCategoriesModule,
    getRandomPartyCategory as getRandomPartyCategoryModule,
    renderPartyKeyboard as renderPartyKeyboardModule,
    handlePartyLetterClick as handlePartyLetterClickModule,
    startPartyTimer as startPartyTimerModule,
    updatePartyTimerUI as updatePartyTimerUIModule,
    handlePartyElimination as handlePartyEliminationModule,
    advancePartyTurn as advancePartyTurnModule,
    showPartyFinalResults as showPartyFinalResultsModule,
    endPartyGame as endPartyGameModule,
    renderPartyCategoriesList as renderPartyCategoriesListModule
} from './modules/party-mode.js';

/**
 * VersusLetra - Game Logic (Online P2P Edition)
 */

class VersusLetra {
    constructor(platformBridge = null) {
        this.crazyBridge = platformBridge || {
            isCrazyGames: false,
            sdkReady: false,
            loadingStart() {},
            loadingStop() {},
            gameplayStart() {},
            gameplayStop() {},
            happytime() {},
            requestMidgameAd: async () => ({ ok: false, reason: 'sdk_unavailable' }),
            requestRewardedAd: async () => ({ granted: false, reason: 'sdk_unavailable' }),
            applyAudioSettings() {}
        };

        // Supabase Initialization
        this.supabaseUrl = SUPABASE_URL;
        this.supabaseKey = SUPABASE_KEY;
        this.supabase = window.supabase ? window.supabase.createClient(this.supabaseUrl, this.supabaseKey) : null;
        this.user = null;
        this.isGuest = localStorage.getItem('versus-letra-guest') === 'true';

        // Game State
        this.players = [];
        this.currentPlayerIndex = 0;
        this.timeLeft = 15;
        this.timer = null;
        this.currentCategory = '';
        this.selectedLetter = '';
        this.usedLetters = new Set();
        this.isGameOver = false;
        this.isMuted = localStorage.getItem('versus-letra-muted') === 'true';
        this.language = localStorage.getItem('versus-letra-language') || 'pt';
        
        // Progression System
        this.xp = this.isGuest ? Number(localStorage.getItem('versus-letra-guest-xp')) || 0 : 0;
        this.level = this.isGuest ? Number(localStorage.getItem('versus-letra-guest-level')) || 1 : 1;
        this.selectedColor = this.isGuest ? localStorage.getItem('versus-letra-guest-color') || '#ff4757' : '#ff4757';
        this.selectedTheme = this.isGuest ? localStorage.getItem('versus-letra-guest-theme') || 'default' : 'default';
        this.isDataLoaded = this.isGuest; // Já carregado se for convidado
        this.unlockedItems = {
            avatars: ['👤'],
            colors: ['#ff4757'],
            themes: ['default']
        };

        // All Rewards Config
        this.rewards = JSON.parse(JSON.stringify(REWARDS));
        this.activeThemeVarKeys = [];
        this.rewardsHistoryKey = 'versus-letra-rewards-history';

        // New Features State
        this.avatars = this.rewards.avatars.map(a => a.char);
        this.myAvatar = this.isGuest ? localStorage.getItem('versus-letra-guest-avatar') || this.avatars[0] : this.avatars[0];
        this.roundHistory = [];
        this.messages = [];
        this.powerUpsUsedInCategory = new Set(); // Novo: Controla uso de poderes por categoria
        this.customCategories = new Set(); // Novo: Categorias personalizadas para o Modo Galera
        this.instructionCallback = null; // Callback para instruções
        this.achievements = JSON.parse(localStorage.getItem('achievements')) || { ...DEFAULT_ACHIEVEMENTS };

        // Voting State
        this.currentVote = {
            active: false,
            yes: 0,
            no: 0,
            voters: new Set(),
            targetPlayerId: null,
            word: '',
            category: ''
        };

        // Online State
        this.peer = null;
        this.conns = []; // Multiple connections
        this.isHost = false;
        this.isOnline = false;
        this.isTimeAttack = false;
        this.myPlayerId = null;
        this.maxOnlinePlayers = 20;
        this.maxPartyPlayers = 20;
        this.wasRoomFull = false;
        this.externalPauseActive = false;
        this.wasMainTimerRunning = false;
        this.wasPartyTimerRunning = false;
        this.wasAudioRunning = false;

        // Default Categories
        this.defaultCategories = [...DEFAULT_CATEGORIES];
        this.categories = [...this.defaultCategories];

        // I18N
        this.translations = TRANSLATIONS;

        // Word Banks for Validation
        this.categoryBanks = CATEGORY_BANKS;

        // Elements
        this.screens = buildScreensMap(document);

        this.init();
        this.loadSharedRewards();
        try {
            if (typeof this.crazyBridge.applyAudioSettings === 'function') {
                this.crazyBridge.applyAudioSettings(this);
            }
        } catch (error) {
            console.warn('CrazyGames audio settings hook failed:', error);
        }
        this.checkSession();
        this.startOnlinePresence();
        this.checkDevice(); // Detecção de mobile/desktop
        console.log('VersusLetra v2.3 - Friends System');
    }

    checkDevice() {
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;
        const partyBtn = document.getElementById('btn-party-mode');
        if (!partyBtn) return;

        const lockIcon = partyBtn.querySelector('.lock-icon');

        if (!this.isMobile) {
            partyBtn.classList.remove('party-btn');
            partyBtn.style.opacity = '0.7';
            partyBtn.style.filter = 'grayscale(0.5)';
            if (lockIcon) lockIcon.style.display = 'inline';
            partyBtn.title = this.t('mobile_only_title');
        } else {
            partyBtn.classList.add('party-btn');
            partyBtn.style.opacity = '1';
            partyBtn.style.filter = 'none';
            if (lockIcon) lockIcon.style.display = 'none';
        }
    }

    sanitizePlainText(value, { maxLength = 32, fallback = '' } = {}) {
        const normalized = String(value ?? '')
            .replace(/[\u0000-\u001F\u007F]/g, '')
            .replace(/[<>]/g, '')
            .trim();

        if (!normalized) return fallback;
        return normalized.slice(0, maxLength);
    }

    sanitizePlayerName(value, fallback = 'Jogador') {
        return this.sanitizePlainText(value, { maxLength: 24, fallback });
    }

    sanitizeChatText(value) {
        return this.sanitizePlainText(value, { maxLength: 180, fallback: '' });
    }

    sanitizeCategoryName(value) {
        return this.sanitizePlainText(value, { maxLength: 30, fallback: '' });
    }

    sanitizePeerId(value) {
        return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    }

    sanitizeAvatar(value) {
        const avatar = String(value ?? '').trim();
        return this.avatars.includes(avatar) ? avatar : '👤';
    }

    sanitizeThemeId(value) {
        return String(value ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 30);
    }

    getCustomRewardsPayload() {
        return {
            avatars: (this.rewards.avatars || []).filter((item) => item.custom === true),
            colors: (this.rewards.colors || []).filter((item) => item.custom === true),
            themes: (this.rewards.themes || []).filter((item) => item.custom === true)
        };
    }

    mergeSharedRewards(sharedRewards = {}) {
        const customAvatars = Array.isArray(sharedRewards.avatars) ? sharedRewards.avatars : [];
        const customColors = Array.isArray(sharedRewards.colors) ? sharedRewards.colors : [];
        const customThemes = Array.isArray(sharedRewards.themes) ? sharedRewards.themes : [];

        customAvatars.forEach((avatar) => {
            const char = String(avatar?.char || '').trim();
            if (!char) return;
            if (this.rewards.avatars.some((item) => item.char === char)) return;
            this.rewards.avatars.push({
                char,
                level: Math.max(1, Number(avatar.level) || 1),
                custom: true
            });
        });

        customColors.forEach((color) => {
            const hex = String(color?.hex || '').trim().toLowerCase();
            if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
            if (this.rewards.colors.some((item) => item.hex.toLowerCase() === hex)) return;
            this.rewards.colors.push({
                hex,
                level: Math.max(1, Number(color.level) || 1),
                custom: true
            });
        });

        customThemes.forEach((theme) => {
            const id = this.sanitizeThemeId(theme?.id || theme?.name || '');
            if (!id || id === 'default') return;
            if (this.rewards.themes.some((item) => item.id === id)) return;

            this.rewards.themes.push({
                id,
                name: this.sanitizePlainText(theme?.name, { maxLength: 24, fallback: 'Tema' }),
                level: Math.max(1, Number(theme?.level) || 1),
                icon: String(theme?.icon || '🎨').slice(0, 4),
                custom: true,
                vars: (theme?.vars && typeof theme.vars === 'object') ? theme.vars : {}
            });
        });

        this.avatars = this.rewards.avatars.map((a) => a.char);
    }

    async loadSharedRewards() {
        if (!this.supabase) return;

        let loaded = false;
        try {
            const { data, error } = await this.supabase
                .from('game_settings')
                .select('custom_rewards')
                .eq('id', 1)
                .maybeSingle();

            if (!error && data?.custom_rewards) {
                this.mergeSharedRewards(data.custom_rewards);
                localStorage.setItem('versus-letra-shared-rewards-cache', JSON.stringify(data.custom_rewards));
                loaded = true;
            }
        } catch (_) {}

        if (!loaded) {
            try {
                const cached = JSON.parse(localStorage.getItem('versus-letra-shared-rewards-cache') || '{}');
                this.mergeSharedRewards(cached);
            } catch (_) {}
        }

        this.renderAvatarPicker();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();
    }

    async saveSharedRewards(sharedRewards) {
        if (!this.supabase) return false;

        const payload = sharedRewards || this.getCustomRewardsPayload();
        localStorage.setItem('versus-letra-shared-rewards-cache', JSON.stringify(payload));

        try {
            const { error } = await this.supabase
                .from('game_settings')
                .upsert({ id: 1, custom_rewards: payload });

            if (error) {
                console.warn('Falha ao salvar recompensas globais:', error);
                return false;
            }
            return true;
        } catch (error) {
            console.warn('Falha ao salvar recompensas globais:', error);
            return false;
        }
    }

    sanitizeIncomingPlayers(players) {
        if (!Array.isArray(players)) return [];

        const uniqueIds = new Set();
        const output = [];

        players.slice(0, this.maxOnlinePlayers).forEach((player, idx) => {
            const id = this.sanitizePeerId(player?.id || `player-${idx + 1}`);
            if (!id || uniqueIds.has(id)) return;
            uniqueIds.add(id);

            output.push({
                id,
                name: this.sanitizePlayerName(player?.name),
                avatar: this.sanitizeAvatar(player?.avatar),
                score: Number.isFinite(Number(player?.score)) ? Number(player.score) : 0,
                active: player?.active !== false
            });
        });

        return output;
    }

    startOnlinePresence() {
        return startOnlinePresenceModule(this);
    }

    async updateOnlineStatus() {
        return updateOnlineStatusModule(this);
    }

    async updateOnlineFriendsCount() {
        return updateOnlineFriendsCountModule(this);
    }

    isOnlineNow(lastSeen) {
        return isOnlineNowModule(lastSeen);
    }

    async getFriends() {
        return getFriendsModule(this);
    }

    async renderGlobalOnlinePlayers() {
        return renderGlobalOnlinePlayersModule(this);
    }

    async searchAndFollowFriend() {
        return searchAndFollowFriendModule(this);
    }

    async renderFriendsList() {
        return renderFriendsListModule(this);
    }

    joinFriendRoom(roomId) {
        return joinFriendRoomModule(this, roomId);
    }

    async joinFriendRoomByNick(nick) {
        return joinFriendRoomByNickModule(this, nick);
    }

    async unfollowFriend(friendId) {
        return unfollowFriendModule(this, friendId);
    }

    inviteFriendToRoom(friend) {
        return inviteFriendToRoomModule(this, friend);
    }

    ensureFriendProfileModal() {
        let modal = document.getElementById('modal-friend-profile');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'modal-friend-profile';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content friend-profile-modal">
                <button id="btn-close-friend-profile" class="btn-secondary friend-profile-close">Fechar</button>
                <h3 id="friend-profile-title">${this.t('profile_title')}</h3>
                <div class="friend-profile-header">
                    <div id="friend-profile-avatar" class="friend-profile-avatar">👤</div>
                    <div class="friend-profile-main">
                        <div id="friend-profile-name" class="friend-profile-name">Jogador</div>
                        <div class="friend-profile-level">LV <span id="friend-profile-level">1</span></div>
                    </div>
                </div>
                <div class="profile-stats friend-profile-stats">
                    <div class="stat-box">
                        <span class="stat-value" id="friend-stat-games">0</span>
                        <span class="stat-label">${this.t('stat_games')}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-value" id="friend-stat-wins">0</span>
                        <span class="stat-label">${this.t('stat_wins')}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-value" id="friend-stat-record">0</span>
                        <span class="stat-label">${this.t('stat_record')}</span>
                    </div>
                </div>
                <div class="profile-achievements">
                    <h3 id="friend-profile-medals-title">${this.t('profile_medals')}</h3>
                    <div id="friend-profile-achievements-grid" class="achievements-grid mini"></div>
                </div>
            </div>
        `;

        const appRoot = document.getElementById('app') || document.body;
        appRoot.appendChild(modal);

        const closeBtn = modal.querySelector('#btn-close-friend-profile');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeFriendProfile());
        modal.addEventListener('click', (event) => {
            if (event.target === modal) this.closeFriendProfile();
        });

        return modal;
    }

    ensureAdminPanel() {
        this.ensureAdminScreenExists();
        let panel = document.getElementById('admin-rewards-panel');
        if (panel) {
            const isInitialized = panel.querySelector('#admin-avatar-char') && panel.querySelector('#admin-theme-name');
            if (!isInitialized) {
                panel.innerHTML = this.getAdminPanelMarkup();
                delete panel.dataset.bound;
            }
            this.bindAdminPanelEvents(panel);
            return panel;
        }

        const host = document.getElementById('admin-panel-host');
        if (!host) return null;

        panel = document.createElement('div');
        panel.id = 'admin-rewards-panel';
        panel.className = 'admin-panel';
        panel.innerHTML = this.getAdminPanelMarkup();

        host.appendChild(panel);
        this.bindAdminPanelEvents(panel);
        return panel;
    }

    ensureAdminScreenExists() {
        let screen = document.getElementById('admin-screen');
        if (!screen) {
            const app = document.getElementById('app');
            if (!app) return null;

            screen = document.createElement('section');
            screen.id = 'admin-screen';
            screen.className = 'screen';
            screen.innerHTML = `
                <div class="about-card">
                    <h2 id="admin-title">Painel Administrativo</h2>
                    <p id="admin-screen-help" class="admin-help">
                        Gerencie avatares, cores e temas globais em um espaço separado do perfil.
                    </p>
                    <div id="admin-panel-host"></div>
                    <button id="btn-back-admin" class="btn-secondary">VOLTAR</button>
                </div>
            `;
            app.appendChild(screen);
        }

        this.screens.admin = screen;
        return screen;
    }

    getAdminPanelMarkup() {
        return `
            <h3>Painel ADM - Recompensas Globais</h3>
            <p class="admin-help" id="admin-rewards-help">
                Crie recompensas globais de forma simples: salvar, editar e remover.
            </p>

            <div class="admin-summary">
                <div class="admin-summary-item">Avatares custom: <strong id="admin-summary-avatars">0</strong></div>
                <div class="admin-summary-item">Cores custom: <strong id="admin-summary-colors">0</strong></div>
                <div class="admin-summary-item">Temas custom: <strong id="admin-summary-themes">0</strong></div>
            </div>

            <div class="admin-block">
                <h4>Novo Avatar</h4>
                <p class="admin-tip">Use emoji único e nível mínimo para desbloqueio.</p>
                <div class="admin-row">
                    <input type="text" id="admin-avatar-char" maxlength="4" placeholder="Emoji (ex: 🦅)">
                    <input type="number" id="admin-avatar-level" min="1" value="1" placeholder="Nível">
                    <button id="btn-admin-add-avatar" class="btn-primary">Salvar Avatar</button>
                </div>
                <input type="hidden" id="admin-avatar-edit">
                <div class="admin-actions-row">
                    <button id="btn-admin-cancel-avatar-edit" class="btn-secondary">Cancelar Edição</button>
                </div>
                <div id="admin-avatar-list" class="admin-list"></div>
            </div>

            <div class="admin-block">
                <h4>Nova Cor de Nick</h4>
                <p class="admin-tip">Defina uma cor com bom contraste para leitura.</p>
                <div class="admin-row">
                    <input type="color" id="admin-color-hex" value="#4cc9f0">
                    <input type="number" id="admin-color-level" min="1" value="1" placeholder="Nível">
                    <button id="btn-admin-add-color" class="btn-primary">Salvar Cor</button>
                </div>
                <input type="hidden" id="admin-color-edit">
                <div class="admin-actions-row">
                    <button id="btn-admin-cancel-color-edit" class="btn-secondary">Cancelar Edição</button>
                </div>
                <div id="admin-color-list" class="admin-list"></div>
            </div>

            <div class="admin-block">
                <h4>Novo Tema</h4>
                <p class="admin-tip">Crie ID único (sem espaços). Você pode usar presets para acelerar.</p>
                <div class="admin-grid">
                    <div class="admin-field">
                        <label class="admin-field-label" for="admin-theme-name">Nome</label>
                        <input type="text" id="admin-theme-name" placeholder="Nome do tema">
                    </div>
                    <div class="admin-field">
                        <label class="admin-field-label" for="admin-theme-icon">Ícone</label>
                        <input type="text" id="admin-theme-icon" maxlength="4" placeholder="Ícone (ex: 🌌)">
                    </div>
                    <div class="admin-field">
                        <label class="admin-field-label" for="admin-theme-level">Nível</label>
                        <input type="number" id="admin-theme-level" min="1" value="1" placeholder="Nível">
                    </div>
                    <div class="admin-field">
                        <label class="admin-field-label" for="admin-theme-id">ID</label>
                        <input type="text" id="admin-theme-id" placeholder="ID (ex: galaxia)">
                    </div>

                    <div class="admin-field">
                        <label class="admin-field-label" for="admin-theme-primary">
                            Cor Principal
                            <span class="admin-help-wrap">
                                <button type="button" class="admin-help-icon admin-help-toggle" aria-label="Ajuda Cor Principal">?</button>
                                <span class="admin-help-pop">Define botões, destaques e bordas ativas.</span>
                            </span>
                        </label>
                        <input type="color" id="admin-theme-primary" value="#1e90ff">
                    </div>
                    <div class="admin-field">
                        <label class="admin-field-label" for="admin-theme-bg">
                            Fundo
                            <span class="admin-help-wrap">
                                <button type="button" class="admin-help-icon admin-help-toggle" aria-label="Ajuda Fundo">?</button>
                                <span class="admin-help-pop">Cor de fundo geral do app e das telas.</span>
                            </span>
                        </label>
                        <input type="color" id="admin-theme-bg" value="#0f172a">
                    </div>
                    <div class="admin-field">
                        <label class="admin-field-label" for="admin-theme-card">
                            Card
                            <span class="admin-help-wrap">
                                <button type="button" class="admin-help-icon admin-help-toggle" aria-label="Ajuda Card">?</button>
                                <span class="admin-help-pop">Cor de caixas e painéis internos.</span>
                            </span>
                        </label>
                        <input type="color" id="admin-theme-card" value="#1e293b">
                    </div>
                    <div class="admin-field">
                        <label class="admin-field-label" for="admin-theme-text">
                            Texto
                            <span class="admin-help-wrap">
                                <button type="button" class="admin-help-icon admin-help-toggle" aria-label="Ajuda Texto">?</button>
                                <span class="admin-help-pop">Cor principal dos textos do jogo.</span>
                            </span>
                        </label>
                        <input type="color" id="admin-theme-text" value="#f8fafc">
                    </div>
                </div>
                <p class="admin-tip">
                    Cor Principal: botões, destaques e bordas ativas. Fundo: fundo geral do app.
                    Card: caixas/painéis. Texto: cor principal dos textos.
                </p>
                <div class="admin-actions-row">
                    <button id="btn-admin-generate-theme-id" class="btn-secondary">Gerar ID</button>
                    <button id="btn-admin-preview-theme" class="btn-secondary">Pré-visualizar</button>
                    <button id="btn-admin-clear-preview-theme" class="btn-secondary">Limpar Preview</button>
                    <button id="btn-admin-add-theme" class="btn-primary">Salvar Tema</button>
                </div>
                <input type="hidden" id="admin-theme-edit">
                <div class="admin-actions-row">
                    <button id="btn-admin-cancel-theme-edit" class="btn-secondary">Cancelar Edição</button>
                </div>

                <div class="admin-presets">
                    <span>Presets:</span>
                    <button class="btn-secondary btn-admin-preset" data-preset="neon">Neon</button>
                    <button class="btn-secondary btn-admin-preset" data-preset="forest">Floresta</button>
                    <button class="btn-secondary btn-admin-preset" data-preset="sunset">Sunset</button>
                </div>
                <div id="admin-theme-list" class="admin-list"></div>
            </div>

            <div class="admin-block">
                <h4>Limpeza Rápida</h4>
                <p class="admin-tip">Remove todos os itens customizados de uma vez.</p>
                <div class="admin-actions-row">
                    <button id="btn-admin-clear-rewards" class="btn-secondary danger">Limpar Custom</button>
                </div>
            </div>

            <p id="admin-rewards-status" class="admin-status"></p>
        `;
    }

    bindAdminPanelEvents(panel = document.getElementById('admin-rewards-panel')) {
        if (!panel || panel.dataset.bound === 'true') return;
        panel.dataset.bound = 'true';

        const bindClick = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        };

        bindClick('btn-admin-add-avatar', () => this.addAdminAvatarReward());
        bindClick('btn-admin-add-color', () => this.addAdminColorReward());
        bindClick('btn-admin-add-theme', () => this.addAdminThemeReward());
        bindClick('btn-admin-cancel-avatar-edit', () => this.clearAdminEditState('avatar'));
        bindClick('btn-admin-cancel-color-edit', () => this.clearAdminEditState('color'));
        bindClick('btn-admin-cancel-theme-edit', () => this.clearAdminEditState('theme'));
        bindClick('btn-admin-clear-rewards', () => this.clearAllCustomRewards());
        bindClick('btn-admin-generate-theme-id', () => {
            const nameInput = document.getElementById('admin-theme-name');
            const idInput = document.getElementById('admin-theme-id');
            if (!idInput) return;
            idInput.value = this.sanitizeThemeId(nameInput?.value || idInput.value);
        });
        bindClick('btn-admin-preview-theme', () => this.previewAdminThemeDraft());
        bindClick('btn-admin-clear-preview-theme', () => this.clearAdminThemePreview());

        panel.addEventListener('click', (event) => {
            if (!event.target.closest('.admin-help-wrap')) {
                panel.querySelectorAll('.admin-help-pop.show').forEach((el) => el.classList.remove('show'));
            }

            const button = event.target.closest('button');
            if (!button) return;

            if (button.classList.contains('admin-help-toggle')) {
                const wrap = button.closest('.admin-help-wrap');
                const pop = wrap?.querySelector('.admin-help-pop');
                if (!pop) return;
                const willShow = !pop.classList.contains('show');
                panel.querySelectorAll('.admin-help-pop.show').forEach((el) => el.classList.remove('show'));
                if (willShow) pop.classList.add('show');
                return;
            }

            if (button.classList.contains('btn-admin-preset')) {
                this.applyAdminThemePreset(button.dataset.preset);
                return;
            }

            const action = button.dataset.action;
            if (action === 'remove-avatar') {
                this.removeCustomAvatar(button.dataset.value);
            } else if (action === 'remove-color') {
                this.removeCustomColor(button.dataset.value);
            } else if (action === 'remove-theme') {
                this.removeCustomTheme(button.dataset.value);
            } else if (action === 'edit-avatar') {
                this.startEditAvatar(button.dataset.value);
            } else if (action === 'edit-color') {
                this.startEditColor(button.dataset.value);
            } else if (action === 'edit-theme') {
                this.startEditTheme(button.dataset.value);
            }
        });
    }

    async openFriendProfile(friendId) {
        if (!friendId || !this.supabase) return;

        const modal = this.ensureFriendProfileModal();
        if (!modal) return;

        const friendName = document.getElementById('friend-profile-name');
        const friendAvatar = document.getElementById('friend-profile-avatar');
        const friendLevel = document.getElementById('friend-profile-level');
        const statGames = document.getElementById('friend-stat-games');
        const statWins = document.getElementById('friend-stat-wins');
        const statRecord = document.getElementById('friend-stat-record');

        if (friendName) friendName.textContent = 'Carregando...';
        if (friendAvatar) friendAvatar.textContent = '👤';
        if (friendLevel) friendLevel.textContent = '1';
        if (statGames) statGames.textContent = '0';
        if (statWins) statWins.textContent = '0';
        if (statRecord) statRecord.textContent = '0';
        this.renderAchievementsGrid('friend-profile-achievements-grid', {});

        modal.style.display = 'flex';

        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('nickname, selected_avatar, level, games_played, games_won, high_score, achievements, is_admin')
                .eq('id', friendId)
                .maybeSingle();

            if (error || !data) {
                throw error || new Error('Perfil não encontrado');
            }

            if (friendName) friendName.textContent = this.sanitizePlayerName(data.nickname, 'Jogador');
            if (friendAvatar) friendAvatar.textContent = this.sanitizeAvatar(data.selected_avatar || '👤');
            if (friendLevel) friendLevel.textContent = Number(data.level || 1);
            if (statGames) statGames.textContent = Number(data.games_played || 0);
            if (statWins) statWins.textContent = Number(data.games_won || 0);
            if (statRecord) statRecord.textContent = Number(data.high_score || 0);

            const friendAchievements = (data.achievements && typeof data.achievements === 'object')
                ? data.achievements
                : {};
            this.renderAchievementsGrid('friend-profile-achievements-grid', friendAchievements, Boolean(data.is_admin));
        } catch (e) {
            console.error('Erro ao carregar perfil do amigo:', e);
            if (friendName) friendName.textContent = 'Não foi possível carregar';
            this.showFloatingMessage('Não foi possível carregar o perfil do amigo.', 'error');
        }
    }

    closeFriendProfile() {
        const modal = document.getElementById('modal-friend-profile');
        if (modal) modal.style.display = 'none';
    }

    getRewardsHistory() {
        try {
            const parsed = JSON.parse(localStorage.getItem(this.rewardsHistoryKey) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    saveRewardsHistory(historyEntries) {
        localStorage.setItem(this.rewardsHistoryKey, JSON.stringify(historyEntries.slice(0, 30)));
    }

    pushRewardsHistory(actionLabel = 'Atualização') {
        const payload = this.getCustomRewardsPayload();
        const entry = {
            id: Date.now().toString(),
            at: new Date().toISOString(),
            action: actionLabel,
            payload
        };
        const history = this.getRewardsHistory();
        history.unshift(entry);
        this.saveRewardsHistory(history);
    }

    renderAdminHistory() {
        const select = document.getElementById('admin-history-list');
        if (!select) return;

        const history = this.getRewardsHistory();
        if (!history.length) {
            select.innerHTML = '<option value="">Sem histórico ainda</option>';
            return;
        }

        select.innerHTML = history.map((entry, index) => {
            const dt = new Date(entry.at);
            const labelDate = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
            return `<option value="${entry.id}">${index + 1}. ${entry.action} - ${labelDate}</option>`;
        }).join('');
    }

    async rollbackAdminHistory() {
        if (!this.isCurrentUserAdmin()) return;
        const select = document.getElementById('admin-history-list');
        if (!select?.value) return this.showFloatingMessage('Selecione uma versão do histórico.', 'warning');

        const history = this.getRewardsHistory();
        const entry = history.find((item) => item.id === select.value);
        if (!entry) return this.showFloatingMessage('Versão não encontrada.', 'error');

        this.rewards.avatars = this.rewards.avatars.filter((item) => item.custom !== true);
        this.rewards.colors = this.rewards.colors.filter((item) => item.custom !== true);
        this.rewards.themes = this.rewards.themes.filter((item) => item.custom !== true);
        this.mergeSharedRewards(entry.payload || {});

        const savedGlobally = await this.saveSharedRewards();
        this.renderAvatarPicker();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();
        this.setAdminStatus(savedGlobally ? 'Rollback aplicado e publicado.' : 'Rollback aplicado localmente.', savedGlobally ? 'success' : 'warning');
    }

    clearAdminHistory() {
        if (!confirm('Deseja limpar todo o histórico local de versões?')) return;
        localStorage.removeItem(this.rewardsHistoryKey);
        this.renderAdminHistory();
        this.setAdminStatus('Histórico local limpo.', 'info');
    }

    clearAdminEditState(type) {
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        if (type === 'avatar') {
            const hidden = document.getElementById('admin-avatar-edit');
            if (hidden) hidden.value = '';
            setText('btn-admin-add-avatar', 'Salvar Avatar');
        } else if (type === 'color') {
            const hidden = document.getElementById('admin-color-edit');
            if (hidden) hidden.value = '';
            setText('btn-admin-add-color', 'Salvar Cor');
        } else if (type === 'theme') {
            const hidden = document.getElementById('admin-theme-edit');
            if (hidden) hidden.value = '';
            setText('btn-admin-add-theme', 'Salvar Tema');
        }
    }

    startEditAvatar(char) {
        const entry = this.rewards.avatars.find((item) => item.custom === true && item.char === char);
        if (!entry) return;
        const charInput = document.getElementById('admin-avatar-char');
        const levelInput = document.getElementById('admin-avatar-level');
        const hidden = document.getElementById('admin-avatar-edit');
        if (charInput) charInput.value = entry.char;
        if (levelInput) levelInput.value = String(entry.level || 1);
        if (hidden) hidden.value = entry.char;
        const btn = document.getElementById('btn-admin-add-avatar');
        if (btn) btn.textContent = 'Atualizar Avatar';
        this.setAdminStatus('Edição de avatar carregada.', 'info');
    }

    startEditColor(hex) {
        const entry = this.rewards.colors.find((item) => item.custom === true && item.hex.toLowerCase() === String(hex).toLowerCase());
        if (!entry) return;
        const hexInput = document.getElementById('admin-color-hex');
        const levelInput = document.getElementById('admin-color-level');
        const hidden = document.getElementById('admin-color-edit');
        if (hexInput) hexInput.value = entry.hex;
        if (levelInput) levelInput.value = String(entry.level || 1);
        if (hidden) hidden.value = entry.hex;
        const btn = document.getElementById('btn-admin-add-color');
        if (btn) btn.textContent = 'Atualizar Cor';
        this.setAdminStatus('Edição de cor carregada.', 'info');
    }

    startEditTheme(themeId) {
        const entry = this.rewards.themes.find((item) => item.custom === true && item.id === themeId);
        if (!entry) return;
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        setValue('admin-theme-id', entry.id);
        setValue('admin-theme-name', entry.name);
        setValue('admin-theme-icon', entry.icon || '🎨');
        setValue('admin-theme-level', String(entry.level || 1));
        setValue('admin-theme-primary', entry.vars?.['--primary-color'] || '#1e90ff');
        setValue('admin-theme-bg', entry.vars?.['--bg-color'] || '#0f172a');
        setValue('admin-theme-card', entry.vars?.['--card-bg'] || '#1e293b');
        setValue('admin-theme-text', entry.vars?.['--text-color'] || '#f8fafc');

        const hidden = document.getElementById('admin-theme-edit');
        if (hidden) hidden.value = entry.id;
        const btn = document.getElementById('btn-admin-add-theme');
        if (btn) btn.textContent = 'Atualizar Tema';
        this.setAdminStatus('Edição de tema carregada.', 'info');
    }

    async moveCustomItem(type, value, direction) {
        if (!this.isCurrentUserAdmin()) return;
        const list = this.rewards[type];
        if (!Array.isArray(list)) return;

        const matcher = (item) => {
            if (type === 'avatars') return item.custom === true && item.char === value;
            if (type === 'colors') return item.custom === true && item.hex === value;
            return item.custom === true && item.id === value;
        };

        const index = list.findIndex(matcher);
        if (index < 0) return;
        const target = index + direction;
        if (target < 0 || target >= list.length) return;

        // Só permite mover entre itens custom.
        if (list[target]?.custom !== true) return;

        [list[index], list[target]] = [list[target], list[index]];
        this.pushRewardsHistory(`Reordenar ${type}`);
        await this.saveSharedRewards();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();
        this.setAdminStatus('Ordem atualizada.', 'info');
    }

    async addAdminAvatarReward() {
        if (!this.isCurrentUserAdmin()) return;

        const charInput = document.getElementById('admin-avatar-char');
        const levelInput = document.getElementById('admin-avatar-level');
        const editInput = document.getElementById('admin-avatar-edit');
        const char = String(charInput?.value || '').trim();
        const level = Math.max(1, Number(levelInput?.value) || 1);

        if (!char) return this.showFloatingMessage('Informe um avatar (emoji).', 'warning');
        const editingChar = String(editInput?.value || '').trim();
        if (editingChar && char !== editingChar && this.rewards.avatars.some((item) => item.char === char)) {
            return this.showFloatingMessage('Já existe outro avatar com este emoji.', 'warning');
        }
        if (!editingChar && this.rewards.avatars.some((item) => item.char === char)) {
            return this.showFloatingMessage('Este avatar já existe.', 'info');
        }

        this.pushRewardsHistory(editingChar ? 'Editar avatar' : 'Criar avatar');
        if (editingChar) {
            const existing = this.rewards.avatars.find((item) => item.custom === true && item.char === editingChar);
            if (existing) {
                existing.char = char;
                existing.level = level;
            } else {
                this.rewards.avatars.push({ char, level, custom: true });
            }
        } else {
            this.rewards.avatars.push({ char, level, custom: true });
        }
        this.avatars = this.rewards.avatars.map((a) => a.char);

        const savedGlobally = await this.saveSharedRewards();
        this.renderCustomizationPickers();
        this.renderAvatarPicker();
        this.renderAdminRewardsPanel();

        if (charInput) charInput.value = '';
        this.clearAdminEditState('avatar');
        this.showFloatingMessage(savedGlobally
            ? 'Avatar global criado com sucesso.'
            : 'Avatar salvo localmente. Configure a tabela game_settings no Supabase para liberar globalmente.', savedGlobally ? 'success' : 'warning');
        this.setAdminStatus(savedGlobally
            ? 'Avatar publicado globalmente.'
            : 'Avatar salvo localmente. Configure game_settings para liberar globalmente.', savedGlobally ? 'success' : 'warning');
    }

    async addAdminColorReward() {
        if (!this.isCurrentUserAdmin()) return;

        const hexInput = document.getElementById('admin-color-hex');
        const levelInput = document.getElementById('admin-color-level');
        const editInput = document.getElementById('admin-color-edit');
        const hex = String(hexInput?.value || '').trim().toLowerCase();
        const level = Math.max(1, Number(levelInput?.value) || 1);

        if (!/^#[0-9a-f]{6}$/i.test(hex)) return this.showFloatingMessage('Cor inválida.', 'warning');
        const editingHex = String(editInput?.value || '').toLowerCase();
        if (editingHex && hex !== editingHex && this.rewards.colors.some((item) => item.hex.toLowerCase() === hex)) {
            return this.showFloatingMessage('Já existe outra cor com este HEX.', 'warning');
        }
        if (!editingHex && this.rewards.colors.some((item) => item.hex.toLowerCase() === hex)) {
            return this.showFloatingMessage('Esta cor já existe.', 'info');
        }

        this.pushRewardsHistory(editingHex ? 'Editar cor' : 'Criar cor');
        if (editingHex) {
            const existing = this.rewards.colors.find((item) => item.custom === true && item.hex.toLowerCase() === editingHex);
            if (existing) {
                existing.hex = hex;
                existing.level = level;
            } else {
                this.rewards.colors.push({ hex, level, custom: true });
            }
        } else {
            this.rewards.colors.push({ hex, level, custom: true });
        }
        const savedGlobally = await this.saveSharedRewards();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();
        this.clearAdminEditState('color');

        this.showFloatingMessage(savedGlobally
            ? 'Cor global criada com sucesso.'
            : 'Cor salva localmente. Configure a tabela game_settings no Supabase para liberar globalmente.', savedGlobally ? 'success' : 'warning');
        this.setAdminStatus(savedGlobally
            ? 'Cor publicada globalmente.'
            : 'Cor salva localmente. Configure game_settings para liberar globalmente.', savedGlobally ? 'success' : 'warning');
    }

    async addAdminThemeReward() {
        if (!this.isCurrentUserAdmin()) return;

        const idInput = document.getElementById('admin-theme-id');
        const nameInput = document.getElementById('admin-theme-name');
        const iconInput = document.getElementById('admin-theme-icon');
        const levelInput = document.getElementById('admin-theme-level');
        const primaryInput = document.getElementById('admin-theme-primary');
        const bgInput = document.getElementById('admin-theme-bg');
        const cardInput = document.getElementById('admin-theme-card');
        const textInput = document.getElementById('admin-theme-text');
        const editInput = document.getElementById('admin-theme-edit');

        const rawName = String(nameInput?.value || '').trim();
        const id = this.sanitizeThemeId(idInput?.value || rawName);
        const name = this.sanitizePlainText(rawName, { maxLength: 24, fallback: '' });
        const icon = String(iconInput?.value || '🎨').trim().slice(0, 4) || '🎨';
        const level = Math.max(1, Number(levelInput?.value) || 1);

        if (!id || !name) return this.showFloatingMessage('Preencha nome e ID do tema.', 'warning');
        const editingId = String(editInput?.value || '').trim();
        if (editingId && id !== editingId && this.rewards.themes.some((item) => item.id === id)) {
            return this.showFloatingMessage('Já existe outro tema com este ID.', 'warning');
        }
        if (!editingId && this.rewards.themes.some((item) => item.id === id)) {
            return this.showFloatingMessage('Este ID de tema já existe.', 'info');
        }

        const vars = {
            '--primary-color': String(primaryInput?.value || '#1e90ff'),
            '--bg-color': String(bgInput?.value || '#0f172a'),
            '--card-bg': String(cardInput?.value || '#1e293b'),
            '--text-color': String(textInput?.value || '#f8fafc')
        };

        this.pushRewardsHistory(editingId ? 'Editar tema' : 'Criar tema');
        if (editingId) {
            const existing = this.rewards.themes.find((item) => item.custom === true && item.id === editingId);
            if (existing) {
                existing.id = id;
                existing.name = name;
                existing.icon = icon;
                existing.level = level;
                existing.vars = vars;
            } else {
                this.rewards.themes.push({ id, name, icon, level, custom: true, vars });
            }
        } else {
            this.rewards.themes.push({ id, name, icon, level, custom: true, vars });
        }

        const savedGlobally = await this.saveSharedRewards();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();

        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (iconInput) iconInput.value = '';
        this.clearAdminEditState('theme');

        this.showFloatingMessage(savedGlobally
            ? 'Tema global criado com sucesso.'
            : 'Tema salvo localmente. Configure a tabela game_settings no Supabase para liberar globalmente.', savedGlobally ? 'success' : 'warning');
        this.setAdminStatus(savedGlobally
            ? 'Tema publicado globalmente.'
            : 'Tema salvo localmente. Configure game_settings para liberar globalmente.', savedGlobally ? 'success' : 'warning');
    }

    setAdminStatus(message, type = 'info') {
        const statusEl = document.getElementById('admin-rewards-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.dataset.type = type;
    }

    async removeCustomAvatar(char) {
        if (!this.isCurrentUserAdmin()) return;
        this.pushRewardsHistory('Remover avatar');
        this.rewards.avatars = this.rewards.avatars.filter((item) => !(item.custom === true && item.char === char));
        this.avatars = this.rewards.avatars.map((a) => a.char);
        if (!this.avatars.includes(this.myAvatar)) this.myAvatar = this.avatars[0] || '👤';
        await this.saveSharedRewards();
        this.renderAvatarPicker();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();
        this.setAdminStatus('Avatar custom removido.', 'info');
    }

    async removeCustomColor(hex) {
        if (!this.isCurrentUserAdmin()) return;
        this.pushRewardsHistory('Remover cor');
        const targetHex = String(hex || '').toLowerCase();
        this.rewards.colors = this.rewards.colors.filter((item) => !(item.custom === true && item.hex.toLowerCase() === targetHex));
        if (!this.rewards.colors.some((c) => c.hex === this.selectedColor)) {
            this.selectedColor = '#ff4757';
        }
        await this.saveSharedRewards();
        this.updateUIForUser();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();
        this.setAdminStatus('Cor custom removida.', 'info');
    }

    async removeCustomTheme(themeId) {
        if (!this.isCurrentUserAdmin()) return;
        this.pushRewardsHistory('Remover tema');
        this.rewards.themes = this.rewards.themes.filter((item) => !(item.custom === true && item.id === themeId));
        if (!this.rewards.themes.some((t) => t.id === this.selectedTheme)) {
            this.applyTheme('default', { silent: true });
        }
        await this.saveSharedRewards();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();
        this.setAdminStatus('Tema custom removido.', 'info');
    }

    async clearAllCustomRewards() {
        if (!this.isCurrentUserAdmin()) return;
        if (!confirm('Tem certeza que deseja remover TODAS as recompensas customizadas globais?')) return;
        this.pushRewardsHistory('Limpar tudo');

        this.rewards.avatars = this.rewards.avatars.filter((item) => item.custom !== true);
        this.rewards.colors = this.rewards.colors.filter((item) => item.custom !== true);
        this.rewards.themes = this.rewards.themes.filter((item) => item.custom !== true);
        this.avatars = this.rewards.avatars.map((a) => a.char);

        if (!this.avatars.includes(this.myAvatar)) this.myAvatar = this.avatars[0] || '👤';
        if (!this.rewards.themes.some((item) => item.id === this.selectedTheme)) {
            this.applyTheme('default', { silent: true });
        }
        if (!this.rewards.colors.some((item) => item.hex === this.selectedColor)) {
            this.selectedColor = '#ff4757';
        }

        const savedGlobally = await this.saveSharedRewards({ avatars: [], colors: [], themes: [] });
        this.updateUIForUser();
        this.renderAvatarPicker();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();
        this.setAdminStatus(savedGlobally ? 'Todas as recompensas custom foram limpas globalmente.' : 'Custom limpo localmente.', savedGlobally ? 'success' : 'warning');
    }

    exportAdminRewardsJson() {
        const textarea = document.getElementById('admin-rewards-json');
        if (!textarea) return;
        const payload = this.getCustomRewardsPayload();
        textarea.value = JSON.stringify(payload, null, 2);
        this.setAdminStatus('JSON exportado para o campo abaixo.', 'info');
    }

    async importAdminRewardsJson() {
        if (!this.isCurrentUserAdmin()) return;
        const textarea = document.getElementById('admin-rewards-json');
        if (!textarea) return;

        let parsed;
        try {
            parsed = JSON.parse(textarea.value || '{}');
        } catch (_) {
            this.setAdminStatus('JSON inválido. Revise o conteúdo antes de importar.', 'error');
            return this.showFloatingMessage('JSON inválido.', 'error');
        }

        this.pushRewardsHistory('Importar JSON');
        this.mergeSharedRewards(parsed);
        const savedGlobally = await this.saveSharedRewards();
        this.renderAvatarPicker();
        this.renderCustomizationPickers();
        this.renderAdminRewardsPanel();
        this.setAdminStatus(savedGlobally ? 'JSON importado e publicado globalmente.' : 'JSON importado localmente.', savedGlobally ? 'success' : 'warning');
    }

    applyAdminThemePreset(presetId) {
        const presets = {
            neon: { primary: '#00f5d4', bg: '#10002b', card: '#240046', text: '#f8f9fa', icon: '⚡' },
            forest: { primary: '#2d6a4f', bg: '#081c15', card: '#1b4332', text: '#f1faee', icon: '🌲' },
            sunset: { primary: '#ff7b00', bg: '#370617', card: '#6a040f', text: '#fff1e6', icon: '🌇' }
        };
        const preset = presets[presetId];
        if (!preset) return;

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };

        setValue('admin-theme-primary', preset.primary);
        setValue('admin-theme-bg', preset.bg);
        setValue('admin-theme-card', preset.card);
        setValue('admin-theme-text', preset.text);
        setValue('admin-theme-icon', preset.icon);
        this.setAdminStatus(`Preset ${presetId} aplicado. Ajuste e salve quando quiser.`, 'info');
    }

    previewAdminThemeDraft() {
        const primary = document.getElementById('admin-theme-primary')?.value;
        const bg = document.getElementById('admin-theme-bg')?.value;
        const card = document.getElementById('admin-theme-card')?.value;
        const text = document.getElementById('admin-theme-text')?.value;

        if (!primary || !bg || !card || !text) return;
        document.body.style.setProperty('--primary-color', primary);
        document.body.style.setProperty('--bg-color', bg);
        document.body.style.setProperty('--card-bg', card);
        document.body.style.setProperty('--text-color', text);
        this.setAdminStatus('Pré-visualização aplicada localmente (ainda não salva).', 'info');
    }

    clearAdminThemePreview(options = {}) {
        const { silent = false } = options;
        document.body.style.removeProperty('--primary-color');
        document.body.style.removeProperty('--bg-color');
        document.body.style.removeProperty('--card-bg');
        document.body.style.removeProperty('--text-color');
        if (!silent) this.setAdminStatus('Pré-visualização limpa.', 'info');
    }

    renderAdminRewardsPanel() {
        const panel = this.ensureAdminPanel();
        if (!panel) return;

        const isAdmin = this.isCurrentUserAdmin();
        panel.style.display = isAdmin ? 'block' : 'none';
        if (!isAdmin) return;

        const customAvatars = this.rewards.avatars.filter((item) => item.custom === true);
        const customColors = this.rewards.colors.filter((item) => item.custom === true);
        const customThemes = this.rewards.themes.filter((item) => item.custom === true);

        const summaryAvatars = document.getElementById('admin-summary-avatars');
        const summaryColors = document.getElementById('admin-summary-colors');
        const summaryThemes = document.getElementById('admin-summary-themes');
        if (summaryAvatars) summaryAvatars.textContent = String(customAvatars.length);
        if (summaryColors) summaryColors.textContent = String(customColors.length);
        if (summaryThemes) summaryThemes.textContent = String(customThemes.length);

        const avatarList = document.getElementById('admin-avatar-list');
        const colorList = document.getElementById('admin-color-list');
        const themeList = document.getElementById('admin-theme-list');

        if (avatarList) {
            avatarList.innerHTML = customAvatars.length
                ? customAvatars.map((item) => `
                    <span class="admin-pill">${item.char} LV ${item.level}
                        <button class="admin-mini" data-action="edit-avatar" data-value="${item.char}" title="Editar">✎</button>
                        <button class="admin-remove" data-action="remove-avatar" data-value="${item.char}" title="Remover">×</button>
                    </span>
                `).join('')
                : '<span class="admin-empty">Nenhum avatar custom ainda.</span>';
        }

        if (colorList) {
            colorList.innerHTML = customColors.length
                ? customColors.map((item) => `
                    <span class="admin-pill">${item.hex.toUpperCase()} LV ${item.level}
                        <button class="admin-mini" data-action="edit-color" data-value="${item.hex}" title="Editar">✎</button>
                        <button class="admin-remove" data-action="remove-color" data-value="${item.hex}" title="Remover">×</button>
                    </span>
                `).join('')
                : '<span class="admin-empty">Nenhuma cor custom ainda.</span>';
        }

        if (themeList) {
            themeList.innerHTML = customThemes.length
                ? customThemes.map((item) => `
                    <span class="admin-pill">${item.icon || '🎨'} ${item.name} • ${item.id} • LV ${item.level}
                        <button class="admin-mini" data-action="edit-theme" data-value="${item.id}" title="Editar">✎</button>
                        <button class="admin-remove" data-action="remove-theme" data-value="${item.id}" title="Remover">×</button>
                    </span>
                `).join('')
                : '<span class="admin-empty">Nenhum tema custom ainda.</span>';
        }
    }

    init() {
        this.setupEventListeners();
        this.setupVisibilityHandlers();
        this.setupTheme();
        this.generateKeyboard();
        this.renderAvatarPicker();
        this.applyTranslations();
        
        // Aplica configurações salvas (especialmente para convidados)
        if (this.isGuest) {
            this.applyTheme(this.selectedTheme, { silent: true });
            this.updateUIForUser();
        }
    }

    t(key) {
        const dict = this.translations[this.language] || this.translations.pt;
        return dict[key] || this.translations.pt[key] || key;
    }

    setLanguage(lang) {
        if (!this.translations[lang]) return;
        this.language = lang;
        localStorage.setItem('versus-letra-language', lang);
        this.applyTranslations();
    }

    applyTranslations() {
        document.documentElement.lang = this.language === 'pt' ? 'pt-BR' : this.language;

        const byId = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const bySelector = (selector, text) => {
            const el = document.querySelector(selector);
            if (el) el.textContent = text;
        };
        const bySelectorHtml = (selector, html) => {
            const el = document.querySelector(selector);
            if (el) el.innerHTML = html;
        };
        const bySelectorAll = (selector, callback) => {
            document.querySelectorAll(selector).forEach(callback);
        };
        const byTitle = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.title = text;
        };
        const byPlaceholder = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.placeholder = text;
        };

        byId('btn-play-setup', this.t('play_local'));
        byId('btn-play-online', this.t('play_online'));
        bySelector('#btn-ranking .grid-label', this.t('ranking'));
        bySelector('#btn-admin-home .grid-label', 'Painel ADM');
        bySelector('#btn-how-to .grid-label', this.t('rules'));
        bySelector('#btn-about .grid-label', this.t('about'));
        bySelector('#btn-settings-home .grid-label', this.t('settings_short'));
        byId('about-title', this.t('about_title'));
        byId('profile-title', this.t('profile_title'));
        byId('profile-achievements-title', this.t('profile_medals'));
        byId('profile-customization-title', this.t('profile_customization'));
        const statLabels = document.querySelectorAll('#profile-screen .stat-label');
        if (statLabels.length >= 3) {
            statLabels[0].textContent = this.t('stat_games');
            statLabels[1].textContent = this.t('stat_wins');
            statLabels[2].textContent = this.t('stat_record');
        }
        bySelector('label[for="profile-nick"]', this.t('change_nickname'));
        byId('btn-update-nick', this.t('save_nickname'));
        const customLabels = document.querySelectorAll('#profile-screen .custom-group > label');
        if (customLabels.length >= 3) {
            customLabels[0].textContent = this.t('avatar_label');
            customLabels[1].textContent = this.t('nick_color_label');
            customLabels[2].textContent = this.t('game_theme_label');
        }
        byId('suggestion-title', this.t('suggestion_title'));
        byId('btn-send-suggestion', this.t('send'));
        byId('friends-title', this.t('friends_title'));
        byId('btn-search-friend', this.t('follow'));
        byId('btn-search-room-friend', this.t('find_room'));
        byId('friends-list-title', this.t('your_friends'));
        byId('friends-online-title', this.t('other_online_players'));
        byId('friends-empty-msg', this.t('no_friends_yet'));
        byId('global-online-empty-msg', this.t('no_online_players'));
        byId('friend-profile-title', this.t('profile_title'));
        byId('friend-profile-medals-title', this.t('profile_medals'));

        byId('settings-title', this.t('settings'));
        byId('settings-language-title', this.t('language'));
        byId('settings-appearance-title', this.t('appearance_sound'));
        byId('theme-toggle-label', this.t('toggle_theme'));
        byId('sound-toggle-label', this.t('toggle_sound'));

        byTitle('btn-global-back', this.t('back_title'));
        byTitle('btn-profile', this.t('my_profile'));
        byTitle('btn-friends', this.t('friends'));
        byTitle('btn-admin', 'Painel ADM');
        byTitle('btn-settings', this.t('settings_title_btn'));
        byTitle('theme-toggle', this.t('toggle_theme'));
        byTitle('sound-toggle', this.t('toggle_sound'));

        byId('instruction-title', this.t('rules'));
        byId('btn-close-instructions', this.t('understood'));
        bySelector('#modal-voting h3', this.t('vote_title'));
        bySelectorHtml('#voting-info > p', `<strong id="voter-player-name">...</strong> ${this.t('vote_player_wrote')}`);
        bySelectorHtml('#voting-info > p:nth-of-type(2)', `${this.t('vote_category')} <strong id="voted-category-display">...</strong>`);
        bySelector('#modal-voting > .modal-content > p', this.t('vote_question'));
        byId('btn-vote-yes', this.t('vote_yes'));
        byId('btn-vote-no', this.t('vote_no'));
        byId('link-privacy', this.t('privacy_link'));
        byId('link-terms', this.t('terms_link'));
        byId('btn-create-room', this.t('create_room'));
        byId('btn-join-mode', this.t('join_room_mode'));
        byId('btn-pre-time-attack', this.t('time_attack_short'));
        const partyBtn = document.getElementById('btn-party-mode');
        if (partyBtn) {
            const lock = partyBtn.querySelector('.lock-icon');
            if (lock) {
                if (partyBtn.firstChild && partyBtn.firstChild.nodeType === Node.TEXT_NODE) {
                    partyBtn.firstChild.nodeValue = `${this.t('party_mode')} `;
                } else {
                    partyBtn.prepend(document.createTextNode(`${this.t('party_mode')} `));
                }
            } else {
                partyBtn.textContent = this.t('party_mode');
            }
        }
        byId('ta-setup-title', this.t('ta_setup_title'));
        byId('ta-setup-desc', this.t('ta_setup_desc'));
        byId('btn-start-time-attack', this.t('start'));
        byId('room-id-prefix', this.t('room_id_prefix'));
        byId('btn-copy-id', this.t('copy'));
        byId('connection-status', this.t('waiting_connection'));
        byId('btn-join-room', this.t('enter'));
        byId('lobby-title', this.t('lobby_title'));
        byId('lobby-avatar-label', this.t('your_avatar'));
        byId('lobby-player-count-label', this.t('how_many_players'));
        byId('lobby-categories-title', this.t('categories'));
        byId('btn-start-game', this.t('start'));
        byId('score-label', this.t('points_label'));
        byId('result-title', this.t('result_title'));
        byId('word-label-text', this.t('word_label'));
        byId('letter-label-text', this.t('letter_label'));
        byId('points-suffix', this.t('points_word'));
        byId('btn-next-round', this.t('next_round'));
        byId('btn-quit', this.t('quit'));
        byId('ranking-title', this.t('ranking_title'));
        byId('party-record-title', this.t('party_record_title'));
        byId('party-record-prefix', this.t('smartest'));
        byId('party-record-suffix', this.t('letters_word'));
        byId('party-title', this.t('party_mode'));
        byId('party-desc', this.t('party_desc'));
        byId('party-players-label', this.t('how_many_players_short'));
        byId('party-categories-title', this.t('categories'));
        byId('btn-start-party', this.t('start_party'));
        byId('party-turn-alert', this.t('pass_phone'));
        byId('party-used-prefix', this.t('used_letters'));
        byId('party-left-prefix', this.t('players_left'));

        bySelector('#login-screen h2', this.t('login_title'));
        bySelector('#signup-screen h2', this.t('signup_title'));
        bySelector('label[for="login-email"]', this.t('email_label'));
        bySelector('label[for="login-password"]', this.t('password_label'));
        bySelector('label[for="signup-email"]', this.t('email_label'));
        bySelector('label[for="signup-password"]', this.t('password_label'));
        bySelector('label[for="signup-nick"]', this.t('nick_label'));
        byId('btn-login', this.t('login_btn'));
        byId('btn-signup', this.t('signup_btn'));
        byId('btn-guest-login', this.t('play_guest'));
        byId('btn-guest-signup', this.t('play_guest'));
        byPlaceholder('login-email', 'email@example.com');
        byPlaceholder('signup-email', 'email@example.com');
        byPlaceholder('login-password', this.language === 'pt' ? 'Sua senha' : (this.language === 'en' ? 'Your password' : 'Tu contraseña'));
        byPlaceholder('signup-password', this.language === 'pt' ? 'Mínimo 6 caracteres' : (this.language === 'en' ? 'At least 6 characters' : 'Mínimo 6 caracteres'));
        byPlaceholder('signup-nick', this.language === 'pt' ? 'Ex: JogadorMestre' : (this.language === 'en' ? 'Ex: WordMaster' : 'Ej: MaestroLetras'));
        byPlaceholder('word-input', this.t('word_placeholder'));
        byPlaceholder('input-search-friend', this.t('friend_placeholder'));
        byPlaceholder('input-join-id', this.t('join_placeholder'));
        byPlaceholder('new-category-input', this.t('new_category_placeholder'));
        byPlaceholder('party-new-category-input', this.t('new_category_placeholder'));
        byPlaceholder('input-suggestion', this.t('suggestion_placeholder'));

        bySelectorAll('#login-screen .auth-switch', (el) => {
            el.innerHTML = `${this.t('no_account')} <a href="#" id="go-to-signup">${this.t('create_account')}</a>`;
        });
        bySelectorAll('#signup-screen .auth-switch', (el) => {
            el.innerHTML = `${this.t('has_account')} <a href="#" id="go-to-login">${this.t('do_login')}</a>`;
        });
        const goToSignup = document.getElementById('go-to-signup');
        if (goToSignup) {
            goToSignup.onclick = (e) => {
                e.preventDefault();
                this.showScreen('signup');
            };
        }
        const goToLogin = document.getElementById('go-to-login');
        if (goToLogin) {
            goToLogin.onclick = (e) => {
                e.preventDefault();
                this.showScreen('login');
            };
        }

        ['btn-back-ranking', 'btn-back-about', 'btn-back-friends', 'btn-back-profile', 'btn-back-setup', 'btn-back-ta-setup', 'btn-back-party-setup', 'btn-back-settings', 'btn-back-admin']
            .forEach(id => byId(id, this.t('back')));

        const setupTitle = document.getElementById('setup-title');
        if (setupTitle && this.screens.setup && this.screens.setup.classList.contains('active')) {
            setupTitle.textContent = this.isOnline ? this.t('setup_online_title') : this.t('setup_local_title');
        }

        this.renderHowToModal();
        this.renderAboutContent();

        this.updateUIForUser();

        document.querySelectorAll('.btn-lang').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.language);
        });
    }

    renderAboutContent() {
        const el = document.getElementById('about-content');
        if (!el) return;
        el.innerHTML = getAboutContentByLang(this.language);
    }

    getHowToContent() {
        return getHowToContentByLang(this.language);
    }

    renderHowToModal() {
        const titleEl = document.querySelector('#modal-how-to h3');
        const bodyEl = document.querySelector('#modal-how-to .instructions-scroll');
        if (titleEl) titleEl.textContent = this.t('how_to_title');
        if (bodyEl) bodyEl.innerHTML = this.getHowToContent();
    }

    setupEventListeners() {
        this.ensureAdminButtonsExist();
        this.ensureAdminScreenExists();
        this.ensureAdminPanel();

        // Screen Navigation
        document.getElementById('btn-play-setup').addEventListener('click', () => this.showSetup(false));
        document.getElementById('btn-play-online').addEventListener('click', () => this.showSetup(true));
        document.getElementById('btn-party-mode').addEventListener('click', () => {
            if (!this.isMobile) {
                document.getElementById('modal-qr').style.display = 'flex';
            } else {
                this.showScreen('party-mode');
                this.showModeInstructions('party', false);
            }
        });
        this.renderPartyPlayerButtons();
        // document.getElementById('btn-play-time-attack-local').addEventListener('click', () => this.startTimeAttack());
        document.getElementById('btn-create-room').addEventListener('click', () => this.startCreatingRoom());
        document.getElementById('btn-join-mode').addEventListener('click', () => this.startJoiningMode());
        document.getElementById('btn-start-game').addEventListener('click', () => this.validateAndStart());
        document.getElementById('btn-how-to').addEventListener('click', () => this.toggleModal(true));
        document.querySelector('.close-modal').addEventListener('click', () => this.toggleModal(false));
        document.getElementById('btn-ranking').addEventListener('click', () => this.showScreen('ranking'));
        document.getElementById('btn-about').addEventListener('click', () => this.showScreen('about'));
        document.getElementById('btn-settings').addEventListener('click', () => this.showScreen('settings'));
        document.getElementById('btn-settings-home').addEventListener('click', () => this.showScreen('settings'));
        const adminHomeBtn = document.getElementById('btn-admin-home');
        if (adminHomeBtn) {
            adminHomeBtn.addEventListener('click', () => {
                this.showScreen('admin');
                this.renderAdminRewardsPanel();
            });
        }
        const adminBtn = document.getElementById('btn-admin');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                this.showScreen('admin');
                this.renderAdminRewardsPanel();
            });
        }
        const adminProfileBtn = document.getElementById('btn-open-admin-profile');
        if (adminProfileBtn) {
            adminProfileBtn.addEventListener('click', () => {
                this.showScreen('admin');
                this.renderAdminRewardsPanel();
            });
        }
        document.getElementById('btn-friends').addEventListener('click', () => {
            this.showScreen('friends');
            this.renderFriendsList();
            this.renderGlobalOnlinePlayers();
        });

        // Eventos do Modo Galera
        document.querySelectorAll('.btn-player-count').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.btn-player-count').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.partyPlayerCount = parseInt(btn.dataset.count);
            };
        });

        document.getElementById('btn-profile').addEventListener('click', () => this.showScreen('profile'));
        document.getElementById('btn-search-friend').addEventListener('click', () => this.searchAndFollowFriend());
        document.getElementById('btn-search-room-friend').addEventListener('click', () => {
            const nick = document.getElementById('input-search-friend').value.trim();
            if (!nick) return this.showFloatingMessage('Digite o nickname do host!', 'warning');
            this.joinFriendRoomByNick(nick);
        });
        document.getElementById('input-search-friend').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchAndFollowFriend();
        });
        document.getElementById('btn-update-nick').addEventListener('click', () => this.updateNickname());
        document.getElementById('sound-toggle').addEventListener('click', () => this.toggleMute());
        document.querySelectorAll('.btn-lang').forEach(btn => {
            btn.addEventListener('click', () => this.setLanguage(btn.dataset.lang));
        });
        document.getElementById('btn-send-suggestion').addEventListener('click', () => this.sendSuggestion());
        this.bindAdminPanelEvents();
        
        // Instruções de Modo
        document.getElementById('btn-close-instructions').onclick = () => {
            document.getElementById('modal-mode-instructions').style.display = 'none';
            if (this.instructionCallback) {
                this.instructionCallback();
                this.instructionCallback = null;
            }
        };
        
        const btnHelpTA = document.getElementById('btn-help-time-attack');
        if (btnHelpTA) btnHelpTA.onclick = () => this.showModeInstructions('time-attack', true);
        
        const btnHelpParty = document.getElementById('btn-help-party');
        if (btnHelpParty) btnHelpParty.onclick = () => this.showModeInstructions('party', true);
        
        const btnHelpOnline = document.getElementById('btn-help-online');
        if (btnHelpOnline) btnHelpOnline.onclick = () => this.showModeInstructions('online', true);

        const btnHelpLobby = document.getElementById('btn-help-lobby');
        if (btnHelpLobby) btnHelpLobby.onclick = () => {
            const mode = this.isOnline ? 'online' : (this.partyTimer ? 'party' : 'time-attack');
            this.showModeInstructions(mode, true);
        };

        const btnAddPartyCat = document.getElementById('btn-add-party-category');
        if (btnAddPartyCat) {
            btnAddPartyCat.onclick = () => {
                const input = document.getElementById('party-new-category-input');
                const cat = this.sanitizeCategoryName(input.value);
                if (cat) {
                    this.customCategories.add(cat);
                    input.value = '';
                    this.renderPartyCategoriesList(); // Reutiliza ou cria função de renderização
                }
            };
        }

        const btnStartParty = document.getElementById('btn-start-party');
        if (btnStartParty) btnStartParty.onclick = () => this.startPartyGame();

        // Eventos Time Attack Setup
        const btnPreTA = document.getElementById('btn-pre-time-attack');
        if (btnPreTA) btnPreTA.onclick = () => {
            const setupTitleRow = document.querySelector('#setup-screen .setup-header-row');
            if (setupTitleRow) setupTitleRow.style.display = 'none';
            
            document.getElementById('local-mode-options').style.display = 'none';
            document.getElementById('time-attack-setup').style.display = 'flex';
            this.showModeInstructions('time-attack', false);
        };

        const btnStartTA = document.getElementById('btn-start-time-attack');
        if (btnStartTA) btnStartTA.onclick = () => this.startTimeAttack();

        // Auth Navigation
        document.getElementById('go-to-signup').addEventListener('click', (e) => {
            e.preventDefault();
            this.showScreen('signup');
        });
        document.getElementById('go-to-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showScreen('login');
        });

        // Legal Modals
        document.getElementById('link-privacy').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLegalModal('privacy');
        });
        document.getElementById('link-terms').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLegalModal('terms');
        });
        document.querySelector('.close-modal-legal').addEventListener('click', () => {
            document.getElementById('modal-legal').style.display = 'none';
        });
        const friendProfileCloseBtn = document.getElementById('btn-close-friend-profile');
        if (friendProfileCloseBtn) {
            friendProfileCloseBtn.addEventListener('click', () => this.closeFriendProfile());
        }
        const friendProfileModal = document.getElementById('modal-friend-profile');
        if (friendProfileModal) {
            friendProfileModal.addEventListener('click', (event) => {
                if (event.target === friendProfileModal) this.closeFriendProfile();
            });
        }

        document.getElementById('btn-login').addEventListener('click', () => this.login());
        document.getElementById('btn-signup').addEventListener('click', () => this.signup());
        document.getElementById('btn-guest-login').addEventListener('click', () => this.playAsGuest());
        document.getElementById('btn-guest-signup').addEventListener('click', () => this.playAsGuest());
        document.getElementById('btn-logout').addEventListener('click', () => this.logout());
        
        // Botões de Voltar
        const backButtons = [
            'btn-back-ranking',
            'btn-back-about',
            'btn-back-friends',
            'btn-back-profile',
            'btn-back-admin',
            'btn-back-setup',
            'btn-back-ta-setup',
            'btn-back-party-setup',
            'btn-back-settings'
        ];
        backButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    if (id === 'btn-back-setup') {
                        // Se estiver em uma sala online (ou tentando entrar), volta para as opções online primeiro
                        const onlineInfo = document.getElementById('online-info');
                        const joinOnline = document.getElementById('join-online');
                        if (this.isOnline && (onlineInfo.style.display === 'block' || joinOnline.style.display === 'flex')) {
                            this.exitOnline(false); // Limpa peer sem ir para Home
                            this.showSetup(true); // Volta para opções de Criar/Entrar
                        } else {
                            this.exitOnline();
                            this.showScreen('home');
                        }
                    } else if (id === 'btn-back-ta-setup' || id === 'btn-back-party-setup') {
                        this.showSetup(false);
                    } else {
                        this.showScreen('home');
                    }
                });
            }
        });

        document.getElementById('btn-global-back').addEventListener('click', () => this.handleGlobalBack());
        document.getElementById('btn-quit').addEventListener('click', () => this.endGameSession());
        document.getElementById('btn-next-round').addEventListener('click', () => this.handleNextRoundBtn());
        
        // Votação
        document.getElementById('btn-vote-yes').addEventListener('click', () => this.sendVote(true));
        document.getElementById('btn-vote-no').addEventListener('click', () => this.sendVote(false));

        // Online Actions
        document.getElementById('btn-copy-id').addEventListener('click', () => this.copyRoomId());
        document.getElementById('btn-join-room').addEventListener('click', () => this.joinRoom());

        // Setup Actions
        document.getElementById('player-count').addEventListener('input', (e) => this.renderPlayerInputs(e.target.value));
        document.getElementById('btn-add-category').addEventListener('click', () => this.addNewCategory());
        document.getElementById('new-category-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addNewCategory();
        });

        // Game Actions
        document.getElementById('btn-confirm').addEventListener('click', () => this.submitWord());
        document.getElementById('word-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitWord();
        });

        // AUTO-LETTER RECOGNITION & REAL-TIME TYPING SYNC
        document.getElementById('word-input').addEventListener('input', (e) => {
            const word = e.target.value.trim().toUpperCase();
            
            // 1. Sync Typing Online
            if (this.isOnline && this.isMyTurn()) {
                this.sendData({
                    type: 'TYPING_UPDATE',
                    value: word
                });
            }

            // 2. Auto Letter Selection
            if (word.length > 0) {
                const firstLetter = word[0];
                const keyElement = Array.from(document.querySelectorAll('.key'))
                    .find(k => k.textContent === firstLetter);
                
                if (keyElement && !this.usedLetters.has(firstLetter)) {
                    this.selectLetter(firstLetter, keyElement, false);
                }
            }
        });

        // Theme Toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Sound initializations on first interaction
        document.addEventListener('click', () => this.initAudio(), { once: true });
    }

    ensureAdminButtonsExist() {
        const headerLeft = document.querySelector('header .header-left');
        if (headerLeft && !document.getElementById('btn-admin')) {
            const btn = document.createElement('button');
            btn.id = 'btn-admin';
            btn.className = 'btn-icon';
            btn.title = 'Painel ADM';
            btn.style.display = 'none';
            btn.innerHTML = '<span class="icon-settings">🛡️</span>';
            headerLeft.appendChild(btn);
        }

        const secondaryGrid = document.querySelector('#home-screen .secondary-grid');
        if (secondaryGrid && !document.getElementById('btn-admin-home')) {
            const btn = document.createElement('button');
            btn.id = 'btn-admin-home';
            btn.className = 'btn-grid';
            btn.style.display = 'none';
            btn.innerHTML = '<span class="grid-icon">🛡️</span><span class="grid-label">Painel ADM</span>';
            secondaryGrid.insertBefore(btn, secondaryGrid.firstChild);
        }
    }

    renderPartyPlayerButtons() {
        const container = document.querySelector('.player-selector');
        if (!container) return;

        const current = this.partyPlayerCount || 2;
        container.innerHTML = '';
        for (let i = 2; i <= this.maxPartyPlayers; i++) {
            const btn = document.createElement('button');
            btn.className = `btn-player-count ${i === current ? 'active' : ''}`;
            btn.dataset.count = String(i);
            btn.textContent = String(i);
            btn.onclick = () => {
                container.querySelectorAll('.btn-player-count').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.partyPlayerCount = i;
            };
            container.appendChild(btn);
        }
    }

    setupVisibilityHandlers() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseForExternalEvent();
                return;
            }
            this.resumeAfterExternalEvent();
        });

        window.addEventListener('blur', () => this.pauseForExternalEvent());
        window.addEventListener('focus', () => this.resumeAfterExternalEvent());
    }

    getActiveScreenName() {
        return Object.keys(this.screens).find((key) =>
            this.screens[key] && this.screens[key].classList.contains('active')
        ) || 'home';
    }

    syncCrazyGameplayByScreen(screenName = this.getActiveScreenName()) {
        const partyGameplay = document.getElementById('party-gameplay');
        const isPartyPlaying = screenName === 'party-mode' && partyGameplay && partyGameplay.style.display === 'block';
        const isPlaying = screenName === 'game' || isPartyPlaying;

        if (isPlaying) {
            this.crazyBridge.gameplayStart();
            return;
        }
        this.crazyBridge.gameplayStop();
    }

    maybeShowQuickStartOnHome() {
        const key = 'versus-letra-seen-quickstart';
        if (localStorage.getItem(key) === 'true') return;

        const modal = document.getElementById('modal-mode-instructions');
        const title = document.getElementById('instruction-title');
        const body = document.getElementById('instruction-body');
        if (!modal || !title || !body) return;

        const texts = {
            pt: {
                title: 'Boas-vindas ao VersusLetra 👋',
                body: '<ul><li>1. Escolha um modo e comece rápido.</li><li>2. Categoria + letra: responda antes do tempo.</li><li>3. Errou ou o tempo acabou? Você pode ser eliminado.</li></ul>'
            },
            en: {
                title: 'Welcome to VersusLetra 👋',
                body: '<ul><li>1. Pick a mode and start fast.</li><li>2. Category + letter: answer before time runs out.</li><li>3. Mistake or timeout? You may be eliminated.</li></ul>'
            },
            es: {
                title: 'Bienvenido a VersusLetra 👋',
                body: '<ul><li>1. Elige un modo y empieza rápido.</li><li>2. Categoría + letra: responde antes del tiempo.</li><li>3. Error o tiempo agotado: puedes quedar eliminado.</li></ul>'
            }
        };

        const locale = texts[this.language] || texts.pt;
        title.innerHTML = locale.title;
        body.innerHTML = locale.body;
        modal.style.display = 'flex';
        localStorage.setItem(key, 'true');
    }

    pauseForExternalEvent() {
        if (this.externalPauseActive) return;
        this.externalPauseActive = true;

        this.wasMainTimerRunning = Boolean(this.timer);
        this.wasPartyTimerRunning = Boolean(this.partyTimer);

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        if (this.partyTimer) {
            clearInterval(this.partyTimer);
            this.partyTimer = null;
        }

        this.wasAudioRunning = Boolean(this.audioCtx && this.audioCtx.state === 'running');
        if (this.wasAudioRunning) {
            this.audioCtx.suspend().catch(() => {});
        }
    }

    resumeAfterExternalEvent() {
        if (!this.externalPauseActive) return;
        this.externalPauseActive = false;

        const activeScreen = this.getActiveScreenName();
        const partyGameplay = document.getElementById('party-gameplay');

        if (this.wasMainTimerRunning && activeScreen === 'game' && !this.isGameOver) {
            this.startTimer();
        }

        if (
            this.wasPartyTimerRunning &&
            activeScreen === 'party-mode' &&
            partyGameplay &&
            partyGameplay.style.display === 'block' &&
            this.partyPlayersLeft > 1
        ) {
            this.startPartyTimer();
        }

        if (this.wasAudioRunning && this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }

        this.wasMainTimerRunning = false;
        this.wasPartyTimerRunning = false;
        this.wasAudioRunning = false;
    }

    showLegalModal(type) {
        const modal = document.getElementById('modal-legal');
        const content = document.getElementById('legal-text-content');
        content.innerHTML = getLegalModalHtml(this.language, type);
        modal.style.display = 'flex';
    }

    startTimeAttack() {
        const startLogic = () => {
            this.isTimeAttack = true;
            this.isOnline = false;
            this.players = [{
                id: 'solo-player',
                name: this.getDisplayName(),
                avatar: this.myAvatar,
                score: 0,
                active: true
            }];
            this.currentPlayerIndex = 0;
            this.timeLeft = 60; // 1 minuto total
            this.usedLetters.clear();
            this.isGameOver = false;
            
            this.timeAttackCategories = ['Animal', 'Fruta', 'Objeto', 'Cor', 'Profissão', 'Comida', 'Esporte', 'Parte do corpo', 'Bebida', 'Sobremesa', 'Instrumento Musical', 'Nome'];
            this.currentCategory = this.timeAttackCategories[Math.floor(Math.random() * this.timeAttackCategories.length)];
            
            this.showScreen('game');
            this.startTimer();
            this.startRound();
            
            document.getElementById('timer-label').textContent = this.t('timer_left');
            document.getElementById('current-player-name').textContent = this.t('time_attack_mode_name');
        };

        // Verifica se é a primeira vez antes de executar a lógica de início
        if (!localStorage.getItem('versus-letra-seen-time-attack')) {
            this.showModeInstructions('time-attack', false, startLogic);
        } else {
            startLogic();
        }
    }

    // --- Online Logic ---
    showSetup(isOnline) {
        this.isOnline = isOnline;
        this.showScreen('setup');
        
        const setupTitleRow = document.querySelector('#setup-screen .setup-header-row');
        const setupTitle = document.getElementById('setup-title');
        const onlineOptions = document.getElementById('online-options');
        const localOptions = document.getElementById('local-mode-options');
        const onlineInfo = document.getElementById('online-info');
        const joinOnline = document.getElementById('join-online');
        const lobbySetup = document.getElementById('lobby-setup');
        const taSetup = document.getElementById('time-attack-setup');
        const playerCountInput = document.getElementById('player-count');
        const btnStart = document.getElementById('btn-start-game');

        // Reset all sub-views in setup screen
        if (setupTitleRow) setupTitleRow.style.display = 'flex';
        if (onlineInfo) onlineInfo.style.display = 'none';
        if (joinOnline) joinOnline.style.display = 'none';
        if (lobbySetup) lobbySetup.style.display = 'none';
        if (taSetup) taSetup.style.display = 'none';

        if (isOnline) {
            setupTitle.textContent = this.t('setup_online_title');
            onlineOptions.style.display = 'grid';
            localOptions.style.display = 'none';
            if (document.getElementById('btn-help-online')) {
                document.getElementById('btn-help-online').style.display = 'flex';
            }
            
            // Show instructions only the first time for Online Mode
            this.showModeInstructions('online', false);
        } else {
            setupTitle.textContent = this.t('setup_local_title');
            onlineOptions.style.display = 'none';
            localOptions.style.display = 'grid';
            if (document.getElementById('btn-help-online')) {
                document.getElementById('btn-help-online').style.display = 'none';
            }
            this.players = [];
        }

        this.renderPlayerInputs(document.getElementById('player-count').value);
        this.renderCategoriesList();
        this.renderAvatarPicker(); 
    }

    startCreatingRoom() {
        const setupTitleRow = document.querySelector('#setup-screen .setup-header-row');
        if (setupTitleRow) setupTitleRow.style.display = 'none';

        document.getElementById('online-options').style.display = 'none';
        document.getElementById('online-info').style.display = 'block';
        document.getElementById('room-id').textContent = 'GERANDO...';
        
        const lobbySetup = document.getElementById('lobby-setup');
        if (lobbySetup) lobbySetup.style.display = 'flex';
        
        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) {
            btnStart.style.display = 'block';
            btnStart.textContent = this.t('waiting_friends');
            btnStart.disabled = true;
        }
        this.initPeer(true); // true = isHost
        this.renderChat();
    }

    startJoiningMode() {
        const setupTitleRow = document.querySelector('#setup-screen .setup-header-row');
        if (setupTitleRow) setupTitleRow.style.display = 'none';

        document.getElementById('online-options').style.display = 'none';
        document.getElementById('join-online').style.display = 'flex';
        
        const lobbySetup = document.getElementById('lobby-setup');
        if (lobbySetup) lobbySetup.style.display = 'flex';
        
        this.initPeer(false); // false = isHost
    }

    renderChat() {
        const lobbySetup = document.getElementById('lobby-setup');
        if (!lobbySetup) return;
        
        let chatContainer = document.getElementById('lobby-chat');
        
        if (!chatContainer) {
            chatContainer = document.createElement('div');
            chatContainer.id = 'lobby-chat';
            chatContainer.className = 'chat-container';
            chatContainer.innerHTML = `
                <div class="chat-messages" id="chat-messages"></div>
                <div class="chat-input-area">
                    <input type="text" id="chat-input" placeholder="Diga oi para o grupo...">
                    <button id="btn-send-chat" class="btn-primary">ENVIAR</button>
                </div>
            `;
            lobbySetup.appendChild(chatContainer);

            document.getElementById('btn-send-chat').onclick = () => this.sendChatMessage();
            document.getElementById('chat-input').onkeypress = (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            };
        }
        document.getElementById('chat-messages').innerHTML = '';
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const text = this.sanitizeChatText(input.value);
        if (!text) return;

        const myName = this.sanitizePlayerName(this.players.find(p => p.id === this.myPlayerId)?.name, 'Eu');
        const msg = { name: myName, text, avatar: this.sanitizeAvatar(this.myAvatar) };
        
        this.addChatMessage(msg);
        if (this.isOnline) {
            this.sendData({ type: 'CHAT_MSG', msg: msg });
        }
        input.value = '';
    }

    addChatMessage(msg) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'chat-msg';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = `${this.sanitizeAvatar(msg?.avatar)} ${this.sanitizePlayerName(msg?.name, 'Jogador')}:`;
        div.appendChild(nameSpan);
        div.appendChild(document.createTextNode(` ${this.sanitizeChatText(msg?.text)}`));
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    initPeer(isHost) {
        if (this.peer) return;

        // Se for Host, tentamos usar um ID de 6 dígitos. Se falhar, o PeerJS gera um automático.
        const shortId = isHost ? Math.floor(100000 + Math.random() * 900000).toString() : null;
        
        try {
            this.peer = shortId ? new Peer(shortId) : new Peer();
            
            this.peer.on('open', (id) => {
                this.myPlayerId = id;
                if (isHost) {
                    document.getElementById('room-id').textContent = id;
                    this.isHost = true;
                    this.players = [{
                        id: id,
                        name: 'Jogador Host',
                        avatar: this.myAvatar,
                        score: 0,
                        active: true
                    }];
                    this.renderPlayerInputs();
                } else {
                    this.isHost = false;
                }
            });

            this.peer.on('connection', (conn) => {
                this.conns.push(conn);
                this.setupConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                
                // Se o ID de 6 dígitos já existir, tenta outro
                if (err.type === 'unavailable-id' && isHost) {
                    this.peer.destroy();
                    this.peer = null;
                    this.initPeer(true);
                    return;
                }
                
                // Erros de conexão
                if (err.type === 'peer-disconnected' || err.type === 'network') {
                    return; // Ignora reconexões temporárias
                }

                this.showFloatingMessage('Erro na conexão online: ' + err.type, 'error');
                this.exitOnline();
            });
        } catch (e) {
            console.error('Peer creation failed', e);
            this.showFloatingMessage('Não foi possível iniciar o modo online.', 'error');
            this.exitOnline();
        }
    }

    async joinRoom() {
        let id = document.getElementById('input-join-id').value.trim();
        if (!id) {
            this.showFloatingMessage('Digite o código ou nick do Host!', 'warning');
            return;
        }

        if (!this.peer || !this.peer.open) {
            this.showFloatingMessage('Aguardando rede... Tente novamente.', 'info');
            return;
        }

        // Se o ID não for um número de 6 dígitos, tentamos buscar como Nickname no banco
        if (!/^\d{6}$/.test(id) && id.length > 2) {
            this.showFloatingMessage(`Buscando sala de "${id}"...`, 'info');
            const { data: hostProfile, error } = await this.supabase
                .from('profiles')
                .select('current_room')
                .ilike('nickname', id)
                .maybeSingle();

            if (error || !hostProfile || !hostProfile.current_room) {
                this.showFloatingMessage('Sala não encontrada para este nickname.', 'error');
                return;
            }
            id = hostProfile.current_room;
        }

        id = this.sanitizePeerId(id);
        if (!id) {
            this.showFloatingMessage('ID da sala inválido.', 'error');
            return;
        }

        const conn = this.peer.connect(id);
        this.conns = [conn];
        this.setupConnection(conn);
    }

    setupConnection(conn) {
        conn.on('open', () => {
            if (this.isOnline && !this.isHost) {
                document.getElementById('join-online').style.display = 'none';
                this.renderChat();
            }
            
            if (!this.isHost) {
                // Envia meu Nickname ou nome de convidado para o Host
                const myName = this.sanitizePlayerName(this.getDisplayName(), 'Jogador');
                conn.send({
                    type: 'PLAYER_JOINED',
                    id: this.myPlayerId,
                    name: myName,
                    avatar: this.sanitizeAvatar(this.myAvatar)
                });
            }

            this.playSound('success');
        });

        conn.on('data', (data) => {
            this.handleRemoteData(data, conn);
        });

        conn.on('close', () => {
            if (this.isHost) {
                this.conns = this.conns.filter(c => c !== conn);
                if (conn.peerId) {
                    this.players = this.players.filter(p => p.id !== conn.peerId);
                    this.syncLobby();
                }
            } else {
                if (this.wasRoomFull) {
                    this.wasRoomFull = false;
                    return;
                }
                this.showFloatingMessage('O Host desconectou.', 'error');
                this.exitOnline();
            }
        });
    }

    handleRemoteData(data, conn) {
        if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
        const senderId = this.sanitizePeerId(conn?.peer || conn?.peerId || '');

        switch (data.type) {
            case 'PLAYER_JOINED':
                if (this.isHost) {
                    const claimedId = this.sanitizePeerId(data.id);
                    if (!claimedId || (senderId && claimedId !== senderId)) return;
                    if (this.players.length >= this.maxOnlinePlayers) {
                        conn.send({ type: 'ROOM_FULL' });
                        if (conn.open) conn.close();
                        return;
                    }
                    if (this.players.some((player) => player.id === claimedId)) return;

                    conn.peerId = claimedId;
                    this.players.push({
                        id: claimedId,
                        name: this.sanitizePlayerName(data.name),
                        avatar: this.sanitizeAvatar(data.avatar),
                        score: 0,
                        active: true
                    });
                    this.syncLobby();
                }
                break;
            case 'ROOM_FULL':
                this.wasRoomFull = true;
                this.showFloatingMessage(`Sala cheia (máximo ${this.maxOnlinePlayers} jogadores).`, 'error');
                this.exitOnline(false);
                this.showSetup(true);
                break;
            case 'SYNC_LOBBY':
                if (this.isHost) break;
                this.players = this.sanitizeIncomingPlayers(data.players);
                if (data.roomId) {
                    document.getElementById('room-id').textContent = this.sanitizePeerId(data.roomId);
                    document.getElementById('online-info').style.display = 'block';
                }
                this.renderPlayerInputs();
                break;
            case 'KICKED':
                this.showFloatingMessage('Você foi expulso da sala pelo Host.', 'error');
                this.exitOnline();
                break;
            case 'NAME_CHANGE':
                if (this.isHost) {
                    const targetId = this.sanitizePeerId(data.id);
                    if (!targetId || (senderId && targetId !== senderId)) return;
                    const player = this.players.find(p => p.id === targetId);
                    if (player) {
                        player.name = this.sanitizePlayerName(data.name);
                        this.syncLobby();
                    }
                }
                break;
            case 'AVATAR_CHANGE':
                if (this.isHost) {
                    const targetId = this.sanitizePeerId(data.id);
                    if (!targetId || (senderId && targetId !== senderId)) return;
                    const player = this.players.find(p => p.id === targetId);
                    if (player) {
                        player.avatar = this.sanitizeAvatar(data.avatar);
                        this.syncLobby();
                    }
                }
                break;
            case 'START_GAME':
                if (this.isHost) break;
                this.players = this.sanitizeIncomingPlayers(data.players);
                if (Array.isArray(data.categories)) {
                    const incomingCategories = data.categories
                        .map((category) => this.sanitizeCategoryName(category))
                        .filter(Boolean);
                    this.categories = incomingCategories.length > 0 ? incomingCategories : [...this.defaultCategories];
                }
                this.currentPlayerIndex = data.currentPlayerIndex;
                this.currentCategory = this.sanitizeCategoryName(data.currentCategory) || this.currentCategory;
                this.usedLetters = new Set(Array.isArray(data.usedLetters) ? data.usedLetters : []);
                this.startRound();
                break;
            case 'SUBMIT_WORD':
                this.remoteSubmitWord(data);
                break;
            case 'NEXT_TURN':
                if (this.isHost) break;
                this.currentPlayerIndex = data.currentPlayerIndex;
                this.currentCategory = this.sanitizeCategoryName(data.currentCategory) || this.currentCategory;
                this.usedLetters = new Set(Array.isArray(data.usedLetters) ? data.usedLetters : []);
                this.startRound();
                break;
            case 'TIMEOUT':
                if (this.isHost) {
                    this.broadcast({ type: 'TIMEOUT' });
                }
                this.remoteTimeout();
                break;
            case 'TYPING_UPDATE':
                if (typeof data.value !== 'string') return;
                const typingDisplay = document.getElementById('remote-typing-display');
                const currentPlayer = this.players[this.currentPlayerIndex];
                if (!typingDisplay || !currentPlayer) break;
                if (data.value) {
                    const safeTyping = this.sanitizeChatText(data.value);
                    typingDisplay.textContent = `${currentPlayer.name} digitando: ${safeTyping}`;
                } else {
                    typingDisplay.textContent = '';
                }
                break;
            case 'SYNC_SCORES':
                this.players = data.players;
                break;
            case 'RETURN_TO_LOBBY':
                this.processReturnToLobby();
                break;
            case 'STOP_TIMER':
                clearInterval(this.timer);
                document.getElementById('timer-value').textContent = '--';
                break;
            case 'START_VOTE':
                this.currentVote = {
                    active: true,
                    yes: 0,
                    no: 0,
                    voters: new Set(),
                    targetPlayerId: data.playerId,
                    word: data.word,
                    category: data.category
                };
                // Sincroniza a letra para que o Host e outros tenham a mesma referência
                this.selectedLetter = data.letter;
                
                const sender = this.players.find(p => p.id === data.playerId);
                const isMe = data.playerId === this.myPlayerId;
                this.showVotingModal(data.word, data.category, sender ? sender.name : 'Jogador', isMe);
                break;
            case 'SUBMIT_VOTE':
                // Se eu sou o Host, eu gerencio a votação
                if (this.isHost) {
                    this.handleVote(data.vote, data.voterId);
                    // Broadcast do voto para todos saberem o progresso (opcional, mas bom para sincronia)
                    this.broadcast({
                        type: 'VOTE_UPDATE',
                        voterId: data.voterId,
                        vote: data.vote
                    });
                }
                break;
            case 'VOTE_UPDATE':
                // Peers recebem atualização do Host
                if (!this.isHost) {
                    this.handleVote(data.vote, data.voterId);
                }
                break;
            case 'CHAT_MSG':
                if (!data.msg || typeof data.msg !== 'object') return;
                this.addChatMessage({
                    name: this.sanitizePlayerName(data.msg.name),
                    text: this.sanitizeChatText(data.msg.text),
                    avatar: this.sanitizeAvatar(data.msg.avatar)
                });
                break;
        }
    }

    syncLobby() {
        if (this.isHost) {
            // Garante que o nome do Host no array de jogadores seja o Nickname/Nome atualizado
            const hostPlayer = this.players.find(p => p.id === this.myPlayerId);
            if (hostPlayer) {
                hostPlayer.name = this.getDisplayName();
                hostPlayer.avatar = this.myAvatar;
            }

            this.broadcast({
                type: 'SYNC_LOBBY',
                players: this.players,
                roomId: this.myPlayerId
            });
            this.renderPlayerInputs();
            
            // Host can start if at least 1 more player joined
            const btnStart = document.getElementById('btn-start-game');
            if (this.players.length >= 2) {
                btnStart.disabled = false;
                btnStart.textContent = 'COMEÇAR JOGO!';
            } else {
                btnStart.disabled = true;
                btnStart.textContent = 'AGUARDANDO AMIGOS...';
            }
        }
    }

    kickPlayer(playerId) {
        if (!this.isHost) return;
        
        // Find connection for this player
        // PeerJS connections can have the peer ID in conn.peer
        const conn = this.conns.find(c => c.peer === playerId || c.peerId === playerId);
        if (conn) {
            conn.send({ type: 'KICKED' });
            // Dá um tempo para a mensagem chegar antes de fechar
            setTimeout(() => {
                if (conn.open) conn.close();
            }, 500);
        }
        
        // Remove do array local do Host
        this.players = this.players.filter(p => p.id !== playerId);
        this.conns = this.conns.filter(c => (c.peer !== playerId && c.peerId !== playerId));
        this.syncLobby();
        this.playSound('error');
    }

    broadcast(data) {
        this.conns.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    sendData(data) {
        // Peer sends to Host, Host broadcasts to everyone
        if (this.isHost) {
            this.broadcast(data);
        } else if (this.conns[0] && this.conns[0].open) {
            this.conns[0].send(data);
        }
    }

    copyRoomId() {
        const id = document.getElementById('room-id').textContent;
        navigator.clipboard.writeText(id);
        this.showFloatingMessage('ID copiado!', 'success');
    }

    exitOnline(goToHome = true) {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.conns = [];
        this.isOnline = false;
        this.isGameOver = false;
        if (goToHome) this.showScreen('home');
    }

    // --- Supabase Auth ---
    async checkSession() {
        return checkSessionModule(this);
    }

    async signup() {
        return signupModule(this);
    }

    async login() {
        return loginModule(this);
    }

    async updateNickname() {
        return updateNicknameModule(this);
    }

    async sendSuggestion() {
        return sendSuggestionModule(this);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('versus-letra-muted', this.isMuted);
        
        const onIcon = document.querySelector('.icon-sound-on');
        const offIcon = document.querySelector('.icon-sound-off');
        
        if (this.isMuted) {
            onIcon.style.display = 'none';
            offIcon.style.display = 'inline';
        } else {
            onIcon.style.display = 'inline';
            offIcon.style.display = 'none';
        }
        this.playSound('click');
    }

    playAsGuest() {
        this.user = null;
        this.isGuest = true;
        localStorage.setItem('versus-letra-guest', 'true');
        this.xp = Number(localStorage.getItem('versus-letra-guest-xp')) || 0;
        this.level = Number(localStorage.getItem('versus-letra-guest-level')) || 1;
        this.isDataLoaded = true; // Dados de convidado carregados do localstorage
        this.updateUIForUser();
        this.showScreen('home');
    }

    startCrazyGamesOnboarding() {
        if (!this.crazyBridge?.isCrazyGames) return;

        const key = 'versus-letra-cg-autostart-done';
        if (localStorage.getItem(key) === 'true') return;

        localStorage.setItem(key, 'true');
        this.startTimeAttack();
    }

    async logout() {
        return logoutModule(this);
    }

    // Auxiliar para pegar o melhor nome disponível
    getDisplayName() {
        if (!this.user) return this.isGuest ? 'Convidado' : 'Jogador';
        // Ordem de prioridade: 1. Nickname do Banco, 2. Nickname do Meta, 3. Prefixo do Email
        const rawName = this.user.nickname || 
               (this.user.user_metadata && this.user.user_metadata.nickname) || 
               this.user.email.split('@')[0];
        return this.sanitizePlayerName(rawName, 'Jogador');
    }

    isCurrentUserAdmin() {
        if (!this.user) return false;
        const app = this.user.app_metadata || {};
        const meta = this.user.user_metadata || {};
        return Boolean(
            this.user.is_admin === true ||
            app.is_admin === true ||
            app.admin === true ||
            meta.is_admin === true ||
            meta.admin === true ||
            String(app.role || '').toLowerCase() === 'admin' ||
            String(meta.role || '').toLowerCase() === 'admin'
        );
    }

    updateUIForUser() {
        if (!this.isDataLoaded) return; // Não atualiza se os dados não carregaram
        
        const userInfo = document.getElementById('user-info');
        const userDisplayName = document.getElementById('user-display-name');
        const logoutBtn = document.getElementById('btn-logout');
        const profileBtn = document.getElementById('btn-profile');
        const adminBtn = document.getElementById('btn-admin');
        const adminHomeBtn = document.getElementById('btn-admin-home');
        const profileAdminShortcut = document.getElementById('profile-admin-shortcut');
        const userLevel = document.getElementById('user-level');
        const xpFill = document.getElementById('user-xp-fill');

        if (this.user || this.isGuest) {
            userInfo.style.display = 'flex';
            
            // Garante que o avatar atual está desbloqueado para o nível
            const unlocked = this.getUnlockedAvatars();
            if (!unlocked.includes(this.myAvatar)) {
                this.myAvatar = unlocked[0];
            }

            if (this.user) {
                const nameToShow = this.getDisplayName();
                // Adiciona selo de ADM se for o caso
                const adminBadge = this.isCurrentUserAdmin() ? ' <span style="font-size:0.6em; background:gold; color:black; padding:2px 5px; border-radius:5px; vertical-align:middle;">ADM</span>' : '';
                userDisplayName.innerHTML = nameToShow + adminBadge;
                userDisplayName.style.color = this.selectedColor;
                logoutBtn.textContent = this.t('logout');
                profileBtn.style.display = 'block';
                const isAdmin = this.isCurrentUserAdmin();
                if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
                if (adminHomeBtn) adminHomeBtn.style.display = isAdmin ? 'flex' : 'none';
                if (profileAdminShortcut) profileAdminShortcut.style.display = isAdmin ? 'block' : 'none';
            } else {
                userDisplayName.textContent = this.t('guest');
                userDisplayName.style.color = 'var(--primary-color)';
                logoutBtn.textContent = this.t('login_action');
                profileBtn.style.display = 'none';
                if (adminBtn) adminBtn.style.display = 'none';
                if (adminHomeBtn) adminHomeBtn.style.display = 'none';
                if (profileAdminShortcut) profileAdminShortcut.style.display = 'none';
            }
            
            // Level and XP UI
            if (userLevel) userLevel.textContent = this.level;
            if (xpFill) {
                const xpNeeded = this.level * 100;
                const percent = Math.min((this.xp / xpNeeded) * 100, 100);
                xpFill.style.width = `${percent}%`;
            }
            
            // Preenche o campo de edição no perfil com o nome atual (se logado)
            if (this.user) {
                const profileInput = document.getElementById('profile-nick');
                if (profileInput) profileInput.value = this.user.nickname || '';

                // Atualiza estatísticas se existirem no objeto user
                if (this.user.stats) {
                    const statGames = document.getElementById('stat-games');
                    const statWins = document.getElementById('stat-wins');
                    const statRecord = document.getElementById('stat-record');
                    if (statGames) statGames.textContent = this.user.stats.games_played || 0;
                    if (statWins) statWins.textContent = this.user.stats.games_won || 0;
                    if (statRecord) statRecord.textContent = this.user.stats.high_score || 0;
                }

                // Renderiza grid de conquistas mini no perfil
                this.renderAchievementsGrid('profile-achievements-grid');
                this.renderCustomizationPickers();
                this.renderAdminRewardsPanel();
            }

        } else {
            userInfo.style.display = 'none';
            profileBtn.style.display = 'none';
            if (adminBtn) adminBtn.style.display = 'none';
            if (adminHomeBtn) adminHomeBtn.style.display = 'none';
            if (profileAdminShortcut) profileAdminShortcut.style.display = 'none';
            this.renderAdminRewardsPanel();
        }
    }

    getUnlockedAvatars() {
        const allAvatars = (this.rewards?.avatars || []).map((avatar) => avatar.char);
        if (allAvatars.length === 0) return ['👤'];

        const isAdmin = this.isCurrentUserAdmin();
        if (isAdmin) {
            this.unlockedItems.avatars = [...allAvatars];
            return allAvatars;
        }

        const unlockedByLevel = (this.rewards?.avatars || [])
            .filter((avatar) => this.level >= avatar.level)
            .map((avatar) => avatar.char);

        const savedUnlocked = Array.isArray(this.unlockedItems?.avatars)
            ? this.unlockedItems.avatars
            : [];

        const merged = [...new Set([...unlockedByLevel, ...savedUnlocked])]
            .filter((avatar) => allAvatars.includes(avatar));

        if (!merged.length) merged.push(allAvatars[0]);
        this.unlockedItems.avatars = merged;
        return merged;
    }

    renderAvatarPicker() {
        const container = document.getElementById('avatar-picker');
        if (!container) return;

        container.innerHTML = '';
        const unlockedAvatars = this.getUnlockedAvatars();

        if (!unlockedAvatars.includes(this.myAvatar)) {
            this.myAvatar = unlockedAvatars[0];
        }

        unlockedAvatars.forEach((avatar) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `avatar-option ${this.myAvatar === avatar ? 'selected' : ''}`;
            btn.textContent = avatar;
            btn.title = 'Selecionar avatar';
            btn.onclick = () => {
                this.myAvatar = avatar;
                this.renderAvatarPicker();
                this.renderPlayerInputs(document.getElementById('player-count')?.value || this.players.length || 1);
                this.saveUserData();
                this.playSound('click');
            };
            container.appendChild(btn);
        });
    }

    renderCustomizationPickers() {
        // Avatar Picker
        const avatarContainer = document.getElementById('profile-avatar-picker');
        if (avatarContainer) {
            avatarContainer.innerHTML = '';
            const isAdmin = this.isCurrentUserAdmin();
            this.rewards.avatars.forEach(avatar => {
                const isLocked = !isAdmin && this.level < avatar.level;
                const div = document.createElement('div');
                div.className = `theme-option ${isLocked ? 'locked' : ''} ${this.myAvatar === avatar.char ? 'selected' : ''}`;
                div.textContent = avatar.char;
                div.title = isLocked ? `Desbloqueia no nível ${avatar.level}` : (isAdmin ? 'Admin: Desbloqueado' : 'Selecionar');
                
                if (!isLocked) {
                    div.onclick = () => {
                        this.myAvatar = avatar.char;
                        this.renderCustomizationPickers();
                        this.saveUserData();
                        this.playSound('click');
                    };
                }
                avatarContainer.appendChild(div);
            });
        }

        // Color Picker
        const colorContainer = document.getElementById('nick-color-picker');
        if (colorContainer) {
            colorContainer.innerHTML = '';
            const isAdmin = this.isCurrentUserAdmin();
            this.rewards.colors.forEach(color => {
                const isLocked = !isAdmin && this.level < color.level;
                const div = document.createElement('div');
                div.className = `color-option ${isLocked ? 'locked' : ''} ${this.selectedColor === color.hex ? 'selected' : ''}`;
                div.style.backgroundColor = color.hex;
                div.title = isLocked ? `Desbloqueia no nível ${color.level}` : (isAdmin ? 'Admin: Desbloqueado' : 'Selecionar');
                
                if (!isLocked) {
                    div.onclick = () => {
                        this.selectedColor = color.hex;
                        this.updateUIForUser();
                        this.saveUserData();
                        this.playSound('click');
                    };
                }
                colorContainer.appendChild(div);
            });
        }

        // Theme Picker
        const themeContainer = document.getElementById('theme-picker');
        if (themeContainer) {
            themeContainer.innerHTML = '';
            const isAdmin = this.isCurrentUserAdmin();
            this.rewards.themes.forEach(theme => {
                const isLocked = !isAdmin && this.level < theme.level;
                const div = document.createElement('div');
                div.className = `theme-option ${isLocked ? 'locked' : ''} ${this.selectedTheme === theme.id ? 'selected' : ''}`;
                div.textContent = theme.icon;
                div.title = isLocked ? `Desbloqueia no nível ${theme.level}` : (isAdmin ? `Admin: ${theme.name}` : theme.name);
                
                if (!isLocked) {
                    div.onclick = () => {
                        this.applyTheme(theme.id);
                        this.saveUserData();
                        this.playSound('click');
                    };
                }
                themeContainer.appendChild(div);
            });
        }
    }

    applyTheme(themeId, options = {}) {
        const { silent = false } = options;
        this.clearAdminThemePreview({ silent: true });
        const isAdmin = this.isCurrentUserAdmin();
        const targetTheme = (this.rewards?.themes || []).find((theme) => theme.id === themeId);
        if (targetTheme && !isAdmin && this.level < targetTheme.level) {
            this.selectedTheme = 'default';
            if (!silent) {
                this.showFloatingMessage(`Tema bloqueado. Libera no nível ${targetTheme.level}.`, 'warning');
            }
            themeId = 'default';
        }

        this.selectedTheme = themeId;
        // Remove todos os temas de recompensa antigos sem tocar no modo claro/escuro
        const rewardThemeClasses = (this.rewards?.themes || [])
            .map((theme) => theme.id)
            .filter((id) => id && id !== 'default');
        if (rewardThemeClasses.length) {
            document.body.classList.remove(...rewardThemeClasses);
        }
        // Limpa variáveis de tema custom anterior.
        if (this.activeThemeVarKeys.length) {
            this.activeThemeVarKeys.forEach((cssVar) => document.documentElement.style.removeProperty(cssVar));
            this.activeThemeVarKeys = [];
        }
        // Aplica o novo se não for o default
        if (themeId !== 'default') {
            document.body.classList.add(themeId);
        }
        if (targetTheme?.vars && typeof targetTheme.vars === 'object') {
            this.activeThemeVarKeys = Object.keys(targetTheme.vars);
            this.activeThemeVarKeys.forEach((cssVar) => {
                document.documentElement.style.setProperty(cssVar, targetTheme.vars[cssVar]);
            });
        }

        if (themeId === 'theme-teia-urbana') {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            localStorage.setItem('versus-letra-theme-mode', 'dark');
        }

        this.renderCustomizationPickers();
    }

    async loadUserData() {
        return loadUserDataModule(this);
    }

    async addXP(amount) {
        return addXPModule(this, amount);
    }

    async saveUserData() {
        return saveUserDataModule(this);
    }

    getAchievementCatalog() {
        return [
            { id: 'dicionario', name: 'Dicionário Vivo', icon: '📚', desc: 'Acertou palavra com 10+ letras' },
            { id: 'flash', name: 'Velocidade Flash', icon: '⚡', desc: 'Respondeu em menos de 3s' },
            { id: 'invencivel_badge', name: 'Invencível', icon: '🔥', desc: 'Venceu 3 partidas seguidas' },
            { id: 'maratonista', name: 'Maratonista', icon: '🏃', desc: '10 Partidas' },
            { id: 'maratonista_pro', name: 'Lenda das Letras', icon: '👑', desc: '50 Partidas' },
            { id: 'vitoria_perfeita', name: 'Vitória Perfeita', icon: '💎', desc: 'Vencer sem errar' },
            { id: 'colecionador', name: 'Colecionador', icon: '🎁', desc: '5+ Itens' },
            { id: 'colecionador_pro', name: 'Arquivista', icon: '📦', desc: '15+ Itens' },
            { id: 'mestre_letras', name: 'Mestre Letras', icon: '🎓', desc: 'Palavra 8+ letras' },
            { id: 'mestre_letras_pro', name: 'Escriba Real', icon: '📜', desc: 'Palavra 12+ letras' },
            { id: 'estrategista_medal', name: 'Estrategista', icon: '🧠', desc: '20+ Power-ups' },
            { id: 'estrategista_pro', name: 'Mestre Tático', icon: '🎯', desc: '50+ Power-ups' },
            { id: 'veloz_furioso', name: 'Veloz e Furioso', icon: '🏎️', desc: 'Respondeu < 3s' },
            { id: 'veloz_furioso_pro', name: 'Sônico', icon: '🌀', desc: 'Respondeu < 2s' },
            { id: 'veterano', name: 'Veterano', icon: '🎖️', desc: 'Nível 10+' },
            { id: 'veterano_pro', name: 'Ancião', icon: '👴', desc: 'Nível 25+' },
            { id: 'rei_da_sala_medal', name: 'Rei da Sala', icon: '🏰', desc: '5 vitórias como Host' },
            { id: 'rei_da_sala_pro', name: 'Imperador', icon: '🔱', desc: '20 vitórias como Host' },
            { id: 'pioneiro', name: 'Pioneiro', icon: '🛰️', desc: '1ª Vitória Online' },
            { id: 'pioneiro_pro', name: 'Explorador', icon: '🌎', desc: '10 Vitórias Online' },
            { id: 'socialite', name: 'Socialite', icon: '🤝', desc: 'Seguir 10+ jogadores' },
            { id: 'perfeccionista', name: 'Perfeccionista', icon: '✨', desc: '10 vitórias perfeitas' }
        ];
    }

    renderAchievementsGrid(containerId, achievementData = this.achievements, isAdmin = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const adminMode = (isAdmin === null) ? this.isCurrentUserAdmin() : Boolean(isAdmin);

        container.innerHTML = '';
        const badges = this.getAchievementCatalog();

        badges.forEach(badge => {
            const isUnlocked = achievementData?.[badge.id] === true || adminMode;
            
            const div = document.createElement('div');
            div.className = `achievement-badge ${isUnlocked ? 'unlocked' : 'locked'}`;
            div.title = badge.desc;
            div.innerHTML = `
                <div class="badge-icon">${badge.icon}</div>
                <div class="badge-name">${badge.name}</div>
                <div class="badge-status">${isUnlocked ? 'Liberado' : 'Bloqueado'}</div>
            `;
            container.appendChild(div);
        });
    }

    async updateEndGameStats(isWinner, score) {
        return updateEndGameStatsModule(this, isWinner, score);
    }

    async saveGameResult(playerName, score) {
        if (!this.supabase) return;
        const safePlayerName = this.sanitizePlayerName(playerName, 'Jogador');

        // Tenta atualizar o score se já existir ou inserir novo
        const { error } = await this.supabase
            .from('ranking')
            .upsert({
                player_name: safePlayerName,
                score: score,
                user_id: this.user ? this.user.id : null
            }, { onConflict: 'user_id' }); // Se o usuário já tiver score, ele atualiza

        if (error) {
            // Se falhar o upsert por falta de constraint, tenta o insert normal
            const { error: insertError } = await this.supabase
                .from('ranking')
                .insert({
                    player_name: safePlayerName,
                    score: score,
                    user_id: this.user ? this.user.id : null
                });
            if (insertError) console.error('Erro ao salvar ranking:', insertError);
        }
    }

    async fetchGlobalRanking() {
        if (!this.supabase) return [];

        try {
            // Busca os 10 maiores scores da tabela de ranking
            const { data, error } = await this.supabase
                .from('ranking')
                .select('player_name, score, created_at, user_id')
                .order('score', { ascending: false })
                .limit(20); // Pega um pouco mais para filtrar duplicatas e manter top 10

            if (error) {
                console.error('Erro ao buscar ranking global:', error);
                return [];
            }

            // Remove duplicatas (um score por jogador/conta)
            const uniqueTop = [];
            const seenPlayers = new Set();
            const seenUsers = new Set();
            
            if (data) {
                for (const entry of data) {
                    const identifier = entry.user_id || entry.player_name;
                    if (!seenPlayers.has(identifier)) {
                        uniqueTop.push(entry);
                        seenPlayers.add(identifier);
                    }
                    if (uniqueTop.length >= 10) break;
                }
            }

            return uniqueTop;
        } catch (e) {
            console.error('Erro inesperado ao buscar ranking:', e);
            return [];
        }
    }

    // --- Audio & Vibration System ---
    initAudio() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    vibrate(pattern = 100) {
        // Se for iOS, navigator.vibrate NÃO é suportado.
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                console.warn('Vibration failed:', e);
            }
        }
    }

    triggerShake(element) {
        if (!element) return;
        element.classList.remove('shake');
        void element.offsetWidth; // Force reflow
        element.classList.add('shake');
        setTimeout(() => element.classList.remove('shake'), 400);
    }

    playSound(type) {
        if (this.isMuted) return;
        if (!this.audioCtx) this.initAudio();
        
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        const now = this.audioCtx.currentTime;

        if (type === 'click') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, now);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
        } else if (type === 'tick') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, now);
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            oscillator.start(now);
            oscillator.stop(now + 0.05);
        } else if (type === 'alarm') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(440, now);
            oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.1);
            oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.2);
            oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.3);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.5);
            oscillator.start(now);
            oscillator.stop(now + 0.5);
            this.vibrate([200, 100, 200]);
        } else if (type === 'success') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(523.25, now);
            oscillator.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
            oscillator.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            oscillator.start(now);
            oscillator.stop(now + 0.3);
            this.vibrate(50);
        } else if (type === 'error' || type === 'eliminated') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(220, now);
            oscillator.frequency.linearRampToValueAtTime(110, now + 0.5);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.5);
            oscillator.start(now);
            oscillator.stop(now + 0.5);
            this.vibrate([100, 50, 100]);
        }
    }

    // --- Theme & Navigation ---
    setupTheme() {
        const savedMode = localStorage.getItem('versus-letra-theme-mode') || 'light';
        document.body.classList.remove('light-mode', 'dark-mode');
        document.body.classList.add(`${savedMode}-mode`);
        
        // Reaplica o tema visual se já estiver definido
        if (this.selectedTheme && this.selectedTheme !== 'default') {
            document.body.classList.add(this.selectedTheme);
        }

        if (this.selectedTheme === 'theme-teia-urbana') {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            localStorage.setItem('versus-letra-theme-mode', 'dark');
        }
    }

    toggleTheme() {
        if (this.selectedTheme === 'theme-teia-urbana') {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            localStorage.setItem('versus-letra-theme-mode', 'dark');
            this.showFloatingMessage('No tema Teia Urbana, apenas o modo escuro está disponível.', 'info');
            this.playSound('click');
            return;
        }

        const isDark = document.body.classList.contains('dark-mode');
        const newMode = isDark ? 'light' : 'dark';
        
        document.body.classList.remove('light-mode', 'dark-mode');
        document.body.classList.add(`${newMode}-mode`);
        
        localStorage.setItem('versus-letra-theme-mode', newMode);
        this.playSound('click');
    }

    updateThemeIcon(theme) {
        // A atualização agora é feita via CSS baseado na classe do body
        // (.light-mode .icon-moon vs .dark-mode .icon-sun)
    }

    handleGlobalBack() {
        const activeScreen = Object.keys(this.screens).find(key => 
            this.screens[key] && this.screens[key].classList.contains('active')
        );
        
        if (activeScreen === 'setup') {
            const onlineInfo = document.getElementById('online-info');
            const joinOnline = document.getElementById('join-online');
            const taSetup = document.getElementById('time-attack-setup');
            const localOptions = document.getElementById('local-mode-options');

            if (this.isOnline && (onlineInfo.style.display === 'block' || joinOnline.style.display === 'flex')) {
                this.exitOnline(false);
                this.showSetup(true);
            } else if (taSetup.style.display === 'flex') {
                this.showSetup(false);
            } else {
                this.exitOnline();
                this.showScreen('home');
            }
        } else if (['ranking', 'about', 'profile', 'admin', 'login', 'signup', 'settings', 'party-mode'].includes(activeScreen)) {
            if (activeScreen === 'party-mode') {
                const gameplay = document.getElementById('party-gameplay');
                if (gameplay && gameplay.style.display === 'block') {
                    if (!confirm(this.t('confirm_exit_party'))) return;
                    if (this.partyTimer) clearInterval(this.partyTimer);
                }
                // Se estiver no setup do party mode, volta para o menu local
                this.showSetup(false);
                return;
            }
            this.showScreen('home');
        } else if (activeScreen === 'game') {
            if (confirm(this.t('confirm_exit_match'))) {
                this.endGameSession();
            }
        } else if (activeScreen === 'result') {
            this.endGameSession();
        }
        this.playSound('click');
    }

    showScreen(screenName) {
        if (screenName === 'admin' && !this.isCurrentUserAdmin()) {
            this.showFloatingMessage('Painel ADM disponível apenas para administradores.', 'warning');
            screenName = 'home';
        }

        // Bloqueio extra: Se tentar acessar Modo Galera no Desktop, redireciona para Home e mostra QR
        if (screenName === 'party-mode' && !this.isMobile) {
            this.showScreen('home');
            if (this.crazyBridge?.isCrazyGames) {
                this.showFloatingMessage('Modo Galera disponível apenas no celular.', 'info');
            } else {
                const qrModal = document.getElementById('modal-qr');
                if (qrModal) qrModal.style.display = 'flex';
            }
            return;
        }

        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
            
            // Inicialização específica de sub-telas
            if (screenName === 'party-mode') {
                const setup = document.getElementById('party-setup');
                const gameplay = document.getElementById('party-gameplay');
                if (setup) setup.style.display = 'flex';
                if (gameplay) gameplay.style.display = 'none';
            }
        } else {
            console.error(`Screen "${screenName}" not found!`);
        }
        
        // Esconde o header (controles e social) nas telas de Login e Cadastro
        const header = document.querySelector('header');
        if (header) {
            header.style.display = (screenName === 'login' || screenName === 'signup') ? 'none' : 'flex';
        }

        // Adiciona classe ao body para esconder decorações globais em telas de Auth
        if (screenName === 'login' || screenName === 'signup') {
            document.body.classList.add('auth-screen-active');
        } else {
            document.body.classList.remove('auth-screen-active');
        }

        // Exibe/Esconde o botão de voltar global (não aparece na Home)
        const backBtn = document.getElementById('btn-global-back');
        if (backBtn) {
            backBtn.style.display = screenName === 'home' ? 'none' : 'flex';
        }

        // Salva a última tela (exceto telas de jogo/setup que perdem estado no refresh)
        if (['home', 'about', 'ranking', 'profile', 'admin', 'login', 'signup', 'settings'].includes(screenName)) {
            localStorage.setItem('versus-letra-last-screen', screenName);
        }

        // Apenas renderiza o ranking histórico se clicado no menu (não no fim de jogo)
        if (screenName === 'ranking' && !this.isGameOver) this.renderRanking();

        if (screenName === 'home') {
            this.maybeShowQuickStartOnHome();
        }

        this.syncCrazyGameplayByScreen(screenName);
    }

    toggleModal(show) {
        if (show) this.renderHowToModal();
        document.getElementById('modal-how-to').style.display = show ? 'block' : 'none';
        this.playSound('click');
    }

    // --- Setup Logic ---
    renderPlayerInputs(count) {
        const container = document.getElementById('player-names-container');
        
        if (this.isOnline) {
            // No modo Online, os inputs de nome são bloqueados para jogadores logados
            container.innerHTML = '';
            this.players.forEach((player, index) => {
                const isMe = player.id === this.myPlayerId;
                const div = document.createElement('div');
                div.className = 'input-group';
                div.setAttribute('data-player-id', player.id);
                
                // Se eu estiver logado, meu nome vem do nick fixo. 
                // Se eu for convidado, posso editar meu nome no lobby.
                let displayName = isMe ? this.getDisplayName() : player.name;
                const canEdit = isMe && this.isGuest;

                // Se eu for convidado e já mudei meu nome localmente, usa esse nome
                if (isMe && this.isGuest && player.name && player.name !== 'Convidado') {
                    displayName = player.name;
                }

                div.innerHTML = `
                    <label>${isMe ? this.t('your_profile_label') : `${this.t('player_label')} ${index + 1}`}</label>
                    <div class="player-input-row" style="display:flex; gap:10px; align-items:center;">
                        <span class="player-avatar" style="${isMe ? 'cursor:pointer' : ''}">${player.avatar || '👤'}</span>
                        <input type="text" class="player-name-input" 
                            data-id="${player.id}"
                            value="${displayName}" 
                            ${!canEdit ? '' : 'placeholder="Seu nome..."'} 
                            ${!canEdit ? 'disabled' : ''}
                            style="flex:1">
                        ${this.isHost && !isMe ? `<button class="btn-kick" data-id="${player.id}">X</button>` : ''}
                    </div>
                `;
                
                if (isMe) {
                    const input = div.querySelector('input');
                    if (canEdit) {
                        input.addEventListener('input', (e) => {
                            const newName = e.target.value || 'Convidado';
                            player.name = newName;
                            if (this.isHost) {
                                this.syncLobby();
                            } else {
                                this.sendData({
                                    type: 'NAME_CHANGE',
                                    id: this.myPlayerId,
                                    name: newName
                                });
                            }
                        });
                    }

                    // Permitir mudar avatar clicando nele
                    const avatarSpan = div.querySelector('.player-avatar');
                    avatarSpan.onclick = () => {
                        const unlockedAvatars = this.getUnlockedAvatars();
                        let currentIndex = unlockedAvatars.indexOf(this.myAvatar);
                        if (currentIndex === -1) currentIndex = 0;
                        const nextIndex = (currentIndex + 1) % unlockedAvatars.length;
                        const nextAvatar = unlockedAvatars[nextIndex];
                        
                        this.myAvatar = nextAvatar;
                        this.renderAvatarPicker();
                        avatarSpan.textContent = nextAvatar;
                        
                        // Salva o novo avatar no perfil se logado
                        this.saveUserData();
                        
                        player.avatar = nextAvatar;
                        if (this.isHost) {
                            this.syncLobby();
                        } else {
                            this.sendData({
                                type: 'AVATAR_CHANGE',
                                id: this.myPlayerId,
                                avatar: nextAvatar
                            });
                        }
                        this.playSound('click');
                    };
                }

                if (this.isHost && !isMe) {
                    const btnKick = div.querySelector('.btn-kick');
                    btnKick.addEventListener('click', () => {
                        this.kickPlayer(player.id);
                    });
                }
                container.appendChild(div);
            });
        } else {
            // Modo local: re-renderiza se o número de jogadores mudou
            const num = Math.min(Math.max(parseInt(count) || 1, 1), 20);
            const currentCount = container.querySelectorAll('.player-name-input').length;
            
            if (currentCount !== num) {
                container.innerHTML = '';
                for (let i = 1; i <= num; i++) {
                    const isFirst = i === 1;
                    const div = document.createElement('div');
                    div.className = 'input-group';
                    
                    // Se for o primeiro jogador (Eu) e estiver logado, usa o nick fixo
                    const initialName = isFirst ? this.getDisplayName() : `${this.t('player_label')} ${i}`;
                    const isDisabled = isFirst && this.user;

                    div.innerHTML = `
                        <label>${this.t('player_name_label')} ${i}</label>
                        <div class="player-input-row" style="display:flex; gap:10px; align-items:center;">
                            <span class="player-avatar" style="cursor:pointer" title="Clique para mudar">${isFirst ? this.myAvatar : '👤'}</span>
                            <input type="text" class="player-name-input" placeholder="Ex: João" value="${initialName}" ${isDisabled ? 'disabled' : ''} style="flex:1">
                        </div>
                    `;
                    
                    const avatarSpan = div.querySelector('.player-avatar');
                    avatarSpan.onclick = () => {
                        const currentAvatar = avatarSpan.textContent;
                        const unlockedAvatars = this.getUnlockedAvatars();
                        let currentIndex = unlockedAvatars.indexOf(currentAvatar);
                        if (currentIndex === -1) currentIndex = 0;
                        const nextIndex = (currentIndex + 1) % unlockedAvatars.length;
                        let nextAvatar = unlockedAvatars[nextIndex];

                        if (isFirst) {
                            this.myAvatar = nextAvatar;
                            this.renderAvatarPicker();
                            this.saveUserData(); // Salva no perfil se for o jogador principal
                        }
                        
                        avatarSpan.textContent = nextAvatar;
                        this.playSound('click');
                    };
                    
                    container.appendChild(div);
                }
            }
        }
    }

    addNewCategory() {
        const input = document.getElementById('new-category-input');
        const value = this.sanitizeCategoryName(input.value);
        const categoryExists = this.categories.some((cat) => cat.toLowerCase() === value.toLowerCase());

        if (value && !categoryExists) {
            this.categories.push(value);
            input.value = '';
            this.renderCategoriesList();
            this.playSound('click');
        }
    }

    removeCategory(cat) {
        this.categories = this.categories.filter(c => c !== cat);
        this.renderCategoriesList();
        this.playSound('click');
    }

    renderCategoriesList() {
        const container = document.getElementById('categories-list');
        container.innerHTML = '';
        this.categories.forEach(cat => {
            const tag = document.createElement('div');
            tag.className = 'category-tag';
            tag.appendChild(document.createTextNode(`${cat} `));

            const removeBtn = document.createElement('span');
            removeBtn.title = 'Remover';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => this.removeCategory(cat));

            tag.appendChild(removeBtn);
            container.appendChild(tag);
        });
    }

    validateAndStart() {
        if (!this.isOnline) {
            const inputs = document.querySelectorAll('.player-name-input');
            this.players = [];
            inputs.forEach((input, index) => {
                const fallbackName = `Jogador ${index + 1}`;
                const name = this.sanitizePlayerName(input.value, fallbackName);
                this.players.push({
                    id: Math.random().toString(36).substr(2, 9),
                    name: name,
                    avatar: index === 0 ? this.sanitizeAvatar(this.myAvatar) : '👤', // Primeiro jogador local usa meu avatar
                    score: 0,
                    active: true
                });
            });
        }

        if (this.categories.length === 0) {
            this.showFloatingMessage('Adicione pelo menos uma categoria!', 'warning');
            return;
        }

        if (this.isOnline && this.isHost) {
            this.currentCategory = this.categories[Math.floor(Math.random() * this.categories.length)];
            this.broadcast({
                type: 'START_GAME',
                players: this.players,
                categories: this.categories,
                currentPlayerIndex: 0,
                currentCategory: this.currentCategory,
                usedLetters: Array.from(this.usedLetters)
            });
        }

        this.startGame();
    }

    startInstantReplay() {
        this.players.forEach((p) => {
            p.score = 0;
            p.active = true;
        });
        this.usedLetters.clear();
        this.isGameOver = false;
        this.currentPlayerIndex = 0;
        this.currentCategory = '';
        this.lastRoundFailed = false;
        this.roundHistory = [];
        this.powerUpsUsedInCategory.clear();
        this.currentVote = {
            active: false,
            yes: 0,
            no: 0,
            voters: new Set(),
            targetPlayerId: null,
            word: '',
            category: ''
        };

        if (this.isTimeAttack) {
            this.startTimeAttack();
            return;
        }
        this.startGame();
    }

    // --- Game Logic ---
    startRound() {
        this.selectedLetter = '';
        this.renderKeyboard();
        this.updateUI();
        
        const input = document.getElementById('word-input');
        if (input) {
            input.value = '';
            if (!this.isMobile) input.focus();
        }
    }
    generateKeyboard() {
        const keyboard = document.getElementById('alphabet-keyboard');
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        
        keyboard.innerHTML = '';
        alphabet.forEach(letter => {
            const key = document.createElement('div');
            key.className = 'key';
            key.textContent = letter;
            key.addEventListener('click', () => this.selectLetter(letter, key));
            keyboard.appendChild(key);
        });
    }

    selectLetter(letter, element, focusInput = true) {
        if (this.usedLetters.has(letter)) return;
        if (this.isOnline && !this.isMyTurn()) return;
        
        document.querySelectorAll('.key').forEach(k => k.classList.remove('selected'));
        this.selectedLetter = letter;
        element.classList.add('selected');
        this.playSound('click');
        if (focusInput) document.getElementById('word-input').focus();
    }

    isMyTurn() {
        if (!this.isOnline) return true;
        const currentPlayer = this.players[this.currentPlayerIndex];
        return currentPlayer && currentPlayer.id === this.myPlayerId;
    }

    getTrackedPlayerForStats() {
        if (!Array.isArray(this.players) || this.players.length === 0) return null;

        if (this.isOnline) {
            return this.players.find((player) => player.id === this.myPlayerId) || null;
        }

        // No local, o jogador logado é sempre o primeiro slot da partida.
        return this.players[0];
    }

    startGame() {
        this.usedLetters.clear();
        this.isGameOver = false;
        this.currentPlayerIndex = 0;
        this.currentCategory = ''; 
        this.lastRoundFailed = false;
        
        // Se estiver local, reseta o estado dos jogadores
        if (!this.isOnline) {
            this.players.forEach(p => {
                p.score = 0;
                p.active = true;
            });
        }
        
        this.nextTurn(false); // Usa nextTurn para gerenciar a primeira categoria
    }

    async handleNextRoundBtn() {
        if (this.isGameOver) {
            this.showFinalResults();
            return;
        }

        if (!this.isTimeAttack && this.crazyBridge.isCrazyGames) {
            const btnNext = document.getElementById('btn-next-round');
            const btnQuit = document.getElementById('btn-quit');
            if (btnNext) btnNext.disabled = true;
            if (btnQuit) btnQuit.disabled = true;

            this.pauseForExternalEvent();
            try {
                await this.crazyBridge.requestMidgameAd();
            } catch (error) {
                console.warn('Midgame ad request failed:', error);
            } finally {
                this.resumeAfterExternalEvent();
                if (btnNext) btnNext.disabled = false;
                if (btnQuit) btnQuit.disabled = false;
            }
        }

        if (this.isOnline) {
            if (this.isHost) {
                this.nextTurn(this.lastRoundFailed);
            }
        } else {
            this.nextTurn(this.lastRoundFailed);
        }
    }

    nextTurn(lastPlayerFailed = false) {
        let startIdx = this.currentPlayerIndex;
        
        // Avançar o índice (se já tivermos começado)
        if (this.players.some(p => p.score > 0) || lastPlayerFailed) {
            do {
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            } while (!this.players[this.currentPlayerIndex].active && this.currentPlayerIndex !== startIdx);
        }

        if (!this.players[this.currentPlayerIndex].active) {
            this.showFinalResults();
            return;
        }

        // Lógica de Categoria: Só muda se falhar ou se for a primeira rodada
        if (!this.currentCategory || lastPlayerFailed) {
            this.currentCategory = this.categories[Math.floor(Math.random() * this.categories.length)];
            this.usedLetters.clear(); // Reset de letras apenas quando a categoria muda
            this.powerUpsUsedInCategory.clear(); // Reset de poderes apenas quando a categoria muda
        }

        if (this.isOnline && this.isHost) {
            this.sendData({
                type: 'NEXT_TURN',
                currentPlayerIndex: this.currentPlayerIndex,
                currentCategory: this.currentCategory,
                usedLetters: Array.from(this.usedLetters),
                pickNewCategory: lastPlayerFailed
            });
        }

        // startRound agora recebe apenas o estado atual, sem decidir nova categoria
        this.startRound();
    }

    startRound() {
        const player = this.players[this.currentPlayerIndex];
        const isMe = !this.isOnline || this.isMyTurn();
        this.selectedLetter = '';
        
        // No Time Attack, o tempo não reseta a cada rodada
        if (!this.isTimeAttack) {
            this.timeLeft = 15;
            document.getElementById('timer-label').textContent = this.t('timer_default');
        }
        
        document.getElementById('current-player-name').innerHTML = this.isTimeAttack ? this.t('time_attack_mode_name') : `${player.avatar || '👤'} ${player.name}${this.isOnline && this.isMyTurn() ? ` (${this.t('you_tag')})` : ''}`;
        document.getElementById('current-score').textContent = player.score;
        document.getElementById('word-input').value = '';
        document.getElementById('remote-typing-display').textContent = ''; // Clear typing display
        document.getElementById('timer-value').textContent = '15';
        document.getElementById('timer-value').classList.remove('warning');
        
        // A categoria já deve estar definida por nextTurn() ou via mensagem Online
        document.getElementById('category-name').textContent = this.currentCategory;
        
        document.querySelectorAll('.key').forEach(key => {
            key.classList.remove('selected');
            if (this.usedLetters.has(key.textContent)) {
                key.classList.add('disabled');
            } else {
                key.classList.remove('disabled');
            }
        });

        // UI Power-ups
        this.renderPowerUps(isMe);

        // Solo host manages timer if online? No, better local timers but synchronized starts
        if (this.isTimeAttack) {
            // No modo Time Attack, o timer só começa uma vez na startTimeAttack
            // mas precisamos garantir que o display de pontos e categoria atualizem
            document.getElementById('current-score').textContent = player.score;
        } else {
            this.startTimer();
        }
        
        this.showScreen('game');
        this.playSound('click');

        const input = document.getElementById('word-input');
        const btnOk = document.getElementById('btn-confirm');
        
        if (this.isOnline && !this.isMyTurn()) {
            input.disabled = true;
            input.placeholder = `Aguardando ${player.name}...`;
            btnOk.disabled = true;
            input.blur(); // Remove foco para mobile keyboard fechar se não for o turno
        } else {
            input.disabled = false;
            input.placeholder = "Sua vez! Digite...";
            btnOk.disabled = false;
            // No celular, o focus() só funciona bem em eventos de toque, 
            // mas tentamos aqui para garantir se o navegador permitir
            input.focus();
        }
    }

    renderPowerUps(isMe) {
        let puContainer = document.getElementById('powerups-container');
        if (!puContainer) {
            puContainer = document.createElement('div');
            puContainer.id = 'powerups-container';
            puContainer.className = 'powerups-container';
            const categoryEl = document.querySelector('.category-display');
            categoryEl.parentNode.insertBefore(puContainer, categoryEl.nextSibling);
        }

        puContainer.innerHTML = '';
        
        if (isMe) {
            const usedTime = this.powerUpsUsedInCategory.has('time');
            const usedHint = this.powerUpsUsedInCategory.has('hint');

            const btnTime = document.createElement('button');
            btnTime.className = 'btn-powerup';
            btnTime.innerHTML = '⏳ +5s';
            btnTime.disabled = usedTime;
            btnTime.onclick = () => this.usePowerUp('time');
            
            const btnHint = document.createElement('button');
            btnHint.className = 'btn-powerup';
            btnHint.innerHTML = '💡 Dica';
            btnHint.disabled = usedHint;
            btnHint.onclick = () => this.usePowerUp('hint');

            puContainer.appendChild(btnTime);
            puContainer.appendChild(btnHint);
            
            if (usedTime || usedHint) {
                const label = document.createElement('em');
                label.style.fontSize = '0.7rem';
                label.style.display = 'block';
                label.style.width = '100%';
                label.style.marginTop = '5px';
                label.textContent = 'Poderes resetam na próxima categoria';
                puContainer.appendChild(label);
            }
        }
    }

    usePowerUp(type) {
        if (this.powerUpsUsedInCategory.has(type)) return;

        if (type === 'time') {
            this.timeLeft += 5;
            document.getElementById('timer-value').textContent = this.timeLeft;
            this.playSound('success');
            this.powerUpsUsedInCategory.add('time');
            this.showFloatingMessage('+5 SEGUNDOS! ⏳', 'success');
        } else if (type === 'hint') {
            const wordBank = this.categoryBanks[this.currentCategory];
            if (wordBank) {
                const possible = wordBank.filter(w => !this.usedLetters.has(w[0].toUpperCase()));
                if (possible.length > 0) {
                    const hint = possible[Math.floor(Math.random() * possible.length)];
                    this.showFloatingMessage(`DICA: Começa com "${hint[0]}"! 💡`, 'info');
                    this.powerUpsUsedInCategory.add('hint');
                } else {
                    this.showFloatingMessage('Sem dicas para esta categoria!', 'error');
                }
            } else {
                this.showFloatingMessage('Sem dicas para esta categoria!', 'error');
            }
        }
        
        this.renderPowerUps(true);
    }

    localizeRuntimeText(text) {
        return localizeRuntimeTextByLang(this.language, text);
    }

    showFloatingMessage(text, type = 'info') {
        let container = document.getElementById('floating-messages');
        if (!container) {
            container = document.createElement('div');
            container.id = 'floating-messages';
            container.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:10000; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
            document.body.appendChild(container);
        }

        const msg = document.createElement('div');
        const colors = {
            success: '#2ed573',
            error: '#ff4757',
            info: '#1e90ff',
            warning: '#ffa502'
        };
        
        msg.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 25px;
            border-radius: 50px;
            font-weight: 800;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            animation: slideDownFade 3s forwards;
            font-size: 0.9rem;
            text-align: center;
            min-width: 200px;
        `;
        msg.textContent = this.localizeRuntimeText(text);
        
        // Add animation keyframes if not already there
        if (!document.getElementById('floating-style')) {
            const style = document.createElement('style');
            style.id = 'floating-style';
            style.textContent = `
                @keyframes slideDownFade {
                    0% { transform: translateY(-20px); opacity: 0; }
                    10% { transform: translateY(0); opacity: 1; }
                    80% { transform: translateY(0); opacity: 1; }
                    100% { transform: translateY(-20px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        container.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    startTimer() {
        clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.timeLeft--;
            const timerEl = document.getElementById('timer-value');
            timerEl.textContent = this.timeLeft;
            
            // Som de tique-taque
            if (this.timeLeft > 0) {
                this.playSound('tick');
                if (this.timeLeft <= 5) this.vibrate(50);
            }

            if (this.timeLeft <= 10) {
                timerEl.classList.add('warning');
                if (this.timeLeft <= 5) {
                    this.triggerShake(timerEl);
                }
            }

            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.playSound('alarm'); // Som de alarme ao acabar
                
                if (this.isTimeAttack) {
                    this.isGameOver = true;
                    this.showFinalResults();
                } else if (!this.isOnline || this.isMyTurn()) {
                    this.timeOut();
                }
            }
        }, 1000);
    }

    timeOut() {
        if (this.isOnline) {
            this.sendData({ type: 'TIMEOUT' });
        }
        this.processTimeout();
    }

    remoteTimeout() {
        clearInterval(this.timer);
        this.processTimeout();
    }

    processTimeout() {
        const player = this.players[this.currentPlayerIndex];
        player.active = false;
        // Força troca de categoria no próximo turno
        this.lastRoundFailed = true; 
        
        if (this.isHost) {
            this.broadcast({
                type: 'SYNC_SCORES',
                players: this.players
            });
        }

        this.showResult(false, `${player.name} foi ELIMINADO por tempo!`, '');
    }

    async submitWord() {
        if (this.isOnline && !this.isMyTurn()) return;

        const word = document.getElementById('word-input').value.trim().toUpperCase();
        if (!this.selectedLetter) {
            this.showFloatingMessage('Comece a digitar ou escolha uma letra!', 'warning');
            return;
        }
        if (!word) return;

        if (!this.isTimeAttack) {
            clearInterval(this.timer);
        }

        // --- SUSPENDER CRONÔMETRO ONLINE ---
        if (this.isOnline) {
            this.sendData({ type: 'STOP_TIMER' });
        }
        if (!this.isTimeAttack) {
            document.getElementById('timer-value').textContent = '--';
        }

        // Feedback visual de validação
        const btnOk = document.getElementById('btn-confirm');
        const originalText = btnOk.textContent;
        btnOk.textContent = '...';
        btnOk.disabled = true;

        const isValidStart = word.startsWith(this.selectedLetter);
        const isValidLength = word.length >= 3;

        if (!isValidStart || !isValidLength) {
            btnOk.textContent = originalText;
            btnOk.disabled = false;
            this.processSubmit(word, this.selectedLetter, false, !isValidStart ? `Deve começar com ${this.selectedLetter}!` : 'Mínimo de 3 letras!');
            return;
        }

        // --- VALIDAÇÃO CRUZADA (BANCO DE DADOS LOCAL) ---
        let finalSuccess = false;
        let finalMessage = 'Excelente!';
        let skipFurtherValidation = false;

        // 1. Verificar se a palavra está no banco da categoria atual
        if (this.categoryBanks[this.currentCategory]) {
            const normalizedWord = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            const bank = this.categoryBanks[this.currentCategory].map(w => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
            
            if (bank.includes(normalizedWord)) {
                finalSuccess = true;
                skipFurtherValidation = true;
            } else {
                // 2. Se não está no banco atual, verificar se está em OUTRO banco
                for (const [catName, words] of Object.entries(this.categoryBanks)) {
                    if (catName === this.currentCategory) continue;
                    const normalizedOtherBank = words.map(w => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
                    if (normalizedOtherBank.includes(normalizedWord)) {
                        finalSuccess = false;
                        finalMessage = `Isso parece um(a) ${catName}, não um(a) ${this.currentCategory}!`;
                        skipFurtherValidation = true;
                        break;
                    }
                }
            }
        }

        // 3. Validação (Online usa Votação / Local aceita direto)
        if (!skipFurtherValidation) {
            if (!this.isTimeAttack && this.isOnline && this.players.filter(p => p.active).length > 1) {
                this.startVoting(word, this.currentCategory);
                btnOk.textContent = originalText;
                btnOk.disabled = false;
                return;
            }

            // Fallback Local ou Único Jogador: Se for categoria de palavra única, tenta dicionário
            const wordCategories = ['Animal', 'Fruta', 'Objeto', 'Cor', 'Profissão', 'Comida', 'Esporte', 'Parte do corpo', 'Verbo', 'Adjetivo', 'Peça de Roupa', 'Bebida', 'Sobremesa', 'Instrumento Musical', 'Nome'];
            const isWordCategory = wordCategories.includes(this.currentCategory);

            if (isWordCategory) {
                try {
                    const response = await fetch(`https://api.dicionario-aberto.net/word/${word.toLowerCase()}`);
                    const data = await response.json();
                    finalSuccess = (data && data.length > 0);
                    
                    if (!finalSuccess && !this.isTimeAttack) {
                        // Se não achou no dicionário e NÃO for time attack, abre para VOTAÇÃO manual
                        this.startVoting(word, this.currentCategory);
                        btnOk.textContent = originalText;
                        btnOk.disabled = false;
                        return;
                    }
                } catch (err) {
                    // Se a API falhar, no Time Attack consideramos erro (para ser rígido), no normal aceitamos
                    finalSuccess = !this.isTimeAttack;
                }
            } else {
                finalSuccess = true;
            }
        }

        btnOk.textContent = originalText;
        btnOk.disabled = false;

        if (this.isOnline) {
            this.sendData({
                type: 'SUBMIT_WORD',
                word: word,
                letter: this.selectedLetter,
                success: finalSuccess,
                message: finalMessage
            });
        }

        this.processSubmit(word, this.selectedLetter, finalSuccess, finalMessage);
    }

    // --- Modo Galera (Party Mode) ---
    startPartyGame() {
        return startPartyGameModule(this);
    }

    getPartyCategories() {
        return getPartyCategoriesModule(this);
    }

    getRandomPartyCategory(excludeCategory = null) {
        return getRandomPartyCategoryModule(this, excludeCategory);
    }

    renderPartyKeyboard() {
        return renderPartyKeyboardModule(this);
    }

    handlePartyLetterClick(letter, btn) {
        return handlePartyLetterClickModule(this, letter, btn);
    }

    startPartyTimer() {
        return startPartyTimerModule(this);
    }

    updatePartyTimerUI() {
        return updatePartyTimerUIModule(this);
    }

    handlePartyElimination() {
        return handlePartyEliminationModule(this);
    }

    advancePartyTurn() {
        return advancePartyTurnModule(this);
    }

    showPartyFinalResults(finalScore, bestScore) {
        return showPartyFinalResultsModule(this, finalScore, bestScore);
    }

    endPartyGame() {
        return endPartyGameModule(this);
    }

    showModeInstructions(mode, force = false, callback = null) {
        const hasSeenKey = `versus-letra-seen-${mode}`;
        const hasSeen = localStorage.getItem(hasSeenKey);

        if (hasSeen && !force) {
            if (callback) callback();
            return;
        }

        this.instructionCallback = callback;
        const modal = document.getElementById('modal-mode-instructions');
        const title = document.getElementById('instruction-title');
        const body = document.getElementById('instruction-body');
        const localized = getModeInstructionByLang(this.language, mode);

        if (localized) {
            title.innerHTML = localized.title;
            body.innerHTML = localized.body;
        }

        modal.style.display = 'flex';
        localStorage.setItem(hasSeenKey, 'true');
    }

    renderPartyCategoriesList() {
        return renderPartyCategoriesListModule(this);
    }

    async renderRanking() {
        const localRanking = JSON.parse(localStorage.getItem('versus-letra-ranking') || '[]');
        const listEl = document.getElementById('ranking-list');
        
        // Recorde Modo Galera
        const partyRecord = localStorage.getItem('versus-letra-party-record') || 0;
        const partyScoreEl = document.getElementById('party-best-score');
        if (partyScoreEl) partyScoreEl.textContent = partyRecord;

        listEl.innerHTML = '<div class="ranking-loader" style="text-align:center; padding:20px;">' +
            '<span style="font-size:2rem; display:block; animation: rotate 2s linear infinite;">⏳</span>' +
            `<p>${this.t('loading_rankings')}</p></div>`;

        // Add rotation animation if not present
        if (!document.getElementById('ranking-style')) {
            const style = document.createElement('style');
            style.id = 'ranking-style';
            style.textContent = `@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }

        try {
            listEl.innerHTML = '';

            // 1. TOP 10 PARTIDAS (GLOBAL)
            const globalGameRanking = await this.fetchGlobalRanking();
            if (globalGameRanking && globalGameRanking.length > 0) {
                const h3 = document.createElement('h3');
                h3.textContent = `🏆 ${this.t('top_10_games')}`;
                h3.style.margin = '20px 0 10px 0';
                h3.style.color = 'var(--primary-color)';
                listEl.appendChild(h3);

                globalGameRanking.forEach((item, index) => {
                    const div = document.createElement('div');
                    div.className = 'ranking-item';
                    const dateLocale = this.language === 'en' ? 'en-US' : (this.language === 'es' ? 'es-ES' : 'pt-BR');
                    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString(dateLocale) : '';
                    div.innerHTML = `
                        <span>#${index + 1} - ${item.player_name || this.t('player_label')} ${dateStr ? `<small style="font-size:0.7em; opacity:0.6">(${dateStr})</small>` : ''}</span>
                        <strong>${item.score} ${this.t('points_abbr')}</strong>
                    `;
                    listEl.appendChild(div);
                });
            }

            // 2. TOP 10 JOGADORES (NÍVEL)
            const { data: levelRanking, error: levelError } = await this.supabase
                .from('profiles')
                .select('nickname, xp, level, avatar')
                .order('level', { ascending: false })
                .order('xp', { ascending: false })
                .limit(10);

            if (!levelError && levelRanking && levelRanking.length > 0) {
                const h3 = document.createElement('h3');
                h3.textContent = `⭐ ${this.t('letter_masters')}`;
                h3.style.margin = '30px 0 10px 0';
                h3.style.color = '#ffa502';
                listEl.appendChild(h3);

                levelRanking.forEach((profile, index) => {
                    const div = document.createElement('div');
                    div.className = 'ranking-item';
                    if (this.user && profile.nickname === this.user.nickname) div.classList.add('me');
                    
                    div.innerHTML = `
                        <span>#${index + 1} - ${profile.nickname} <small style="opacity:0.7">(LV ${profile.level})</small></span>
                        <strong>${profile.xp} XP</strong>
                    `;
                    listEl.appendChild(div);
                });
            }

        } catch (e) {
            console.error('Erro ao renderizar rankings:', e);
            listEl.innerHTML = `<p style="text-align:center; color:red;">${this.t('ranking_load_error')}</p>`;
        }

        // 3. RECORDES LOCAIS
        if (localRanking && localRanking.length > 0) {
            const h3 = document.createElement('h3');
            h3.textContent = `🏠 ${this.t('your_local_records')}`;
            h3.style.margin = '30px 0 10px 0';
            h3.style.color = 'var(--text-muted)';
            listEl.appendChild(h3);

            localRanking.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'ranking-item local';
                div.innerHTML = `<span>#${index + 1} - ${item.name || 'Jogador'} (${item.date})</span><strong>${item.score} pts</strong>`;
                listEl.appendChild(div);
            });
        }
    }

    // --- Voting System ---
    startVoting(word, category) {
        const currentPlayer = this.players[this.currentPlayerIndex];
        this.currentVote = {
            active: true,
            yes: 0,
            no: 0,
            voters: new Set(),
            targetPlayerId: currentPlayer.id,
            word: word,
            category: category
        };

        if (this.isOnline) {
            this.broadcast({
                type: 'START_VOTE',
                word: word,
                category: category,
                letter: this.selectedLetter,
                playerId: currentPlayer.id
            });
        }

        // O jogador que enviou não vota nele mesmo (ou o voto dele não conta agora)
        this.showVotingModal(word, category, currentPlayer.name, true);
    }

    showVotingModal(word, category, playerName, isTarget = false) {
        const modal = document.getElementById('modal-voting');
        document.getElementById('voter-player-name').textContent = playerName;
        document.getElementById('voted-word-display').textContent = word;
        document.getElementById('voted-category-display').textContent = category;
        
        modal.style.display = 'block';
        
        const btnYes = document.getElementById('btn-vote-yes');
        const btnNo = document.getElementById('btn-vote-no');
        
        if (isTarget && this.isOnline) {
            btnYes.disabled = true;
            btnNo.disabled = true;
            btnYes.textContent = this.t('waiting_short');
        } else {
            // No modo local, todos votam juntos, então os botões ficam ativos
            btnYes.disabled = false;
            btnNo.disabled = false;
            btnYes.textContent = 'SIM ✅';
        }
    }

    sendVote(vote) {
        const modal = document.getElementById('modal-voting');
        modal.style.display = 'none';
        
        if (this.isOnline) {
            if (this.isHost) {
                // Host processa seu próprio voto diretamente
                this.handleVote(vote, this.myPlayerId);
                // E avisa os outros sobre o progresso
                this.broadcast({
                    type: 'VOTE_UPDATE',
                    voterId: this.myPlayerId,
                    vote: vote
                });
            } else {
                // Peer envia para o host
                this.sendData({
                    type: 'SUBMIT_VOTE',
                    vote: vote,
                    voterId: this.myPlayerId
                });
            }
        } else {
            // No modo local, o primeiro voto já decide o resultado
            this.handleVote(vote, 'local-voter');
        }
    }

    handleVote(vote, voterId) {
        if (!this.currentVote.active) return;
        if (this.currentVote.voters.has(voterId)) return;

        this.currentVote.voters.add(voterId);
        if (vote) this.currentVote.yes++;
        else this.currentVote.no++;

        if (this.isOnline) {
            if (this.isHost) {
                const activePlayersCount = this.players.filter(p => p.active).length;
                const totalVotersNeeded = activePlayersCount - 1; // Todos exceto quem enviou

                if (this.currentVote.voters.size >= totalVotersNeeded) {
                    this.finishVoting();
                }
            }
            // Peers apenas aguardam o Host decidir o fim
        } else {
            // No modo local, basta 1 voto
            this.finishVoting();
        }
    }

    finishVoting() {
        this.currentVote.active = false;
        const success = this.currentVote.yes >= this.currentVote.no;
        const message = success ? 'Aceito pelo grupo!' : 'Recusado pelo grupo!';
        
        document.getElementById('modal-voting').style.display = 'none';

        // Se for Host no Online, avisa todos sobre o resultado final
        if (this.isOnline && this.isHost) {
            this.broadcast({
                type: 'SUBMIT_WORD',
                word: this.currentVote.word,
                letter: this.selectedLetter,
                success: success,
                message: message
            });
        }

        // Add to history
        const targetPlayer = this.players.find(p => p.id === this.currentVote.targetPlayerId);
        this.roundHistory.push({
            player: targetPlayer ? targetPlayer.name : 'Jogador',
            avatar: targetPlayer ? (targetPlayer.avatar || '👤') : '👤',
            word: this.currentVote.word,
            category: this.currentVote.category,
            success: success
        });

        // Processa localmente o resultado
        this.processSubmit(this.currentVote.word, this.selectedLetter, success, message);
    }

    remoteSubmitWord(data) {
        clearInterval(this.timer);
        // Garante que o modal de votação feche para todos
        document.getElementById('modal-voting').style.display = 'none';
        this.processSubmit(data.word, data.letter, data.success, data.message);
    }

    processSubmit(word, letter, success, message) {
        const player = this.players[this.currentPlayerIndex];
        
        if (success) {
            const points = this.calculatePoints(word);
            player.score += points;
            this.usedLetters.add(letter);

            if (this.isHost) {
                this.broadcast({
                    type: 'SYNC_SCORES',
                    players: this.players
                });
            }

            this.showResult(true, message, word, points);
        } else {
            // Feedback visual de erro (Shake)
            this.triggerShake(document.querySelector('.input-area'));

            // No Modo Contra o Relógio, o jogador NUNCA é eliminado por errar
            if (this.isTimeAttack) {
                this.lastRoundFailed = true;
                this.showResult(false, message, word);
                return;
            }

            // Se errou a regra ou dicionário no modo normal, o jogador é ELIMINADO
            player.active = false;
            this.lastRoundFailed = true;

            if (this.isHost) {
                this.broadcast({
                    type: 'SYNC_SCORES',
                    players: this.players
                });
            }

            this.showResult(false, message.includes('ELIMINADO') ? message : `ERRADO! ${message} Você foi ELIMINADO!`, word);
        }
    }

    calculatePoints(word) {
        let base = 0;
        if (word.length >= 5) base = 30;
        else if (word.length === 4) base = 20;
        else if (word.length === 3) base = 10;
        
        // Bonus de tempo: +1 ponto por cada segundo restante (mínimo 0)
        const timeBonus = Math.max(0, this.timeLeft);
        return base + timeBonus;
    }

    triggerConfetti() {
        this.crazyBridge.happytime();
        if (typeof confetti === 'function') {
            const duration = 5 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

            const randomInRange = (min, max) => Math.random() * (max - min) + min;

            const interval = setInterval(function() {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);
        }
    }

    triggerVictoryVisuals(playerName) {
        const card = document.getElementById('result-card');
        const winningContainer = document.getElementById('winning-container');
        const victoryPlayerName = document.getElementById('victory-player-name');
        const wordDisplay = document.getElementById('word-display-p');
        const letterDisplay = document.getElementById('letter-display-p');

        card.classList.add('is-victory');
        winningContainer.style.display = 'block';
        victoryPlayerName.textContent = playerName;
        wordDisplay.style.display = 'none';
        letterDisplay.style.display = 'none';

        // Create stars
        for (let i = 0; i < 8; i++) {
            const star = document.createElement('div');
            star.className = 'star-victory';
            star.innerHTML = '★';
            star.style.animationDelay = `${i * (3 / 8)}s`;
            winningContainer.appendChild(star);
        }

        this.triggerConfetti();
    }

    resetVictoryVisuals() {
        const card = document.getElementById('result-card');
        const winningContainer = document.getElementById('winning-container');
        const wordDisplay = document.getElementById('word-display-p');
        const letterDisplay = document.getElementById('letter-display-p');

        card.classList.remove('is-victory');
        winningContainer.style.display = 'none';
        wordDisplay.style.display = 'block';
        letterDisplay.style.display = 'block';
        
        // Remove existing stars
        const stars = winningContainer.querySelectorAll('.star-victory');
        stars.forEach(s => s.remove());
    }

    showResult(success, message, word = '-', points = 0) {
        // Round History
        this.roundHistory.push({
            player: this.players[this.currentPlayerIndex].name,
            avatar: this.players[this.currentPlayerIndex].avatar || '👤',
            word: word || '---',
            category: this.currentCategory,
            success: success
        });

        // Achievements check
        if (success) {
            if (word.length >= 10 && !this.achievements.dicionario) {
                this.unlockAchievement('dicionario', 'Dicionário Vivo 📚');
            }
            if (this.timeLeft >= 12 && !this.achievements.flash) {
                this.unlockAchievement('flash', 'Velocidade Flash ⚡');
            }
        }

        // --- REGISTRO DE XP E RANKING (NOVO) ---
        // Se for o meu turno (ou modo local onde sou o único jogador logado), registra XP e Ranking
        if (!this.isOnline || this.isMyTurn()) {
            if (this.user || this.isGuest) {
                const currentPlayer = this.players[this.currentPlayerIndex];
                // Ganho de XP por palavra: 5 XP base + 1 XP por letra + bônus de tempo (se sucesso)
                if (success) {
                    const wordXP = 5 + word.length + Math.floor(this.timeLeft / 2);
                    this.addXP(wordXP);
                    
                    // Salva no Ranking Global o score atualizado do jogador
                    this.saveGameResult(this.getDisplayName(), currentPlayer.score);
                }
            }
        }

        // Se for Time Attack e acertar, muda a letra e categoria imediatamente
        if (this.isTimeAttack && success) {
            this.currentCategory = this.timeAttackCategories[Math.floor(Math.random() * this.timeAttackCategories.length)];
            this.usedLetters.add(this.selectedLetter);
            if (this.usedLetters.size >= 26) this.usedLetters.clear();
            
            // Pequeno delay para mostrar que acertou antes de mudar
            setTimeout(() => {
                this.startRound();
            }, 800);
        }

        this.showScreen('result');
        this.resetVictoryVisuals();
        this.lastRoundFailed = !success || message.includes('ELIMINADO');
        
        const titleEl = document.getElementById('result-title');
        const msgEl = document.getElementById('result-message');
        const wordEl = document.getElementById('result-word');
        const letterEl = document.getElementById('result-letter');
        const pointsEl = document.getElementById('points-value');
        const btnNext = document.getElementById('btn-next-round');

        if (this.isTimeAttack && success) {
            titleEl.textContent = 'BOA!';
            titleEl.className = 'success';
            msgEl.textContent = `+${points} pontos!`;
            btnNext.style.display = 'none'; // No Time Attack, avança automático
        } else if (this.isTimeAttack && !success) {
            titleEl.textContent = 'OPS! ERROU';
            titleEl.className = 'error';
            msgEl.textContent = message || 'Palavra inválida!';
            btnNext.textContent = 'TENTAR OUTRA';
            btnNext.style.display = 'block';
        } else {
            titleEl.textContent = this.lastRoundFailed ? (message.includes('ELIMINADO') ? 'ELIMINADO!' : 'Que pena!') : 'Muito bem!';
            titleEl.className = this.lastRoundFailed ? 'error' : 'success';
            msgEl.textContent = message;
            msgEl.className = `message ${this.lastRoundFailed ? 'error' : 'success'}`;
            btnNext.style.display = 'block';
        }

        wordEl.textContent = word || '-';
        letterEl.textContent = this.selectedLetter || '-';
        pointsEl.textContent = `+${points}`;
        pointsEl.style.transform = 'scale(1)';

        this.playSound(this.lastRoundFailed ? 'error' : 'success');

        const activePlayers = this.players.filter(p => p.active);
        
        // Check for victory (only one player remains)
        const isVictory = !this.isTimeAttack && activePlayers.length === 1 && this.players.length > 1;

        // --- SISTEMA DE MEDALHAS (NOVO) ---
        if (this.user || this.isGuest) {
            // 1. Maratonista (Partidas Jogadas)
            if (this.user && this.user.stats) {
                const games = this.user.stats.games_played || 0;
                if (games >= 10) this.unlockAchievement('maratonista', 'Maratonista (10 Partidas)');
                if (games >= 50) this.unlockAchievement('maratonista_pro', 'Lenda das Letras (50 Partidas)');
            }

            // 2. Vitória Perfeita (Vencer sem errar nenhuma vez)
            if (isVictory && activePlayers[0].id === this.myPlayerId && !this.lastRoundFailed) {
                this.unlockAchievement('vitoria_perfeita', 'Vitória Perfeita');
                this.achievements.perfeccionista_count = (this.achievements.perfeccionista_count || 0) + 1;
                if (this.achievements.perfeccionista_count >= 10) {
                    this.unlockAchievement('perfeccionista', 'Perfeccionista (10 Vitórias Perfeitas)');
                }
            }

            // 3. Colecionador (Desbloquear itens)
            const totalItems = (this.unlockedItems.avatars?.length || 0) + (this.unlockedItems.themes?.length || 0);
            if (totalItems >= 5) this.unlockAchievement('colecionador', 'Colecionador Iniciante');
            if (totalItems >= 15) this.unlockAchievement('colecionador_pro', 'Arquivista das Letras');

            // 4. Mestre das Letras (Palavras longas)
            if (success && word.length >= 8) {
                this.unlockAchievement('mestre_letras', 'Mestre das Letras (8+ letras)');
            }
            if (success && word.length >= 12) {
                this.unlockAchievement('mestre_letras_pro', 'Escriba Real (12+ letras)');
            }

            // 5. Estrategista (Usar Power-ups)
            if (this.powerUpsUsedInCategory && this.powerUpsUsedInCategory.size > 0) {
                this.achievements.estrategista_count = (this.achievements.estrategista_count || 0) + 1;
                if (this.achievements.estrategista_count >= 20) {
                    this.unlockAchievement('estrategista_medal', 'Estrategista Nato');
                }
                if (this.achievements.estrategista_count >= 50) {
                    this.unlockAchievement('estrategista_pro', 'Mestre Tático');
                }
            }

            // 6. Veloz e Furioso (Responder em menos de 3 segundos)
            if (success && this.timeLeft >= 12) {
                this.unlockAchievement('veloz_furioso', 'Veloz e Furioso');
            }
            if (success && this.timeLeft >= 13) {
                this.unlockAchievement('veloz_furioso_pro', 'Sônico (Tempo < 2s)');
            }

            // 7. Veterano (Atingir Nível 10)
            if (this.level >= 10) {
                this.unlockAchievement('veterano', 'Veterano (Nível 10)');
            }
            if (this.level >= 25) {
                this.unlockAchievement('veterano_pro', 'Ancião (Nível 25)');
            }

            // 8. Rei da Sala (Vencer 5 partidas online como Host)
            if (isVictory && this.isOnline && this.isHost && activePlayers[0].id === this.myPlayerId) {
                this.achievements.rei_da_sala_count = (this.achievements.rei_da_sala_count || 0) + 1;
                if (this.achievements.rei_da_sala_count >= 5) {
                    this.unlockAchievement('rei_da_sala_medal', 'Rei da Sala');
                }
                if (this.achievements.rei_da_sala_count >= 20) {
                    this.unlockAchievement('rei_da_sala_pro', 'Imperador da Sala');
                }
            }

            // 9. Pioneiro (Primeira vitória online)
            if (isVictory && this.isOnline && activePlayers[0].id === this.myPlayerId) {
                this.unlockAchievement('pioneiro', 'Pioneiro Online');
                this.achievements.online_wins_count = (this.achievements.online_wins_count || 0) + 1;
                if (this.achievements.online_wins_count >= 10) {
                    this.unlockAchievement('pioneiro_pro', 'Explorador das Redes');
                }
            }
        }

        if (activePlayers.length === 0 || this.usedLetters.size === 26 || isVictory) {
            this.isGameOver = true;
            this.saveAllScores();
            btnNext.textContent = 'VER RESULTADO FINAL';
            btnNext.style.display = 'block';
            btnNext.disabled = false; // Garante que todos possam clicar no fim
            
            if (isVictory) {
                titleEl.textContent = 'VITÓRIA!';
                titleEl.className = 'success';
                msgEl.textContent = `${activePlayers[0].name} é o grande vencedor!`;
                this.triggerVictoryVisuals(activePlayers[0].name);
            }
        } else {
            this.isGameOver = false;
            if (!this.isTimeAttack) {
                btnNext.textContent = this.isOnline && !this.isHost ? this.t('waiting_host') : this.t('next_player');
                btnNext.disabled = (this.isOnline && !this.isHost);
                
                // Auto-advance after 2 seconds if not game over
                if (!this.isOnline || this.isHost) {
                    setTimeout(() => {
                        // Only advance if we are still on the result screen
                        if (this.screens.result.classList.contains('active')) {
                            this.handleNextRoundBtn();
                        }
                    }, 2000);
                }
            }
        }
    }

    unlockAchievement(id, name) {
        if (this.achievements[id] === true) return false;
        this.achievements[id] = true;
        localStorage.setItem('achievements', JSON.stringify(this.achievements));
        this.saveUserData();
        this.showFloatingMessage(`🏆 CONQUISTA: ${name}`, 'success');
        this.playSound('victory');
        return true;
    }

    showFinalResults() {
        this.isGameOver = true;
        this.showScreen('ranking');
        const listEl = document.getElementById('ranking-list');
        listEl.innerHTML = ''; 
        
        const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);
        const winner = sortedPlayers[0];
        const isTie = !this.isTimeAttack && sortedPlayers.length > 1 && sortedPlayers[0].score === sortedPlayers[1].score;

        if (this.isTimeAttack) {
            const banner = document.createElement('div');
            banner.className = 'winner-banner';
            banner.innerHTML = `
                <div class="winner-icon">⏱️</div>
                <div class="winner-text">${this.t('time_up')}</div>
                <div class="winner-name">${this.t('you_scored')} ${winner.score} ${this.t('points_word')}!</div>
            `;
            listEl.appendChild(banner);
            this.triggerConfetti();
        } else {

            // Check for "Invencível" achievement (Win streak)
            if (!isTie && winner.id === this.myPlayerId) {
                this.achievements.invencivel++;
                if (this.achievements.invencivel >= 3) {
                    this.unlockAchievement('invencivel_badge', 'Invencível 🏆 (3 vitórias seguidas)');
                }
            } else if (this.players.some(p => p.id === this.myPlayerId)) {
                this.achievements.invencivel = 0; // Reset streak
            }

            // Banner do Vencedor
            const winnerBanner = document.createElement('div');
            winnerBanner.className = 'winner-banner';
            if (isTie) {
                winnerBanner.innerHTML = `
                    <div class="winner-icon">🤝</div>
                    <div class="winner-text">${this.t('draw')}</div>
                    <div class="winner-name">${winner.name} e ${sortedPlayers[1].name}</div>
                `;
            } else {
                winnerBanner.innerHTML = `
                    <div class="winner-icon">👑</div>
                    <div class="winner-text">${this.t('winner_word')}</div>
                    <div class="winner-name">${winner.name}</div>
                `;
                this.triggerConfetti(); // Solta confetes se houver um vencedor claro
            }
            listEl.appendChild(winnerBanner);
        }

        localStorage.setItem('achievements', JSON.stringify(this.achievements));
        this.saveUserData();

        // Atualiza estatísticas globais se estiver logado
        if (this.user) {
            const trackedPlayer = this.getTrackedPlayerForStats();
            if (trackedPlayer) {
                const isMeWinner = trackedPlayer.id === winner.id &&
                    (this.isTimeAttack || (!this.isTimeAttack && sortedPlayers.length > 1 && sortedPlayers[0].score > sortedPlayers[1].score));
                this.updateEndGameStats(isMeWinner, trackedPlayer.score);
            }
        }

        listEl.innerHTML += `<h3 style="text-align:center; margin-bottom:15px; margin-top: 20px;">${this.t('final_scoreboard')}</h3>`;
        
        // Criar tabela
        const table = document.createElement('table');
        table.className = 'final-score-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>${this.t('table_pos')}</th>
                    <th>${this.t('table_player')}</th>
                    <th>${this.t('table_points')}</th>
                    <th>${this.t('table_status')}</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        sortedPlayers.forEach((p, i) => {
            const row = document.createElement('tr');
            if (p.id === winner.id && !isTie) {
                row.className = 'winner-row';
            }
            row.innerHTML = `
                <td>${i + 1}º</td>
                <td>${p.avatar} ${p.name} ${p.id === this.myPlayerId ? `(${this.t('you_tag')})` : ''}</td>
                <td><strong>${p.score}</strong></td>
                <td><span class="${p.active ? 'status-active' : 'status-out'}">${p.active ? this.t('status_active') : this.t('status_out')}</span></td>
            `;
            tbody.appendChild(row);
        });

        listEl.appendChild(table);

        // Share Button (desativado na CrazyGames para evitar risco de cross-promotion externo)
        if (!this.crazyBridge?.isCrazyGames) {
            const btnShare = document.createElement('button');
            btnShare.className = 'btn-primary';
            btnShare.style.width = '100%';
            btnShare.style.marginTop = '20px';
            btnShare.style.background = '#25D366'; // WhatsApp Green
            btnShare.innerHTML = this.t('share_whatsapp');
            btnShare.onclick = () => {
                const gameUrl = window.location.href.split('?')[0];
                let shareText = '';
                
                if (isTie) {
                    shareText = `🤝 Empatamos no VersusLetra! Fizemos ${winner.score} pontos! Desafie a gente em: ${gameUrl}`;
                } else {
                    const isMe = winner.id === this.myPlayerId;
                    shareText = isMe ? 
                        `🏆 Venci o VersusLetra com ${winner.score} pontos! Quem topa o desafio? ${gameUrl}` :
                        `🎮 O ${winner.name} venceu o VersusLetra com ${winner.score} pontos! Tente me ganhar em: ${gameUrl}`;
                }
                
                const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
                window.open(url, '_blank');
            };
            listEl.appendChild(btnShare);
        }

        // Round History UI
        if (this.roundHistory.length > 0) {
            const historyTitle = document.createElement('h3');
            historyTitle.style.textAlign = 'center';
            historyTitle.style.marginTop = '30px';
            historyTitle.textContent = this.t('match_history');
            listEl.appendChild(historyTitle);

            const historyContainer = document.createElement('div');
            historyContainer.className = 'round-history';
            this.roundHistory.forEach(round => {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <span style="font-size:1.2rem">${round.avatar}</span> 
                    <strong>${round.player}</strong>: 
                    <span style="color:${round.success ? '#27ae60' : '#c0392b'}">${round.word}</span> 
                    <em>(${round.category})</em>
                `;
                historyContainer.appendChild(item);
            });
            listEl.appendChild(historyContainer);
        }

        // Footer buttons container
        const btnContainer = document.createElement('div');
        btnContainer.className = 'menu-buttons';
        btnContainer.style.marginTop = '30px';

        // Botão Jogar Novamente (Mesma Sala)
        const btnAgain = document.createElement('button');
        btnAgain.className = 'btn-primary';
        btnAgain.textContent = (this.isOnline && !this.isHost) ? this.t('waiting_host') : this.t('play_again');
        btnAgain.disabled = (this.isOnline && !this.isHost);
        btnAgain.onclick = () => {
            if (this.isOnline) {
                if (this.isHost) {
                    this.broadcast({ type: 'RETURN_TO_LOBBY' });
                    this.processReturnToLobby();
                }
            } else {
                this.startInstantReplay();
            }
        };

        // Botão Sair (Voltar ao Início)
        const btnExit = document.createElement('button');
        btnExit.className = 'btn-secondary';
        btnExit.textContent = this.t('exit_to_menu');
        btnExit.onclick = () => {
            this.endGameSession();
        };

        btnContainer.appendChild(btnAgain);
        btnContainer.appendChild(btnExit);
        listEl.appendChild(btnContainer);

        // Esconder o botão padrão do ranking
        const backRankingBtn = document.getElementById('btn-back-ranking');
        if (backRankingBtn) backRankingBtn.style.display = 'none';
    }

    processReturnToLobby() {
        // Reset player states but keep names/ids
        this.players.forEach(p => {
            p.score = 0;
            p.active = true;
        });
        
        this.usedLetters.clear();
        this.isGameOver = false;
        this.currentPlayerIndex = 0;
        this.currentCategory = '';
        this.lastRoundFailed = false;
        this.roundHistory = [];
        this.powerUpsUsedInCategory.clear();
        
        // Reset Voting State
        this.currentVote = {
            active: false,
            yes: 0,
            no: 0,
            voters: new Set(),
            targetPlayerId: null,
            word: '',
            category: ''
        };

        // Close any modals
        document.getElementById('modal-voting').style.display = 'none';

        // Voltar para a tela de setup (Lobby)
        if (this.isOnline) {
            this.showSetup(true);
            if (this.isHost) {
                this.syncLobby();
            }
        } else {
            this.showSetup(false);
        }
        
        this.playSound('success');
    }

    endGameSession() {
        this.saveAllScores();
        this.isGameOver = false; 
        this.isTimeAttack = false; // Reset Time Attack flag
        // Reset visibility of the back button
        const backRankingBtn = document.getElementById('btn-back-ranking');
        if (backRankingBtn) backRankingBtn.style.display = 'block';
        
        if (this.isOnline) {
            this.exitOnline();
        } else {
            this.showScreen('home');
        }
    }

    saveAllScores() {
        const ranking = JSON.parse(localStorage.getItem('versus-letra-ranking') || '[]');
        const date = new Date().toLocaleDateString('pt-BR');
        
        this.players.forEach(p => {
            if (p.score > 0) {
                // Tenta encontrar se este jogador já tem um score salvo no ranking local
                const existingIndex = ranking.findIndex(entry => entry.name === p.name);
                
                if (existingIndex !== -1) {
                    // Se o novo score for maior, atualiza
                    if (p.score > ranking[existingIndex].score) {
                        ranking[existingIndex] = { name: p.name, score: p.score, date: date, timestamp: Date.now() };
                    }
                } else {
                    ranking.push({ name: p.name, score: p.score, date: date, timestamp: Date.now() });
                }
                
                this.saveGameResult(p.name, p.score);
            }
        });
        
        ranking.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
        localStorage.setItem('versus-letra-ranking', JSON.stringify(ranking.slice(0, 10)));
        this.saveUserData();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    let crazyBridge = null;
    try {
        crazyBridge = await initCrazyGamesBridge();
    } catch (error) {
        console.warn('CrazyGames bridge init failed, using fallback:', error);
    }

    const safeBridge = crazyBridge || {
        isCrazyGames: false,
        loadingStart() {},
        loadingStop() {},
        gameplayStart() {},
        gameplayStop() {},
        happytime() {},
        requestMidgameAd: async () => ({ ok: false, reason: 'sdk_unavailable' }),
        requestRewardedAd: async () => ({ granted: false, reason: 'sdk_unavailable' }),
        applyAudioSettings() {}
    };

    try {
        safeBridge.loadingStart();
        window.game = new VersusLetra(safeBridge);
        registerServiceWorker({ disable: safeBridge.isCrazyGames });
        safeBridge.loadingStop();
    } catch (error) {
        console.error('Game bootstrap failed:', error);
        alert('Erro ao iniciar o jogo. Abra o console (F12) e me envie a mensagem em vermelho.');
    }
});




