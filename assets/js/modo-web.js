/* Modo Portal Web: respuesta en vivo desde el servidor de IA (api/web.php). */

const webSessionId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random();

function linkifyWebText(html) {
    return html.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

function formatWebText(raw) {
    const hide = /^(Colección web:|Fragmentos indexados:)/;
    const text = raw.replace(/\r/g, '')
        .split('\n')
        .filter(line => !hide.test(line.trim()))
        .join('\n')
        .replace(/^\s*Respuesta:\s*/m, '')
        .trim();

    if (!text) return '';

    return linkifyWebText(escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/^Fuentes consultadas:/m, '<b>Fuentes consultadas:</b>')
        .replace(/^[\-\*]\s+/gm, '• ')
        .replace(/\n/g, '<br>'));
}

async function handleWebMessage(text) {
    isWaitingResponse = true;
    const history = chatHistories.web;

    history.push({ text: escapeHtml(text), type: 'unamba-msg-user' });
    const msg = { text: loadingHtml('Consultando portal web...'), type: 'unamba-msg-bot', isLoading: true };
    history.push(msg);
    if (currentMode === 'web') renderCurrentChat();

    let raw = '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
        const res = await fetch(ENDPOINTS.web, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
            body: JSON.stringify({ message: text, session: webSessionId })
        });
        if (!res.ok || !res.body) {
            const detail = await res.text().catch(() => '');
            throw new Error(detail || ('HTTP ' + res.status));
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            raw += decoder.decode(value, { stream: true });

            const formatted = formatWebText(raw);
            if (formatted) {
                msg.isLoading = false;
                msg.text = formatted;
                if (currentMode === 'web') renderCurrentChat();
            }
        }

        msg.isLoading = false;
        msg.text = formatWebText(raw) || 'No se obtuvo respuesta del portal web.';
    } catch (e) {
        msg.isLoading = false;
        msg.text = e.name === 'AbortError'
            ? 'La consulta tardó demasiado. Intenta reformularla o verifica que Ollama esté respondiendo.'
            : 'No se pudo conectar con el servidor del portal web. Verifica que el servidor de IA esté encendido.';
    } finally {
        clearTimeout(timer);
        isWaitingResponse = false;
        if (currentMode === 'web') renderCurrentChat();
    }
}

MODES.web = { send: handleWebMessage };
