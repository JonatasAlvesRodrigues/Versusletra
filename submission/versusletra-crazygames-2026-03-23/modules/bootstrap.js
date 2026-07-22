export function registerServiceWorker(options = {}) {
    const { disable = false } = options;
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

    if (!('serviceWorker' in navigator)) return;

    if (disable || isLocalhost) {
        navigator.serviceWorker.getRegistrations()
            .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
            .catch((error) => console.warn('Failed to unregister Service Workers:', error));
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('Service Worker registrado!', reg))
            .catch((err) => console.log('Erro ao registrar SW:', err));
    });
}
