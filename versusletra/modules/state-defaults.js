export const DEFAULT_ACHIEVEMENTS = {
    dicionario: false,
    flash: false,
    invencivel: 0,
    maratonista: 0,
    vitoria_perfeita: false,
    pioneiro: false,
    colecionador: 0,
    mestre_letras: false,
    socialite: 0,
    estrategista_count: 0,
    veloz_furioso: false,
    veterano: 0,
    rei_da_sala_count: 0,
    online_wins_count: 0,
    perfeccionista_count: 0
};

export const SCREEN_ELEMENT_IDS = {
    home: 'home-screen',
    admin: 'admin-screen',
    setup: 'setup-screen',
    game: 'game-screen',
    result: 'result-screen',
    ranking: 'ranking-screen',
    about: 'about-screen',
    login: 'login-screen',
    signup: 'signup-screen',
    profile: 'profile-screen',
    friends: 'friends-screen',
    settings: 'settings-screen',
    'party-mode': 'party-mode-screen'
};

export function buildScreensMap(doc = document) {
    return Object.fromEntries(
        Object.entries(SCREEN_ELEMENT_IDS).map(([key, elementId]) => [key, doc.getElementById(elementId)])
    );
}
