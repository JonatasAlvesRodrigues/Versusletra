export function getHowToContentByLang(language) {
    if (language === 'en') {
        return `
            <p><strong>Goal:</strong> Show you are the word master and climb the ranking!</p>
            <h4>Game Modes</h4>
            <ul>
                <li><strong>Play Online:</strong> Create rooms or join friends in real-time P2P matches.</li>
                <li><strong>Time Attack (Solo):</strong> You have 1 minute to get as many words as possible.</li>
                <li><strong>Party Mode (Mobile Only):</strong> Pass the phone around. Each player has 10 seconds.</li>
            </ul>
            <h4>General Rules</h4>
            <ul>
                <li>A <strong>Category</strong> is selected for the round.</li>
                <li>Pick an available <strong>Letter</strong> on the keyboard.</li>
                <li>Type a word that starts with that letter and confirm.</li>
            </ul>
            <h4>Validation & XP</h4>
            <ul>
                <li><strong>Voting:</strong> In online mode, players vote if a doubtful word is valid.</li>
                <li><strong>XP & Level:</strong> Correct answers give XP and unlock rewards.</li>
            </ul>
            <div class="points-table">
                <h4>Scoring Tip</h4>
                <p>Longer words and faster answers give more points and XP.</p>
            </div>
        `;
    }
    if (language === 'es') {
        return `
            <p><strong>Objetivo:</strong> Demuestra que eres el maestro de palabras y sube en el ranking.</p>
            <h4>Modos de juego</h4>
            <ul>
                <li><strong>Jugar en línea:</strong> Crea salas o entra a salas de amigos en tiempo real.</li>
                <li><strong>Contra reloj (Solo):</strong> Tienes 1 minuto para acertar la mayor cantidad de palabras.</li>
                <li><strong>Modo Fiesta (Solo móvil):</strong> Pasen el celular. Cada jugador tiene 10 segundos.</li>
            </ul>
            <h4>Reglas generales</h4>
            <ul>
                <li>Se sortea una <strong>Categoría</strong> para la ronda.</li>
                <li>Elige una <strong>Letra</strong> disponible del teclado.</li>
                <li>Escribe una palabra que empiece con esa letra y confirma.</li>
            </ul>
            <h4>Validación y XP</h4>
            <ul>
                <li><strong>Votación:</strong> En línea, los jugadores votan si una palabra dudosa vale.</li>
                <li><strong>XP y Nivel:</strong> Los aciertos dan XP y desbloquean recompensas.</li>
            </ul>
            <div class="points-table">
                <h4>Consejo de puntuación</h4>
                <p>Palabras más largas y respuestas rápidas dan más puntos y XP.</p>
            </div>
        `;
    }
    return `
        <p><strong>Objetivo:</strong> Mostre que você é o mestre das palavras e conquiste o ranking!</p>
        <h4>Modos de Jogo</h4>
        <ul>
            <li><strong>Jogar Online:</strong> Crie salas ou entre em salas de amigos para disputar em tempo real usando tecnologia P2P.</li>
            <li><strong>Contra o Relógio (Solo):</strong> Você tem 1 minuto para acertar o máximo de palavras.</li>
            <li><strong>Modo Galera (Exclusivo Mobile):</strong> Passem o celular. Cada jogador tem 10 segundos.</li>
        </ul>
        <h4>Regras Gerais</h4>
        <ul>
            <li>Uma <strong>Categoria</strong> é sorteada para a rodada.</li>
            <li>Escolha uma <strong>Letra</strong> disponível no teclado visual.</li>
            <li>Digite uma palavra que comece com essa letra e confirme.</li>
        </ul>
        <h4>Validação e XP</h4>
        <ul>
            <li><strong>Votação:</strong> No modo online, os jogadores decidem se uma palavra duvidosa vale.</li>
            <li><strong>XP e Nível:</strong> Cada acerto dá experiência e desbloqueia recompensas.</li>
        </ul>
        <div class="points-table">
            <h4>Dica de Pontuação</h4>
            <p>Palavras mais longas e respostas mais rápidas garantem mais pontos e XP.</p>
        </div>
    `;
}

