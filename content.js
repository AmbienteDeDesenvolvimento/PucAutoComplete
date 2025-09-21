// Inicializa o estado global se não existir
if (!window.pucEstado) {
    window.pucEstado = {
        abaAtual: null
    };
}

// Função para processar o conteúdo da página
async function processarConteudoPagina(url, titulo) {
    console.log('Processando conteúdo da página:', url);
    console.log('Título do assunto:', titulo);
    
    try {
        // Constrói a URL correta do Canvas
        const urlCanvas = url.startsWith('http') ? url : `https://pucminas.instructure.com${url}`;
        console.log('URL do Canvas:', urlCanvas);
        
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            const response = await chrome.runtime.sendMessage({
                action: 'processarConteudo',
                url: urlCanvas,
                titulo: titulo
            });
            console.log('Resposta completa do background:', response);
            return response;
        } else {
            throw new Error("chrome.runtime.sendMessage não está disponível neste contexto. Certifique-se de que a extensão está ativa e o domínio é permitido pelo manifest.");
        }
    } catch (error) {
        console.error('Erro ao processar página:', error);
        return { success: false, error: error.message };
    }
}

// Função para encontrar vídeos na página
function encontrarVideos() {
    const videos = [];
    const videoElements = document.querySelectorAll('video source[type="video/mp4"]');
    
    videoElements.forEach((source, index) => {
        if (source.src) {
            const filename = `video_${index + 1}.mp4`;
            videos.push({
                url: source.src,
                filename: filename
            });
        }
    });
    
    return videos;
}

// Função para baixar vídeo
async function baixarVideo(url, filename) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'downloadVideo',
            url: url,
            filename: filename
        });
        
        if (response.success) {
            console.log('Download iniciado com sucesso:', filename);
        } else {
            console.error('Erro ao iniciar download:', response.error);
        }
    } catch (error) {
        console.error('Erro ao enviar mensagem para download:', error);
    }
}

// Função para coletar informações do assunto
async function coletarInfos(titulo, url, moduloIndex, assuntoIndex) {
    console.log('Coletando informações do assunto:', titulo);
    
    try {
        const response = await processarConteudoPagina(url, titulo);
        console.log('Resposta do processamento:', response);
        
        if (response && response.success && response.urlVideo) {
            console.log('Vídeo MP4 encontrado:', response.urlVideo);
            // Atualiza o assunto com a URL do vídeo
            const assunto = window.pucEstado.dados.Modulos[moduloIndex].Assuntos[assuntoIndex];
            assunto.UrlVideo = response.urlVideo;
            
            // Atualiza o botão de resumir
            const botaoResumir = document.getElementById(`puc-botao-resumir-${moduloIndex}-${assuntoIndex}`);
            if (botaoResumir) {
                botaoResumir.style.display = 'flex';
                botaoResumir.setAttribute('data-url-video', response.urlVideo);
            }
            
            console.log('Informações coletadas com sucesso');
        } else {
            console.log('Nenhum vídeo MP4 encontrado para processar');
            // Garante que o botão de resumir está oculto
            const botaoResumir = document.getElementById(`puc-botao-resumir-${moduloIndex}-${assuntoIndex}`);
            if (botaoResumir) {
                botaoResumir.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Erro ao processar assunto:', error);
        // Em caso de erro, garante que o botão de resumir está oculto
        const botaoResumir = document.getElementById(`puc-botao-resumir-${moduloIndex}-${assuntoIndex}`);
        if (botaoResumir) {
            botaoResumir.style.display = 'none';
        }
    }
}

// Função para resumir assunto
async function resumirAssunto(titulo, urlVideo) {
    console.log('Iniciando resumo do assunto:', titulo);
    // TODO: Implementar a lógica de resumo via IA
    alert('Funcionalidade de resumo via IA será implementada em breve!');
}

// Função para verificar se a página está completamente carregada
function aguardarCarregamentoCompleto() {
    return new Promise((resolve) => {
        let mudancas = 0;
        let timeoutId = null;
        
        // Função para resetar o timeout
        const resetarTimeout = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                console.log('Nenhuma mudança detectada nos últimos 2 segundos, considerando carregamento completo');
                observer.disconnect();
                resolve();
            }, 2000);
        };

        // Cria um observer para monitorar mudanças na página
        const observer = new MutationObserver((mutations) => {
            mudancas++;
            console.log(`Mudança ${mudancas} detectada na página`);
            resetarTimeout();
        });

        // Configura o observer para monitorar todo o documento
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });

        // Inicia o primeiro timeout
        resetarTimeout();
    });
}

// Função para encontrar o iframe na página
function encontrarUrlIframe() {
    const iframe = document.querySelector('iframe');
    return iframe ? iframe.src : null;
}

