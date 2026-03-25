const DEFAULT_PARTY_CATEGORIES = ['Animal', 'Fruta', 'Objeto', 'Cor', 'Profissão', 'Comida', 'Esporte', 'Parte do corpo', 'País', 'Marca', 'Filme', 'Cantor(a)'];

export function startPartyGame(ctx) {
    const startLogic = () => {
        const count = document.querySelector('.btn-player-count.active').dataset.count;
        ctx.partyPlayersLeft = parseInt(count, 10);
        ctx.partyUsedLetters = new Set();
        ctx.partyTotalLetters = 0;
        ctx.partyTimeLeft = 10;
        ctx.partyPlayers = Array.from({ length: ctx.partyPlayersLeft }, (_, i) => ({
            id: `party-${i + 1}`,
            name: `Jogador ${i + 1}`,
            score: 0,
            active: true
        }));
        ctx.partyCurrentPlayerIndex = 0;

        document.getElementById('party-setup').style.display = 'none';
        document.getElementById('party-gameplay').style.display = 'block';
        if (typeof ctx.syncCrazyGameplayByScreen === 'function') {
            ctx.syncCrazyGameplayByScreen('party-mode');
        }
        document.getElementById('party-players-left').textContent = ctx.partyPlayersLeft;

        ctx.partyCategory = getRandomPartyCategory(ctx);
        document.getElementById('party-current-category').textContent = ctx.partyCategory.toUpperCase();

        renderPartyKeyboard(ctx);
        startPartyTimer(ctx);
    };

    if (!localStorage.getItem('versus-letra-seen-party')) {
        ctx.showModeInstructions('party', false, startLogic);
    } else {
        startLogic();
    }
}

export function getPartyCategories(ctx) {
    if (ctx.customCategories && ctx.customCategories.size > 0) {
        return [...ctx.customCategories];
    }
    return DEFAULT_PARTY_CATEGORIES;
}

export function getRandomPartyCategory(ctx, excludeCategory = null) {
    const categories = getPartyCategories(ctx);
    if (categories.length === 0) return 'Animal';
    const pool = (excludeCategory && categories.length > 1)
        ? categories.filter(cat => cat !== excludeCategory)
        : categories;
    return pool[Math.floor(Math.random() * pool.length)];
}

export function renderPartyKeyboard(ctx) {
    const keyboard = document.getElementById('party-keyboard');
    keyboard.innerHTML = '';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    letters.forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'btn-letter';
        btn.textContent = letter;
        btn.onclick = () => handlePartyLetterClick(ctx, letter, btn);
        keyboard.appendChild(btn);
    });
}

export function handlePartyLetterClick(ctx, letter, btn) {
    if (btn.classList.contains('used')) return;

    ctx.playSound('success');
    ctx.vibrate(50);

    btn.classList.add('used');
    ctx.partyUsedLetters.add(letter);
    ctx.partyTotalLetters = (ctx.partyTotalLetters || 0) + 1;
    const currentPlayer = ctx.partyPlayers?.[ctx.partyCurrentPlayerIndex];
    if (currentPlayer && currentPlayer.active) {
        currentPlayer.score += 1;
    }
    document.getElementById('party-used-count').textContent = ctx.partyUsedLetters.size;

    ctx.partyTimeLeft = 10;
    updatePartyTimerUI(ctx);
    advancePartyTurn(ctx);

    const alert = document.getElementById('party-turn-alert');
    alert.style.display = 'block';
    setTimeout(() => {
        alert.style.display = 'none';
    }, 1500);
}

export function startPartyTimer(ctx) {
    if (ctx.partyTimer) clearInterval(ctx.partyTimer);

    ctx.partyTimer = setInterval(() => {
        ctx.partyTimeLeft--;
        updatePartyTimerUI(ctx);

        if (ctx.partyTimeLeft <= 0) {
            handlePartyElimination(ctx);
        }
    }, 1000);
}

export function updatePartyTimerUI(ctx) {
    const timerEl = document.getElementById('party-timer');
    timerEl.textContent = ctx.partyTimeLeft;

    timerEl.classList.remove('warning', 'danger');
    if (ctx.partyTimeLeft <= 5 && ctx.partyTimeLeft > 2) {
        timerEl.classList.add('warning');
        ctx.playSound('tick');
    } else if (ctx.partyTimeLeft <= 2) {
        timerEl.classList.add('danger');
        ctx.playSound('tick');
        ctx.vibrate(100);
    }
}

export function handlePartyElimination(ctx) {
    clearInterval(ctx.partyTimer);
    ctx.playSound('error');
    ctx.vibrate([200, 100, 200]);

    const eliminatedPlayer = ctx.partyPlayers?.[ctx.partyCurrentPlayerIndex];
    if (eliminatedPlayer) {
        eliminatedPlayer.active = false;
    }

    ctx.partyPlayersLeft--;
    document.getElementById('party-players-left').textContent = ctx.partyPlayersLeft;

    if (ctx.partyPlayersLeft > 1) {
        ctx.partyCategory = getRandomPartyCategory(ctx, ctx.partyCategory);
        document.getElementById('party-current-category').textContent = ctx.partyCategory.toUpperCase();
        ctx.partyUsedLetters.clear();
        document.getElementById('party-used-count').textContent = '0';
        renderPartyKeyboard(ctx);

        alert(ctx.t('party_timeout_alert'));
        ctx.partyTimeLeft = 10;
        updatePartyTimerUI(ctx);
        advancePartyTurn(ctx);
        startPartyTimer(ctx);
    } else {
        endPartyGame(ctx);
    }
}