export function getAboutContentByLang(language) {
    if (language === 'en') {
        return `
            <div class="profile-image-container"><img src="perfil.png" alt="Jonatas Alves Rodrigues" class="profile-img"></div>
            <p>Hi! I'm <strong>Jonatas Alves Rodrigues</strong>, 20 years old, and a Systems Analysis and Development student.</p>
            <p><strong>VersusLetra</strong> is an ongoing project and your feedback is very important. Found a bug or have an idea? Contact me:</p>
            <div class="support-links">
                <a href="mailto:jonatasalves2005rodrigues@gmail.com" class="support-btn email">📧 jonatasalves2005rodrigues@gmail.com</a>
                <a href="https://wa.me/5518996919025" target="_blank" class="support-btn whatsapp">💬 WhatsApp Support: (18) 99691-9025</a>
            </div>
            <div class="social-links">
                <p>Follow my work on Instagram:</p>
                <a href="https://instagram.com/jhowalves_rodrigues" target="_blank" class="instagram-link">@jhowalves_rodrigues</a>
            </div>
        `;
    }
    if (language === 'es') {
        return `
            <div class="profile-image-container"><img src="perfil.png" alt="Jonatas Alves Rodrigues" class="profile-img"></div>
            <p>¡Hola! Soy <strong>Jonatas Alves Rodrigues</strong>, tengo 20 años y estudio Análisis y Desarrollo de Sistemas.</p>
            <p><strong>VersusLetra</strong> está en desarrollo y tu opinión es fundamental. Si encuentras un error o tienes una idea, contáctame:</p>
            <div class="support-links">
                <a href="mailto:jonatasalves2005rodrigues@gmail.com" class="support-btn email">📧 jonatasalves2005rodrigues@gmail.com</a>
                <a href="https://wa.me/5518996919025" target="_blank" class="support-btn whatsapp">💬 Soporte por WhatsApp: (18) 99691-9025</a>
            </div>
            <div class="social-links">
                <p>Sigue mi trabajo en Instagram:</p>
                <a href="https://instagram.com/jhowalves_rodrigues" target="_blank" class="instagram-link">@jhowalves_rodrigues</a>
            </div>
        `;
    }
    return `
        <div class="profile-image-container"><img src="perfil.png" alt="Jonatas Alves Rodrigues" class="profile-img"></div>
        <p>Olá! Eu sou o <strong>Jonatas Alves Rodrigues</strong>, tenho 20 anos e sou estudante de <strong>Análise e Desenvolvimento de Sistemas</strong>.</p>
        <p>O <strong>VersusLetra</strong> é um projeto em desenvolvimento e seu feedback é fundamental! Se encontrar um erro ou tiver uma ideia incrível, entre em contato:</p>
        <div class="support-links">
            <a href="mailto:jonatasalves2005rodrigues@gmail.com" class="support-btn email">📧 jonatasalves2005rodrigues@gmail.com</a>
            <a href="https://wa.me/5518996919025" target="_blank" class="support-btn whatsapp">💬 WhatsApp Suporte: (18) 99691-9025</a>
        </div>
        <div class="social-links">
            <p>Acompanhe meu trabalho no Instagram:</p>
            <a href="https://instagram.com/jhowalves_rodrigues" target="_blank" class="instagram-link">@jhowalves_rodrigues</a>
        </div>
    `;
}