// Função para encontrar o vídeo MP4
function encontrarVideoMP4() {
    const video = document.querySelector('video');
    if (!video) {
        return { success: false, error: 'Nenhum vídeo encontrado' };
    }

    const source = video.querySelector('source[type="video/mp4"]');
    if (!source) {
        return { success: false, error: 'Nenhum vídeo MP4 encontrado' };
    }

    return { success: true, urlVideo: source.src };
}

// Função para criar o botão de status
function criarBotaoStatus(elemento) {
    const button = document.createElement('button');
    button.className = 'puc-status-button';
    button.type = 'button';
    button.innerHTML = '<i class="icon-check"></i>';
    button.title = 'Marcar/Desmarcar como Concluído';
    return button;
}

// Função para criar o botão de download
function criarBotaoDownload() {
    const button = document.createElement('button');
    button.className = 'puc-download-button';
    button.type = 'button';
    button.innerHTML = '<i class="icon-download"></i>';
    button.title = 'Baixar vídeo';
    return button;
}

// NOVO: Função para criar o botão de marcar todos não concluídos
function criarBotaoMarcarTodos() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'puc-bulk-button';
    btn.title = 'Marcar todos os itens não concluídos deste módulo/página';
    btn.textContent = 'Marcar todos não concluídos';
    return btn;
}

// NOVO: Determina se um item está concluído pelo ícone de status
function isItemConcluido(itemRoot) {
    try {
        const li = itemRoot.closest('li') || itemRoot.closest('.context_module_item');
        const i = li?.querySelector('.module-item-status-icon i');
        if (!i) return false; // sem ícone, considere não concluído
        const cls = Array.from(i.classList || []);
        const texto = `${(i.getAttribute('aria-label') || '')} ${(i.getAttribute('title') || '')}`.toLowerCase();

        // Concluído apenas por sinais POSITIVOS explícitos
        const concluidoPorClasse = cls.some(c => [
            'icon-check', 'icon-complete', 'icon-checkmark', 'icon-publish', 'icon-check-circle'
        ].includes(c));
        const concluidoPorTexto = /(\bcompleto\b|conclu[ií]do|feito|finalizado)/.test(texto)
            && !/(deve|pendente|n[ãa]o)/.test(texto);

        return !!(concluidoPorClasse || concluidoPorTexto);
    } catch {
        return false;
    }
}

// NOVO: Coleta todos os itens não concluídos e seus links (foco em icon-mark-as-read)
function coletarItensNaoConcluidos() {
    const itens = [];
    const elementos = document.querySelectorAll('.module-item-title');
    elementos.forEach(el => {
        // O link pode não estar dentro do título (ex.: h3). Busque no contêiner do item
        const li = el.closest('li, .context_module_item, .ig-row, .ig-list, .content') || el.closest('li') || el.closest('.context_module_item');
        const link = (li && li.querySelector('a.ig-title.title.item_link, a.ig-title.item_link, a.ig-title, a.item_link, a[href*="/modules/items/"], a[href]'))
            || el.querySelector('a[href]');
        if (!link) return;

        const iconEl = (li || el).querySelector('.module-item-status-icon i');
        const classes = Array.from(iconEl?.classList || []);
        const texto = `${(iconEl?.getAttribute('aria-label') || '')} ${(iconEl?.getAttribute('title') || '')}`.toLowerCase();

        const ehPendente = classes.includes('icon-mark-as-read')
            || /deve\s+marcar|n[ãa]o\s+conclu[ií]do|pendente/.test(texto)
            || (!iconEl && !isItemConcluido(el));

        if (ehPendente) {
            itens.push({ elemento: el, href: link.href, titulo: (link.textContent || '').trim() || el.textContent.trim() });
        }
    });
    return itens;
}

// NOVO: Marca todos os itens não concluídos de forma sequencial
async function marcarTodosNaoConcluidos(btn) {
    try {
        btn.disabled = true;
        btn.textContent = 'Marcando...';
        const itens = coletarItensNaoConcluidos();
        if (!itens.length) {
            alert('Não há itens pendentes para marcar nesta página.');
            btn.textContent = 'Marcar todos não concluídos';
            return;
        }
        let ok = 0, falhas = 0;
        for (const item of itens) {
            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'marcarComoFeito',
                    url: item.href
                });
                if (response?.success) {
                    ok++;
                } else {
                    falhas++;
                    console.warn('Falha ao marcar item:', item.titulo, response?.error);
                }
                // pequeno atraso para evitar throttling do Canvas/Chrome
                await new Promise(r => setTimeout(r, 600));
            } catch (err) {
                falhas++;
                console.warn('Erro ao marcar item:', item.titulo, err);
                await new Promise(r => setTimeout(r, 600));
            }
        }
        alert(`Concluído. Sucesso: ${ok}. Falhas: ${falhas}. A página será recarregada para refletir o status.`);
        // Recarrega somente ao final para evitar invalidar o contexto durante o loop
        window.location.reload();
    } finally {
        btn.disabled = false;
        btn.textContent = 'Marcar todos não concluídos';
    }
}