export function advancePartyTurn(ctx) {
    if (!ctx.partyPlayers || ctx.partyPlayers.length === 0) return;
    let nextIndex = ctx.partyCurrentPlayerIndex;
    for (let i = 0; i < ctx.partyPlayers.length; i++) {
        nextIndex = (nextIndex + 1) % ctx.partyPlayers.length;
        if (ctx.partyPlayers[nextIndex].active) {
            ctx.partyCurrentPlayerIndex = nextIndex;
            return;
        }
    }
}

export function showPartyFinalResults(ctx, finalScore, bestScore) {
    const listEl = document.getElementById('ranking-list');
    if (!listEl) return;

    ctx.showScreen('ranking');
    listEl.innerHTML = '';

    const sortedPlayers = [...(ctx.partyPlayers || [])].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0] || { name: 'Jogador', score: 0 };

    const winnerBanner = document.createElement('div');
    winnerBanner.className = 'winner-banner';
    winnerBanner.innerHTML = `
            <div class="winner-icon">👑</div>
            <div class="winner-text">${ctx.t('party_winner_title')}</div>
            <div class="winner-name">${winner.name}</div>
        `;
    listEl.appendChild(winnerBanner);

    const subtitle = document.createElement('p');
    subtitle.style.textAlign = 'center';
    subtitle.style.margin = '10px 0 20px 0';
    subtitle.innerHTML = `${ctx.t('total_letters')}: <strong>${finalScore}</strong> ${finalScore > bestScore ? `• ${ctx.t('new_record')}` : ''}`;
    listEl.appendChild(subtitle);

    const table = document.createElement('table');
    table.className = 'final-score-table';
    table.innerHTML = `
            <thead>
                <tr>
                    <th>${ctx.t('table_pos')}</th>
                    <th>${ctx.t('table_player')}</th>
                    <th>${ctx.t('table_points')}</th>
                    <th>${ctx.t('table_status')}</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

    const tbody = table.querySelector('tbody');
    sortedPlayers.forEach((player, index) => {
        const row = document.createElement('tr');
        if (index === 0) row.className = 'winner-row';
        row.innerHTML = `
                <td>${index + 1}º</td>
                <td>${player.name}</td>
                <td><strong>${player.score}</strong></td>
                <td>${index === 0 ? ctx.t('winner_word') : ctx.t('status_out')}</td>
            `;
        tbody.appendChild(row);
    });
    listEl.appendChild(table);

    const btnContainer = document.createElement('div');
    btnContainer.className = 'menu-buttons';
    btnContainer.style.marginTop = '30px';

    const btnAgain = document.createElement('button');
    btnAgain.className = 'btn-primary';
    btnAgain.textContent = ctx.t('play_again');
    btnAgain.onclick = () => {
        ctx.showScreen('party-mode');
        document.getElementById('party-setup').style.display = 'flex';
        document.getElementById('party-gameplay').style.display = 'none';
    };

    const btnExit = document.createElement('button');
    btnExit.className = 'btn-secondary';
    btnExit.textContent = ctx.t('exit_to_menu');
    btnExit.onclick = () => ctx.showScreen('home');

    btnContainer.appendChild(btnAgain);
    btnContainer.appendChild(btnExit);
    listEl.appendChild(btnContainer);
}

export function endPartyGame(ctx) {
    clearInterval(ctx.partyTimer);
    if (typeof ctx.syncCrazyGameplayByScreen === 'function') {
        ctx.syncCrazyGameplayByScreen('ranking');
    }
    const finalScore = ctx.partyTotalLetters || 0;

    const bestScore = parseInt(localStorage.getItem('versus-letra-party-record'), 10) || 0;
    if (finalScore > bestScore) {
        localStorage.setItem('versus-letra-party-record', finalScore);
    }

    showPartyFinalResults(ctx, finalScore, bestScore);
    document.getElementById('party-setup').style.display = 'flex';
    document.getElementById('party-gameplay').style.display = 'none';
}

export function renderPartyCategoriesList(ctx) {
    const listEl = document.getElementById('party-categories-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    ctx.customCategories.forEach(cat => {
        const tag = document.createElement('span');
        tag.className = 'category-tag';
        tag.innerHTML = `${cat} <span class="remove-cat">×</span>`;
        tag.querySelector('.remove-cat').onclick = () => {
            ctx.customCategories.delete(cat);
            renderPartyCategoriesList(ctx);
        };
        listEl.appendChild(tag);
    });
}