export function getLegalModalHtml(language, type) {
    if (type === 'privacy') {
        if (language === 'en') {
            return `
                <h3>Privacy Policy</h3>
                <p><strong>VersusLetra</strong> values your privacy. This policy explains how we handle your data:</p>
                <ul>
                    <li><strong>Collected Data:</strong> We only collect your e-mail and nickname for authentication and ranking.</li>
                    <li><strong>Storage:</strong> We use LocalStorage to save preferences such as theme, avatar and progress.</li>
                    <li><strong>Third Parties:</strong> We use Google AdSense and Supabase, each with its own privacy policy.</li>
                    <li><strong>Security:</strong> Your data is stored securely and will never be sold.</li>
                </ul>
            `;
        }
        if (language === 'es') {
            return `
                <h3>Política de Privacidad</h3>
                <p><strong>VersusLetra</strong> valora tu privacidad. Esta política explica cómo tratamos tus datos:</p>
                <ul>
                    <li><strong>Datos recopilados:</strong> Solo recopilamos correo y nickname para autenticación y ranking.</li>
                    <li><strong>Almacenamiento:</strong> Usamos LocalStorage para guardar preferencias como tema, avatar y progreso.</li>
                    <li><strong>Terceros:</strong> Usamos Google AdSense y Supabase, cada uno con su propia política.</li>
                    <li><strong>Seguridad:</strong> Tus datos se almacenan de forma segura y nunca se venderán.</li>
                </ul>
            `;
        }
        return `
            <h3>Política de Privacidade</h3>
            <p>O <strong>VersusLetra</strong> valoriza a sua privacidade. Esta política explica como lidamos com seus dados:</p>
            <ul>
                <li><strong>Dados Coletados:</strong> Coletamos apenas o seu e-mail e nickname para fins de autenticação e ranking.</li>
                <li><strong>Uso de Cookies:</strong> Utilizamos o armazenamento local (LocalStorage) para salvar suas preferências de tema, avatar e progresso.</li>
                <li><strong>Terceiros:</strong> Utilizamos o Google AdSense para exibir anúncios e o Supabase para armazenamento de dados. Ambos possuem suas próprias políticas de privacidade.</li>
                <li><strong>Segurança:</strong> Seus dados são armazenados de forma segura e nunca serão vendidos a terceiros.</li>
            </ul>
            <p>Ao utilizar o jogo, você concorda com estes termos.</p>
        `;
    }

    if (language === 'en') {
        return `
            <h3>Terms of Use</h3>
            <p>Welcome to <strong>VersusLetra</strong>! By playing, you agree to:</p>
            <ul>
                <li><strong>Respect:</strong> Do not use offensive or inappropriate nicknames.</li>
                <li><strong>Fair Play:</strong> Bots and cheating to climb ranking are forbidden.</li>
                <li><strong>Content:</strong> Keep the environment friendly for all ages.</li>
                <li><strong>Responsibility:</strong> The developer is not responsible for losses from misuse.</li>
            </ul>
        `;
    }
    if (language === 'es') {
        return `
            <h3>Términos de Uso</h3>
            <p>¡Bienvenido a <strong>VersusLetra</strong>! Al jugar, aceptas:</p>
            <ul>
                <li><strong>Respeto:</strong> No uses nicknames ofensivos o inapropiados.</li>
                <li><strong>Juego limpio:</strong> Se prohíben bots y trampas para subir en el ranking.</li>
                <li><strong>Contenido:</strong> Mantén un ambiente amigable para todas las edades.</li>
                <li><strong>Responsabilidad:</strong> El desarrollador no se responsabiliza por uso indebido.</li>
            </ul>
        `;
    }
    return `
        <h3>Termos de Uso</h3>
        <p>Bem-vindo ao <strong>VersusLetra</strong>! Ao jogar, você concorda com:</p>
        <ul>
            <li><strong>Respeito:</strong> Não utilize nicknames ofensivos ou inapropriados.</li>
            <li><strong>Fair Play:</strong> O uso de bots ou trapaças para subir no ranking é proibido.</li>
            <li><strong>Conteúdo:</strong> O jogo é destinado a todas as idades. Mantenha o ambiente amigável.</li>
            <li><strong>Responsabilidade:</strong> O desenvolvedor não se responsabiliza por perdas de dados decorrentes de mau uso do sistema.</li>
        </ul>
        <p>Divirta-se e bom jogo!</p>
    `;
}

