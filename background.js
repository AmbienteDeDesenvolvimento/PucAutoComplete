// Script de plano de fundo
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extensão PUC Auto Complete instalada');
});

// Listener para mensagens do content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Mensagem recebida no background:', message);
    
    if (message.action === 'baixarVideo') {
        processarConteudoPagina(message.url, message.titulo)
            .then(result => {
                if (result.success) {
                    downloadVideo(result.urlVideo, `${message.titulo}.mp4`);
                    sendResponse({ success: true });
                } else {
                    console.error('Erro ao processar conteúdo:', result.error);
                    sendResponse({ success: false, error: result.error });
                }
            })
            .catch(error => {
                console.error('Erro ao processar conteúdo:', error);
                sendResponse({ success: false, error: error.message });
            });
    } else if (message.action === 'marcarComoFeito') {
        marcarComoFeito(message.url)
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                console.error('Erro ao marcar como feito:', error);
                sendResponse({ success: false, error: error.message });
            });
    }
    
    return true; // Indica que a resposta será enviada de forma assíncrona
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

// Função para baixar o vídeo
async function downloadVideo(url, filename) {
    try {
        console.log('Filename original:', filename);
        
        // Limpa o nome do arquivo antes de fazer o download
        const cleanFilename = limparNomeArquivo(filename);
        
        console.log('Filename limpo:', cleanFilename);
        
        await chrome.downloads.download({
            url: url,
            filename: cleanFilename,
            saveAs: false
        });
        console.log('Download iniciado com sucesso:', cleanFilename);
    } catch (error) {
        console.error('Erro ao baixar vídeo:', error);
        console.error('Filename que causou erro:', filename);
        console.error('Filename limpo que causou erro:', limparNomeArquivo(filename));
    }
}

// Função para encontrar a URL do iframe
function encontrarUrlIframe() {
    return new Promise((resolve) => {
        let tentativas = 0;
        const maxTentativas = 20; // 10 segundos no total
        
        const verificarIframe = () => {
            console.log('Tentativa', tentativas + 1, 'de encontrar iframe...');
            
            // Procura por iframes que contenham a URL do Canvas
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
            
            // Procura por todos os elementos de vídeo
            const videos = document.querySelectorAll('video');
            console.log(`Encontrados ${videos.length} elementos de vídeo`);
            
            // Itera sobre cada vídeo encontrado
            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                console.log(`Verificando vídeo ${i + 1}:`, {
                    id: video.id,
                    class: video.className,
                    attributes: Array.from(video.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', ')
                });
                
                // Procura por sources dentro do vídeo
                const sources = video.querySelectorAll('source');
                console.log(`Vídeo ${i + 1} tem ${sources.length} sources`);
                
                // Itera sobre cada source
                for (let j = 0; j < sources.length; j++) {
                    const source = sources[j];
                    console.log(`Verificando source ${j + 1} do vídeo ${i + 1}:`, {
                        src: source.src,
                        type: source.type,
                        attributes: Array.from(source.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', ')
                    });
                    
                    // Verifica se é um vídeo MP4
                    if (source.src && source.src.includes('.mp4')) {
                        console.log('Vídeo MP4 encontrado:', source.src);
                        return resolve({ success: true, urlVideo: source.src });
                    }
                }
            }
            
            // Se não encontrou o vídeo e ainda não atingiu o máximo de tentativas
            if (tentativas < maxTentativas - 1) {
                tentativas++;
                console.log(`Vídeo não encontrado. Tentativa ${tentativas} de ${maxTentativas}. Tentando novamente em ${intervalo}ms...`);
                setTimeout(tentarEncontrarVideo, intervalo);
            } else {
                console.log('Número máximo de tentativas atingido. Vídeo não encontrado.');
                reject({ success: false, error: 'Nenhum vídeo encontrado' });
            }
        }
        
        // Inicia a primeira tentativa
        tentarEncontrarVideo();
    });
}