// Função para processar um elemento
async function processarElemento(elemento) {
    // Verifica se o elemento já foi processado
    if (elemento.dataset.pucProcessado === 'true') {
        return;
    }

    // Marca o elemento como processado
    elemento.dataset.pucProcessado = 'true';

    // Cria os botões
    const btnStatus = criarBotaoStatus(elemento);
    const btnDownload = criarBotaoDownload();

    // Adiciona os botões ao elemento
    elemento.appendChild(btnStatus);
    elemento.appendChild(btnDownload);

    // Adiciona eventos aos botões
    btnStatus.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
            const statusIcon = elemento.closest('li')?.querySelector('.module-item-status-icon i');
            // O link pode estar fora do título; busque no contêiner do item
            const container = elemento.closest('li, .context_module_item, .ig-row, .ig-list, .content') || elemento;
            const link = (container && container.querySelector('a.ig-title.title.item_link, a.ig-title.item_link, a.ig-title, a.item_link, a[href*="/modules/items/"], a[href]'))
                || elemento.querySelector('a[href]');
            if (!link) {
                console.warn('Link do item não encontrado para marcação. Título:', elemento.textContent?.trim());
                return;
            }

            // Envia mensagem para o background marcar como feito (promise-based)
            const response = await chrome.runtime.sendMessage({
                action: 'marcarComoFeito',
                url: link.href
            });

            if (!response?.success) {
                throw new Error(response?.error || 'Falha ao marcar/desmarcar como concluído');
            }
            // Se a operação foi executada, recarrega; se foi skipped, não bloqueia o fluxo
            if (!response.skipped) {
                window.location.reload();
            }
        } catch (error) {
            console.warn('Falha ao marcar/desmarcar como concluído (seguindo sem bloquear):', error);
        }

    }, { capture: true });

    btnDownload.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        try {
            btnDownload.disabled = true;
            const icon = btnDownload.querySelector('i');
            icon.className = 'icon-spinner icon-spin';

            // Obtém a URL do link
            const link = elemento.querySelector('a');
            if (!link) {
                throw new Error('Link não encontrado');
            }

            // Envia mensagem para o background script processar o conteúdo
            const response = await chrome.runtime.sendMessage({
                action: 'processarConteudo',
                url: link.href,
                titulo: link.textContent.trim()
            });

            if (!response?.success) {
                throw new Error(response?.error || 'Erro ao processar vídeo');
            }
            // Não faz mais nada aqui, o download é feito pelo background.js
        } catch (error) {
            console.error('Erro ao baixar vídeo:', error);
            alert('Erro ao baixar vídeo: ' + (error?.message || String(error)));
        } finally {
            btnDownload.disabled = false;
            const icon = btnDownload.querySelector('i');
            icon.className = 'icon-download';
        }
    }, { capture: true });
}

// Função para processar todos os elementos
async function processarElementos() {
    const elementos = document.querySelectorAll('.module-item-title');
    for (const elemento of elementos) {
        await processarElemento(elemento);
    }
}

// Função para inicializar o script
async function inicializarScript() {
    // Adiciona os estilos
    const style = document.createElement('style');
    style.textContent = `
        .puc-status-button,
        .puc-download-button {
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px;
            margin-left: 5px;
            color: #666;
        }
        .puc-status-button:hover,
        .puc-download-button:hover {
            color: #333;
        }
        .puc-status-button:disabled,
        .puc-download-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .icon-spin {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .icon-circle {
            color: #dc3545;
        }
        /* NOVO: botão flutuante para marcar todos */
        .puc-bulk-button {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            background-color: #0d6efd;
            color: #fff;
            border: none;
            border-radius: 6px;
            padding: 10px 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,.2);
            font-weight: 600;
        }
        .puc-bulk-button:hover { background-color: #0b5ed7; }
        .puc-bulk-button:disabled { opacity: .6; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    // Processa os elementos existentes
    await processarElementos();

    // Adiciona o botão global de marcação
    if (!document.querySelector('.puc-bulk-button')) {
        const btnBulk = criarBotaoMarcarTodos();
        btnBulk.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await marcarTodosNaoConcluidos(btnBulk);
        }, { capture: true });
        document.body.appendChild(btnBulk);
    }

    // Observa mudanças no DOM
    const observer = new MutationObserver(async (mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const elementos = node.querySelectorAll('.module-item-title');
                        for (const elemento of elementos) {
                            await processarElemento(elemento);
                        }
                    }
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Executa o script
inicializarScript();