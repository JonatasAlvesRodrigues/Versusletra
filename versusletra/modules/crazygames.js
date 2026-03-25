const CRAZYGAMES_HOST_REGEX = /(^|\.)crazygames\.com$/i;
const ADSENSE_CLIENT = 'ca-pub-3344267063155354';

function safeUrlHost(url) {
    try {
        return new URL(url).hostname;
    } catch (_) {
        return '';
    }
}

function isReferrerCrazyGames() {
    const host = safeUrlHost(document.referrer || '');
    return CRAZYGAMES_HOST_REGEX.test(host);
}

function hasCrazyGamesQueryHint() {
    const params = new URLSearchParams(window.location.search);
    return params.get('platform') === 'crazygames' || params.get('crazygames') === '1';
}

function loadAdsenseScript() {
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '';
    if (isLocalHost) return;

    if (document.querySelector('script[data-adsense-loader="true"]')) return;

    const script = document.createElement('script');
    script.async = true;
    script.dataset.adsenseLoader = 'true';
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.addEventListener('load', () => {
        document.querySelectorAll('ins.adsbygoogle').forEach(() => {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (error) {
                console.warn('AdSense slot failed:', error);
            }
        });
    });
    document.head.appendChild(script);
}

function hideExternalAdsForCrazyGames() {
    document.querySelectorAll('.ad-container').forEach((el) => {
        el.style.display = 'none';
    });
}

function sanitizeExternalLinksForCrazyGames() {
    document.body.classList.add('is-crazygames');

    document.querySelectorAll('.support-links, .social-links').forEach((el) => {
        el.style.display = 'none';
    });

    const qrImg = document.querySelector('#modal-qr img');
    if (qrImg) {
        qrImg.removeAttribute('src');
    }
}

function preventPageScrollInEmbed() {
    window.addEventListener('wheel', (event) => {
        event.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', (event) => {
        const target = event.target;
        const isEditable = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        );

        if (isEditable) return;

        if (['ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
            event.preventDefault();
        }
    });
}

function createNoopBridge() {
    return {
        isCrazyGames: false,
        sdkReady: false,
        loadingStart() {},
        loadingStop() {},
        gameplayStart() {},
        gameplayStop() {},
        happytime() {},
        requestMidgameAd() {
            return Promise.resolve(false);
        },
        requestRewardedAd() {
            return Promise.resolve({ granted: false, reason: 'sdk_unavailable' });
        },
        applyAudioSettings() {},
        applyEmbedInputGuards() {}
    };
}

export async function initCrazyGamesBridge() {
    const bridge = createNoopBridge();
    const sdk = window.CrazyGames?.SDK;

    const queryHint = hasCrazyGamesQueryHint();
    const referrerHint = isReferrerCrazyGames();

    if (!sdk) {
        if (!queryHint && !referrerHint) {
            loadAdsenseScript();
        }
        return bridge;
    }

    try {
        await sdk.init();
    } catch (error) {
        console.warn('CrazyGames SDK init failed:', error);
    }

    const envIsCrazyGames = Boolean(sdk?.environment?.isCrazygames);
    const isCrazyGames = envIsCrazyGames || queryHint || referrerHint;

    if (!isCrazyGames) {
        loadAdsenseScript();
        return bridge;
    }

    hideExternalAdsForCrazyGames();
    sanitizeExternalLinksForCrazyGames();
    preventPageScrollInEmbed();

    let gameplayActive = false;

    const gameplay = sdk?.game;
    const ad = sdk?.ad;

    const applyAudioSettings = (game) => {
        if (!game || !gameplay) return;

        const applySettings = (settings) => {
            if (!settings) return;
            if (typeof settings.muteAudio === 'boolean' && settings.muteAudio !== game.isMuted) {
                game.toggleMute();
            }
        };

        applySettings(gameplay.settings);

        const listener = (newSettings) => applySettings(newSettings);
        try {
            gameplay.addSettingsChangeListener?.(listener);
        } catch (error) {
            console.warn('Failed to register settings listener:', error);
        }
    };

    const requestAd = (type) => new Promise((resolve) => {
        if (!ad?.requestAd) {
            resolve({ ok: false, reason: 'ad_module_unavailable' });
            return;
        }

        let adStarted = false;

        ad.requestAd(type, {
            adStarted: () => {
                adStarted = true;
            },
            adFinished: () => resolve({ ok: true, state: 'finished', adStarted }),
            adError: (error) => resolve({ ok: false, reason: error?.code || 'ad_error', error, adStarted })
        });
    });

    return {
        isCrazyGames: true,
        sdkReady: true,
        loadingStart() {
            gameplay?.loadingStart?.();
        },
        loadingStop() {
            gameplay?.loadingStop?.();
        },
        gameplayStart() {
            if (gameplayActive) return;
            gameplay?.gameplayStart?.();
            gameplayActive = true;
        },
        gameplayStop() {
            if (!gameplayActive) return;
            gameplay?.gameplayStop?.();
            gameplayActive = false;
        },
        happytime() {
            gameplay?.happytime?.();
        },
        async requestMidgameAd() {
            return requestAd('midgame');
        },
        async requestRewardedAd() {
            const result = await requestAd('rewarded');
            return {
                granted: result.ok && result.state === 'finished',
                ...result
            };
        },
        applyAudioSettings,
        applyEmbedInputGuards: preventPageScrollInEmbed
    };
}