// Função para processar o conteúdo da página
async function processarConteudoPagina(url, titulo) {
    console.log('Processando conteúdo da página:', url);
    console.log('Título do assunto:', titulo);
    
    let tab = null;
    try {
        // Guarda a aba de origem
        const [tabOrigem] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Aba de origem:', tabOrigem.id);
        
        // Constrói a URL correta do Canvas
        const urlCanvas = url.startsWith('http') ? url : `https://pucminas.instructure.com${url}`;
        console.log('URL do Canvas:', urlCanvas);
        
        // Abre a URL em uma nova aba sem dar foco
        tab = await chrome.tabs.create({ url: urlCanvas, active: false });
        
        // Aguarda a página carregar
        await new Promise(resolve => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            });
        });
        
        // Executa o script para encontrar o iframe
        const [iframeUrl] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: encontrarUrlIframe
        });
        
        if (!iframeUrl.result) {
            console.log('Nenhum iframe encontrado');
            return { success: false, error: 'Nenhum iframe encontrado' };
        }
        
        console.log('URL do iframe encontrada:', iframeUrl.result);
        
        // Atualiza a URL da aba para o iframe
        await chrome.tabs.update(tab.id, { url: iframeUrl.result });
        
        // Aguarda a página do iframe carregar
        await new Promise(resolve => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            });
        });

        // Dá foco na aba antes de procurar o vídeo
        await chrome.tabs.update(tab.id, { active: true });
        
        // Aguarda um momento para garantir que a página recebeu o foco
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Executa o script para encontrar o vídeo
        const [videoResult] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: encontrarVideoMP4
        });
        
        if (!videoResult.result || !videoResult.result.success) {
            console.log('Nenhum vídeo encontrado');
            return { success: false, error: 'Nenhum vídeo encontrado' };
        }
        
        console.log('Vídeo encontrado:', videoResult.result.urlVideo);
        
        // Inicia o download do vídeo usando a função downloadVideo que limpa o filename
        await downloadVideo(videoResult.result.urlVideo, `${titulo}.mp4`);
        
        return { success: true, urlVideo: videoResult.result.urlVideo };
    } catch (error) {
        console.error('Erro ao processar conteúdo:', error);
        return { success: false, error: error.message };
    } finally {
        // Fecha a aba em qualquer caso (sucesso ou erro)
        if (tab) {
            try {
                await chrome.tabs.remove(tab.id);
                // Volta para a aba de origem
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
    try {
        // Guarda a aba de origem
        const [tabOrigem] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Aba de origem:', tabOrigem.id);
        
        // Constrói a URL correta do Canvas
        const urlCanvas = url.startsWith('http') ? url : `https://pucminas.instructure.com${url}`;
        console.log('URL do Canvas:', urlCanvas);
        
        // Abre a URL em uma nova aba sem dar foco
        const tab = await chrome.tabs.create({ url: urlCanvas, active: false });
        
        // Aguarda a página carregar
        await new Promise(resolve => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            });
        });

        // Executa o script para clicar no botão de marcar como feito
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                return new Promise((resolve) => {
                    // Função para verificar se o botão está presente
                    const verificarBotao = () => {
                        const botao = document.getElementById('mark-as-done-checkbox');
                        if (botao) {
                            botao.click();
                            resolve({ success: true });
                        } else {
                            setTimeout(verificarBotao, 500);
                        }
                    };
                    
                    // Inicia a verificação
                    verificarBotao();
                });
            }
        });

        // Aguarda um momento para garantir que a ação foi concluída
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fecha a aba
        await chrome.tabs.remove(tab.id);

        // Volta para a aba de origem
        await chrome.tabs.update(tabOrigem.id, { active: true });

        return { success: true };
    } catch (error) {
        console.error('Erro ao marcar como feito:', error);
        return { success: false, error: error.message };
    }
}

// Listener para mensagens do content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadVideo') {
        downloadVideo(request.url, request.filename)
            .then(() => sendResponse({ success: true }))
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
        // Abre a página de conversão de áudio em uma nova aba
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