export function getModeInstructionByLang(language, mode) {
    const contentByMode = {
        'time-attack': {
            pt: {
                title: '⏱️ Modo Contra o Relógio',
                body: `<div class="instruction-body"><p>Você tem <span class="highlight">1 minuto (60s)</span> para acertar o máximo de palavras possíveis.</p><h4>Como funciona:</h4><ul><li>Uma categoria é sorteada para a rodada inteira.</li><li>Escolha uma letra livre no teclado e digite uma palavra válida.</li><li>Cada acerto rende pontos e <span class="highlight">XP</span>.</li></ul></div>`
            },
            en: {
                title: '⏱️ Time Attack Mode',
                body: `<div class="instruction-body"><p>You have <span class="highlight">1 minute (60s)</span> to get as many correct words as possible.</p><h4>How it works:</h4><ul><li>One category is selected for the whole round.</li><li>Pick a free letter and type a valid word.</li><li>Each correct answer gives points and <span class="highlight">XP</span>.</li></ul></div>`
            },
            es: {
                title: '⏱️ Modo Contra Reloj',
                body: `<div class="instruction-body"><p>Tienes <span class="highlight">1 minuto (60s)</span> para acertar la mayor cantidad de palabras.</p><h4>Cómo funciona:</h4><ul><li>Se elige una categoría para toda la ronda.</li><li>Elige una letra libre y escribe una palabra válida.</li><li>Cada acierto da puntos y <span class="highlight">XP</span>.</li></ul></div>`
            }
        },
        party: {
            pt: {
                title: '👫 Modo Galera',
                body: `<div class="instruction-body"><p>Um desafio social para jogar com amigos passando o celular.</p><h4>Regras:</h4><ul><li>Cada jogador tem <span class="highlight">10 segundos</span> para agir.</li><li>Fale uma palavra e passe o celular para o próximo.</li><li>Se o tempo zerar na sua mão, você é eliminado.</li></ul></div>`
            },
            en: {
                title: '👫 Party Mode',
                body: `<div class="instruction-body"><p>A social challenge to play by passing the phone around.</p><h4>Rules:</h4><ul><li>Each player has <span class="highlight">10 seconds</span> to act.</li><li>Say a word and pass the phone to the next player.</li><li>If time runs out in your hand, you are eliminated.</li></ul></div>`
            },
            es: {
                title: '👫 Modo Fiesta',
                body: `<div class="instruction-body"><p>Un desafío social para jugar pasando el celular.</p><h4>Reglas:</h4><ul><li>Cada jugador tiene <span class="highlight">10 segundos</span> para actuar.</li><li>Di una palabra y pasa el celular al siguiente.</li><li>Si se acaba el tiempo en tu mano, quedas eliminado.</li></ul></div>`
            }
        },
        online: {
            pt: {
                title: '🌐 Jogar Online (Multiplayer)',
                body: `<div class="instruction-body"><p>Dispute em tempo real com seus amigos.</p><h4>Como funciona:</h4><ul><li>Crie uma sala ou entre com o código de um amigo.</li><li>Escolha uma letra e envie uma palavra válida para a categoria.</li><li>Palavras duvidosas podem ir para votação.</li></ul></div>`
            },
            en: {
                title: '🌐 Play Online (Multiplayer)',
                body: `<div class="instruction-body"><p>Compete with your friends in real time.</p><h4>How it works:</h4><ul><li>Create a room or join with a friend code.</li><li>Pick a letter and send a valid word for the category.</li><li>Doubtful words can be decided by voting.</li></ul></div>`
            },
            es: {
                title: '🌐 Jugar en Línea (Multijugador)',
                body: `<div class="instruction-body"><p>Compite con tus amigos en tiempo real.</p><h4>Cómo funciona:</h4><ul><li>Crea una sala o entra con código de un amigo.</li><li>Elige una letra y envía una palabra válida para la categoría.</li><li>Las palabras dudosas se pueden decidir por votación.</li></ul></div>`
            }
        }
    };

    return (contentByMode[mode] && contentByMode[mode][language]) || (contentByMode[mode] && contentByMode[mode].pt) || null;
}

