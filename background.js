// Script de plano de fundo
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extensão PUC Auto Complete instalada');
});

// Mapa para forçar nomes no onDeterminingFilename (Plano B)
const downloadNamesById = new Map();

// Listener para mensagens do content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Mensagem recebida no background:', message);
    
    if (message.action === 'baixarVideo') {
        processarConteudoPagina(message.url, message.titulo)
            .then(result => {
                if (result.success) {
                    downloadVideo(result.urlVideo, `${message.titulo}.mp4`)
                        .then((downloadId) => {
                            sendResponse({ success: true, downloadId });
                        })
                        .catch(error => {
                            console.error('Erro ao iniciar download:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                } else {
                    console.error('Erro ao processar conteúdo:', result.error);
                    sendResponse({ success: false, error: result.error });
                }
            })
            .catch(error => {
                console.error('Erro ao processar conteúdo:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // handled async
    } else if (message.action === 'marcarComoFeito') {
        marcarComoFeito(message.url)
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                console.error('Erro ao marcar como feito:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // handled async
    }
    
    // Não tratamos outras ações aqui; permitir que outros listeners respondam
    return false;
});

// Função para limpar caracteres especiais do nome do arquivo
function limparNomeArquivo(filename) {
    if (!filename || typeof filename !== 'string') {
        return 'video.mp4';
    }
    
    // Lista de nomes reservados no Windows
    const nomesReservados = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    
    let cleanName = filename
        // Remove ou substitui caracteres proibidos em nomes de arquivos
        .replace(/[<>:"|?*\\/]/g, '_')  // Caracteres proibidos: < > : " | ? * \ /
        .replace(/[\x00-\x1f\x7f-\x9f]/g, '')  // Remove caracteres de controle
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')  // Remove caracteres Unicode de controle
        .replace(/^\s+|\s+$/g, '')  // Remove espaços no início e fim
        .replace(/\s+/g, ' ')  // Substitui múltiplos espaços por um só
        .replace(/^\.+|\.+$/g, '')  // Remove pontos no início e fim
        .replace(/\.$/, '')  // Remove ponto final se houver
        .substring(0, 200);  // Limita o tamanho do nome do arquivo
    
    // Verifica se o nome (sem extensão) é um nome reservado
    const nomeBase = cleanName.replace(/\.[^.]*$/, '').toUpperCase();
    if (nomesReservados.includes(nomeBase)) {
        cleanName = 'video_' + cleanName;
    }
    
    // Se o nome ficou vazio ou só com espaços, usa um nome padrão
    if (!cleanName || cleanName.trim() === '') {
        cleanName = 'video.mp4';
    }
    
    // Garante que termina com .mp4 se não tiver extensão
    if (!cleanName.toLowerCase().endsWith('.mp4')) {
        cleanName += '.mp4';
    }
    
    return cleanName;
}

// Listener para forçar o nome correto do arquivo durante o download (Plano B)
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    console.log('onDeterminingFilename - Filename original:', downloadItem.filename);

    // 1) Se há um nome desejado mapeado para este ID, força-o
    const mapped = downloadNamesById.get(downloadItem.id);
    if (mapped) {
        console.log('onDeterminingFilename - Aplicando nome mapeado:', mapped);
        suggest({ filename: mapped, conflictAction: 'overwrite' });
        downloadNamesById.delete(downloadItem.id);
        return;
    }
    
    // 2) Fallback: se for .mp4, aplica limpeza básica
    if (downloadItem.filename && downloadItem.filename.endsWith('.mp4')) {
        const cleanFilename = limparNomeArquivo(downloadItem.filename);
        console.log('onDeterminingFilename - Filename limpo:', cleanFilename);
        suggest({ filename: cleanFilename, conflictAction: 'uniquify' });
    } else {
        suggest();
    }
});

// Função para baixar o vídeo usando a API de downloads (Plano B)
async function downloadVideo(url, filename) {
    try {
        console.log('[BG] downloadVideo - Filename original:', filename);
        const cleanFilename = limparNomeArquivo(filename);
        console.log('[BG] downloadVideo - Filename limpo:', cleanFilename);
        
        const downloadId = await chrome.downloads.download({
            url: url,
            filename: cleanFilename,
            saveAs: false
        });
        // mapeia o nome desejado para este download, caso o servidor tente sobrescrever
        downloadNamesById.set(downloadId, cleanFilename);
        console.log('[BG] Download iniciado (API downloads):', cleanFilename, 'ID:', downloadId);
        return downloadId;
    } catch (error) {
        console.error('[BG] Erro ao baixar vídeo:', error);
        console.error('[BG] Filename que causou erro:', filename);
        console.error('[BG] Filename limpo que causou erro:', limparNomeArquivo(filename));
        throw error;
    }
}

// Função para encontrar a URL do iframe
function encontrarUrlIframe() {
    return new Promise((resolve) => {
        let tentativas = 0;
        const maxTentativas = 20; // 10 segundos no total
        
        const verificarIframe = () => {
            console.log('Tentativa', tentativas + 1, 'de encontrar iframe...');
            const iframes = document.querySelectorAll('iframe[src*="pucminas.instructure.com/courses/"]');
            console.log('Iframes encontrados:', iframes.length);
            if (iframes.length > 0) {
                const iframe = iframes[0];
                console.log('Iframe encontrado:', iframe);
                const src = iframe.getAttribute('src');
                if (src) {
                    console.log('URL do iframe encontrada:', src);
                    resolve(src);
                    return;
                }
            }
            tentativas++;
            if (tentativas < maxTentativas) {
                setTimeout(verificarIframe, 500);
            } else {
                console.log('Iframe não encontrado após várias tentativas');
                resolve(null);
            }
        };
        verificarIframe();
    });
}

// Função para encontrar o vídeo MP4 na página
function encontrarVideoMP4() {
    return new Promise((resolve, reject) => {
        let tentativas = 0;
        const maxTentativas = 20; // 20 tentativas * 200ms = 4 segundos
        const intervalo = 200; // 200ms entre tentativas
        
        function tentarEncontrarVideo() {
            console.log(`Tentativa ${tentativas + 1} de ${maxTentativas} para encontrar o vídeo`);
            const videos = document.querySelectorAll('video');
            console.log(`Encontrados ${videos.length} elementos de vídeo`);
            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                console.log(`Verificando vídeo ${i + 1}:`, {
                    id: video.id,
                    class: video.className,
                    attributes: Array.from(video.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', ')
                });
                const sources = video.querySelectorAll('source');
                console.log(`Vídeo ${i + 1} tem ${sources.length} sources`);
                for (let j = 0; j < sources.length; j++) {
                    const source = sources[j];
                    console.log(`Verificando source ${j + 1} do vídeo ${i + 1}:`, {
                        src: source.src,
                        type: source.type,
                        attributes: Array.from(source.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', ')
                    });
                    if (source.src && source.src.includes('.mp4')) {
                        console.log('Vídeo MP4 encontrado:', source.src);
                        return resolve({ success: true, urlVideo: source.src });
                    }
                }
            }
            if (tentativas < maxTentativas - 1) {
                tentativas++;
                console.log(`Vídeo não encontrado. Tentativa ${tentativas} de ${maxTentativas}. Tentando novamente em ${intervalo}ms...`);
                setTimeout(tentarEncontrarVideo, intervalo);
            } else {
                console.log('Número máximo de tentativas atingido. Vídeo não encontrado.');
                reject({ success: false, error: 'Nenhum vídeo encontrado' });
            }
        }
        tentarEncontrarVideo();
    });
}

// Função para processar o conteúdo da página
async function processarConteudoPagina(url, titulo) {
    console.log('Processando conteúdo da página:', url);
    console.log('Título do assunto:', titulo);
    
    let tab = null;
    try {
        const [tabOrigem] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Aba de origem:', tabOrigem.id);
        const urlCanvas = url.startsWith('http') ? url : `https://pucminas.instructure.com${url}`;
        console.log('URL do Canvas:', urlCanvas);
        tab = await chrome.tabs.create({ url: urlCanvas, active: false });
        await new Promise(resolve => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            });
        });
        const [iframeUrl] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: encontrarUrlIframe
        });
        if (!iframeUrl.result) {
            console.log('Nenhum iframe encontrado');
            return { success: false, error: 'Nenhum iframe encontrado' };
        }
        console.log('URL do iframe encontrada:', iframeUrl.result);
        await chrome.tabs.update(tab.id, { url: iframeUrl.result });
        await new Promise(resolve => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            });
        });
        await chrome.tabs.update(tab.id, { active: true });
        await new Promise(resolve => setTimeout(resolve, 1000));
        const [videoResult] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: encontrarVideoMP4
        });
        if (!videoResult.result || !videoResult.result.success) {
            console.log('Nenhum vídeo encontrado');
            return { success: false, error: 'Nenhum vídeo encontrado' };
        }
        console.log('Vídeo encontrado:', videoResult.result.urlVideo);

        // Preferência: disparo do download dentro da página via Blob para fixar nome e preservar cookies/referer
        const sanitizedName = limparNomeArquivo(`${titulo}.mp4`);
        const [pageDl] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            args: [videoResult.result.urlVideo, sanitizedName],
            function: async (url, filename) => {
                console.log('[PAGE] Iniciando download via Blob:', { url, filename });
                try {
                    const resp = await fetch(url, { credentials: 'include' });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const blob = await resp.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                    console.log('[PAGE] Download disparado com sucesso (via Blob).');
                    return { ok: true, via: 'blob' };
                } catch (err) {
                    console.error('[PAGE] Falha no download via Blob:', err);
                    return { ok: false, error: err?.message || String(err) };
                }
            }
        });
        console.log('Resultado do disparo na página:', pageDl?.result);
        if (pageDl?.result?.ok) {
            return { success: true, urlVideo: videoResult.result.urlVideo, via: 'blob' };
        }

        // Fallback: usa API de downloads (pode sofrer com Content-Disposition, mas tentamos forçar com onDeterminingFilename)
        const downloadId = await downloadVideo(videoResult.result.urlVideo, sanitizedName);
        return { success: true, urlVideo: videoResult.result.urlVideo, via: 'downloads', downloadId };
    } catch (error) {
        console.error('Erro ao processar conteúdo:', error);
        return { success: false, error: error.message };
    } finally {
        if (tab) {
            try {
                await chrome.tabs.remove(tab.id);
                const [tabOrigem] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabOrigem) {
                    await chrome.tabs.update(tabOrigem.id, { active: true });
                }
            } catch (e) {
                console.error('Erro ao fechar aba:', e);
            }
        }
    }
}

