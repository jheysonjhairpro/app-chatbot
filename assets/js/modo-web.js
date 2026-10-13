/* Modo Portal Web: contrato de texto progresivo de /chat/web. */
const webSessionId = window.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();

function escapeWebHtml(value) {
    return escapeHtml(String(value)).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function webLink(label, value) {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) return escapeWebHtml(label);
        return `<a href="${escapeWebHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeWebHtml(label)}</a>`;
    } catch { return escapeWebHtml(label); }
}

function formatWebText(raw) {
    const text = raw.replace(/\r/g, '').trim();
    const inline = (line) => line.split(/(\[[^\]\n]+\]\(https?:\/\/[^\s<>]+\)|https?:\/\/[^\s<>]+)/g).map((part) => {
        const markdown = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s<>]+)\)$/);
        if (markdown) return webLink(markdown[1], markdown[2]);
        if (/^https?:\/\//.test(part)) return webLink(part, part);
        return escapeWebHtml(part).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    }).join('');
    return text.split('\n').map((line) => {
        if (line === 'Fuentes consultadas:') return '<b>Fuentes consultadas:</b>';
        return inline(line.replace(/^[\-*]\s+/, '• '));
    }).join('<br>');
}

async function webError(response) {
    const text = await response.text();
    try {
        const data = JSON.parse(text);
        const message = data.error || data.detail;
        if (typeof message === 'string') return message;
    } catch { /* No mostrar páginas HTML del proxy en el chat. */ }
    return response.status === 403
        ? 'El servicio web rechazó la conexión. Revisa su configuración de acceso.'
        : `No se pudo consultar el servicio web (HTTP ${response.status}).`;
}

async function handleWebMessage(text) {
    isWaitingResponse = true;
    const history = chatHistories.web;
    history.push({ text: escapeWebHtml(text), type: 'unamba-msg-user' });
    const msg = { text: loadingHtml('Consultando información indexada...'), type: 'unamba-msg-bot', isLoading: true };
    history.push(msg);
    const render = () => { if (currentMode === 'web') renderCurrentChat(); };
    render();
    let raw = '', reader, timer;
    const controller = new AbortController();
    const resetTimeout = () => {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(), 180000);
    };
    try {
        resetTimeout();
        if (text.toLowerCase() === '/estado') {
            const res = await fetch(ENDPOINTS.web + '?action=health', { cache: 'no-store', signal: controller.signal });
            if (!res.ok) throw new Error(await webError(res));
            const data = await res.json();
            raw = data.ok
                ? `El servicio web está disponible.\nFragmentos indexados: ${Number(data.chroma?.fragmentos || 0).toLocaleString('es-PE')}.`
                : 'El servicio web no está listo. Revisa Ollama, los modelos y el índice.';
        } else {
            if (Array.from(text).length < 2 || Array.from(text).length > 2000) {
                throw new Error('La pregunta debe tener entre 2 y 2000 caracteres.');
            }
            const res = await fetch(ENDPOINTS.web, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                cache: 'no-store', signal: controller.signal,
                body: JSON.stringify({ message: text, session: webSessionId })
            });
            if (!res.ok) throw new Error(await webError(res));
            if (!res.body) throw new Error('El navegador no pudo leer la respuesta del servicio web.');
            reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) { raw += decoder.decode(); break; }
                resetTimeout();
                raw += decoder.decode(value, { stream: true });
                if (raw.trim()) {
                    msg.isLoading = false;
                    msg.text = formatWebText(raw);
                    render();
                }
            }
        }
        msg.text = formatWebText(raw) || 'El servicio web no devolvió una respuesta. Inténtalo nuevamente.';
    } catch (error) {
        const detail = error.name === 'AbortError'
            ? 'No se recibieron datos durante 3 minutos. Inténtalo nuevamente.'
            : error instanceof TypeError
                ? 'No se pudo conectar con el servicio web. Comprueba la conexión e inténtalo nuevamente.'
                : error.message;
        msg.text = (raw.trim() ? formatWebText(raw) + '<br><br>' : '') + escapeWebHtml(detail);
    } finally {
        clearTimeout(timer);
        controller.abort();
        if (reader) { try { await reader.cancel(); } catch {} }
        msg.isLoading = false;
        isWaitingResponse = false;
        render();
    }
}

MODES.web = { send: handleWebMessage };