export function localizeRuntimeTextByLang(language, text) {
    if (language === 'pt') return text;

    const map = language === 'en' ? {
        'Faça login para seguir amigos!': 'Log in to follow friends!',
        'Digite um nickname!': 'Enter a nickname!',
        'Você não pode seguir a si mesmo!': 'You cannot follow yourself!',
        'Jogador não encontrado!': 'Player not found!',
        'Você já segue este jogador!': 'You already follow this player!',
        'Erro ao seguir amigo.': 'Error following friend.',
        'Você já está em uma sala!': 'You are already in a room!',
        'Erro ao deixar de seguir.': 'Error unfollowing friend.',
        'Digite o nickname do host!': 'Enter host nickname!',
        'Não foi possível iniciar o modo online.': 'Could not start online mode.',
        'Digite o código ou nick do Host!': 'Enter host code or nickname!',
        'Aguardando rede... Tente novamente.': 'Waiting for network... Try again.',
        'Sala não encontrada para este nickname.': 'Room not found for this nickname.',
        'O Host desconectou.': 'Host disconnected.',
        'Você foi expulso da sala pelo Host.': 'You were kicked by the host.',
        'ID copiado!': 'ID copied!',
        'Preencha todos os campos!': 'Fill in all fields!',
        'A senha deve ter pelo menos 6 caracteres!': 'Password must have at least 6 characters!',
        'Este nickname já está em uso. Escolha outro!': 'This nickname is already in use. Choose another.',
        'Conta criada com sucesso!': 'Account created successfully!',
        'Verifique seu e-mail para confirmar a conta!': 'Check your e-mail to confirm your account!',
        'Preencha e-mail e senha!': 'Fill in e-mail and password!',
        'E-mail ou senha incorretos.': 'Incorrect e-mail or password.',
        'Por favor, confirme seu e-mail antes de entrar.': 'Please confirm your e-mail before logging in.',
        'O nickname não pode ser vazio!': 'Nickname cannot be empty!',
        'Nickname atualizado com sucesso!': 'Nickname updated successfully!',
        'Digite uma sugestão!': 'Type a suggestion!',
        'Sugestão enviada com sucesso! Obrigado.': 'Suggestion sent successfully! Thank you.',
        'Você saiu da conta.': 'You logged out.',
        'Adicione pelo menos uma categoria!': 'Add at least one category!',
        'Sem dicas para esta categoria!': 'No hints for this category!',
        'Comece a digitar ou escolha uma letra!': 'Start typing or choose a letter!'
    } : {
        'Faça login para seguir amigos!': '¡Inicia sesión para seguir amigos!',
        'Digite um nickname!': '¡Escribe un nickname!',
        'Você não pode seguir a si mesmo!': '¡No puedes seguirte a ti mismo!',
        'Jogador não encontrado!': '¡Jugador no encontrado!',
        'Você já segue este jogador!': '¡Ya sigues a este jugador!',
        'Erro ao seguir amigo.': 'Error al seguir amigo.',
        'Você já está em uma sala!': '¡Ya estás en una sala!',
        'Erro ao deixar de seguir.': 'Error al dejar de seguir.',
        'Digite o nickname do host!': '¡Escribe el nickname del host!',
        'Não foi possível iniciar o modo online.': 'No se pudo iniciar el modo en línea.',
        'Digite o código ou nick do Host!': '¡Escribe el código o nick del host!',
        'Aguardando rede... Tente novamente.': 'Esperando red... Intenta de nuevo.',
        'Sala não encontrada para este nickname.': 'No se encontró sala para ese nickname.',
        'O Host desconectou.': 'El host se desconectó.',
        'Você foi expulso da sala pelo Host.': 'Fuiste expulsado de la sala por el host.',
        'ID copiado!': '¡ID copiado!',
        'Preencha todos os campos!': '¡Completa todos los campos!',
        'A senha deve ter pelo menos 6 caracteres!': '¡La contraseña debe tener al menos 6 caracteres!',
        'Este nickname já está em uso. Escolha outro!': '¡Ese nickname ya está en uso. Elige otro!',
        'Conta criada com sucesso!': '¡Cuenta creada con éxito!',
        'Verifique seu e-mail para confirmar a conta!': '¡Revisa tu correo para confirmar la cuenta!',
        'Preencha e-mail e senha!': '¡Completa correo y contraseña!',
        'E-mail ou senha incorretos.': 'Correo o contraseña incorrectos.',
        'Por favor, confirme seu e-mail antes de entrar.': 'Confirma tu correo antes de entrar.',
        'O nickname não pode ser vazio!': '¡El nickname no puede estar vacío!',
        'Nickname atualizado com sucesso!': '¡Nickname actualizado con éxito!',
        'Digite uma sugestão!': '¡Escribe una sugerencia!',
        'Sugestão enviada com sucesso! Obrigado.': '¡Sugerencia enviada con éxito! Gracias.',
        'Você saiu da conta.': 'Cerraste sesión.',
        'Adicione pelo menos uma categoria!': 'Añade al menos una categoría.',
        'Sem dicas para esta categoria!': 'No hay pistas para esta categoría.',
        'Comece a digitar ou escolha uma letra!': 'Empieza a escribir o elige una letra.'
    };

    if (map[text]) return map[text];
    if (language === 'en') {
        if (text.startsWith('Erro ao criar conta: ')) return `Error creating account: ${text.replace('Erro ao criar conta: ', '')}`;
        if (text.startsWith('Erro ao entrar: ')) return `Login error: ${text.replace('Erro ao entrar: ', '')}`;
        if (text.startsWith('Erro ao atualizar nickname: ')) return `Nickname update error: ${text.replace('Erro ao atualizar nickname: ', '')}`;
        if (text.startsWith('Erro ao enviar sugestão: ')) return `Suggestion send error: ${text.replace('Erro ao enviar sugestão: ', '')}`;
    }
    if (language === 'es') {
        if (text.startsWith('Erro ao criar conta: ')) return `Error al crear cuenta: ${text.replace('Erro ao criar conta: ', '')}`;
        if (text.startsWith('Erro ao entrar: ')) return `Error al iniciar sesión: ${text.replace('Erro ao entrar: ', '')}`;
        if (text.startsWith('Erro ao atualizar nickname: ')) return `Error al actualizar nickname: ${text.replace('Erro ao atualizar nickname: ', '')}`;
        if (text.startsWith('Erro ao enviar sugestão: ')) return `Error al enviar sugerencia: ${text.replace('Erro ao enviar sugestão: ', '')}`;
    }
    return text;
}