// Função para marcar como feito
async function marcarComoFeito(url) {
    let tab = null;
    let tabOrigem = null;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const tryWithRetries = async (fn, retries = 4, delay = 400) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (e) {
                const msg = String(e?.message || e);
                if (/Tabs cannot be edited right now/i.test(msg) || /Frame with ID .* was removed/i.test(msg) || /No tab with id/i.test(msg)) {
                    if (i < retries - 1) {
                        await sleep(delay);
                        continue;
                    }
                }
                throw e;
            }
        }
    };

    try {
        const [orig] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabOrigem = orig;
        const urlCanvas = url.startsWith('http') ? url : `https://pucminas.instructure.com${url}`;
        tab = await chrome.tabs.create({ url: urlCanvas, active: false });

        // Aguarda carregamento (máx 20s)
        await Promise.race([
            new Promise(resolve => {
                function listener(tabId, info) {
                    if (tabId === tab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                }
                chrome.tabs.onUpdated.addListener(listener);
            }),
            sleep(20000)
        ]);

        // Tenta achar/clicar no botão por até ~8s (12 tentativas x 700ms)
        const [inj] = await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            function: () => {
                const tryFindButton = () => {
                    const byId = document.getElementById('mark-as-done-checkbox');
                    if (byId) return byId;
                    // Heurísticas adicionais
                    const candidates = Array.from(document.querySelectorAll('button,input,label'));
                    for (const el of candidates) {
                        const txt = (el.innerText || '').toLowerCase();
                        const ttl = (el.title || '').toLowerCase();
                        const aria = (el.getAttribute && el.getAttribute('aria-label')) ? el.getAttribute('aria-label').toLowerCase() : '';
                        if (/marcar como feito|mark as done|conclu[ií]do/.test(txt) || /marcar como feito|mark as done|conclu[ií]do/.test(ttl) || /marcar como feito|mark as done|conclu[ií]do/.test(aria)) {
                            return el;
                        }
                    }
                    return null;
                };

                return new Promise((resolve) => {
                    let tentativas = 0;
                    const maxTentativas = 12;
                    const tentar = () => {
                        const btn = tryFindButton();
                        if (btn) {
                            try {
                                btn.scrollIntoView?.({ block: 'center', inline: 'center' });
                                if (typeof btn.click === 'function') {
                                    btn.click();
                                } else {
                                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                }
                                 resolve({ success: true });
                             } catch (e) {
                                 resolve({ success: false, error: e?.message || String(e) });
                             }
                             return;
                         }
                        tentativas++;
                        if (tentativas >= maxTentativas) {
                            resolve({ success: false, reason: 'not_found' });
                            return;
                        }
                        setTimeout(tentar, 700);
                    };
                    tentar();
                });
            }
        });

        // Aguarda pequeno intervalo para a ação refletir (se ocorreu)
        await sleep(800);

        // Fecha a aba criada e volta o foco
        if (tab?.id) {
            await tryWithRetries(() => chrome.tabs.remove(tab.id));
        }
        if (tabOrigem?.id) {
            await tryWithRetries(() => chrome.tabs.update(tabOrigem.id, { active: true }));
        }

        const r = inj?.result || {};
        if (r.success) {
            return { success: true };
        }
        if (r.reason === 'not_found') {
            // Não encontrou o botão: deixar como está e seguir sem erro
            return { success: true, skipped: true, reason: 'not_found' };
        }
        // Outro erro dentro da página
        return { success: false, error: r.error || 'unknown_error' };
    } catch (error) {
        console.error('Erro ao marcar como feito:', error);
        // Garante que tentamos fechar a aba mesmo em erro
        try {
            if (tab?.id) {
                await tryWithRetries(() => chrome.tabs.remove(tab.id));
            }
            if (tabOrigem?.id) {
                await tryWithRetries(() => chrome.tabs.update(tabOrigem.id, { active: true }));
            }
        } catch (e) {
            // Ignora erros ao tentar fechar/ativar
        }
        return { success: false, error: error.message };
    }
}

// Listener para mensagens do content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadVideo') {
        downloadVideo(request.url, request.filename)
            .then((downloadId) => sendResponse({ success: true, downloadId }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'processarConteudo') {
        processarConteudoPagina(request.url, request.titulo)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'coletarLinks') {
        coletarLinks()
            .then(links => sendResponse({ success: true, links: links }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    } else if (request.action === 'openConverter') {
        const url = chrome.runtime.getURL('sandbox.html');
        chrome.tabs.create({ url, active: true })
            .then((tab) => {
                sendResponse({ success: true, tabId: tab.id });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    } else if (request.action === 'abrirConversor') {
        chrome.tabs.create({ url: chrome.runtime.getURL('sandbox.html') });
    }
});