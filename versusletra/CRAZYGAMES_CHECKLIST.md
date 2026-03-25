# CrazyGames publishing checklist (VersusLetra)

## O que ja esta integrado no codigo
- SDK v3 carregado no `index.html`.
- Inicializacao com `await window.CrazyGames.SDK.init()` via `modules/crazygames.js`.
- Eventos `game.loadingStart/loadingStop` no bootstrap.
- Eventos `game.gameplayStart/gameplayStop` sincronizados por tela.
- `happytime()` disparado em momentos de celebracao.
- Midgame ads solicitados em transicoes de rodada (com pausa e retomada seguras).
- Audio configurado por `game.settings.muteAudio`.
- Scroll da pagina bloqueado no embed (wheel/teclas) para evitar conflito no iframe.
- AdSense externo desativado automaticamente no ambiente CrazyGames.
- Service Worker desativado automaticamente no ambiente CrazyGames.
- Novo usuario no CrazyGames entra como convidado e recebe inicio rapido de partida.

## Validacoes manuais antes de subir
1. Testar local com `?platform=crazygames` e confirmar:
   - Inicio rapido no primeiro acesso.
   - Sem blocos de AdSense.
   - Rodada dispara `requestAd("midgame")` sem quebrar fluxo quando `adError` ocorrer.
2. Testar sem `?platform=crazygames`:
   - AdSense carrega normalmente.
   - Service Worker registra normalmente.
3. Confirmar que a versao final usa caminhos relativos e assets carregam no bundle.
4. Validar UX em iframe desktop e mobile (foco, audio, teclado, timeout).

## Links oficiais
- Technical requirements: https://docs.crazygames.com/requirements/technical/
- Gameplay requirements: https://docs.crazygames.com/requirements/gameplay/
- Advertisement requirements: https://docs.crazygames.com/requirements/ads/
- SDK game module: https://docs.crazygames.com/sdk/game/
- SDK video ads: https://docs.crazygames.com/sdk/video-ads/
