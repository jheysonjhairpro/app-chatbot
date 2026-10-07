/* Modo Normativas / PDF: respuesta en vivo desde el servidor de IA (api/docs.php). */

const docsSessionId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random();

function formatDocsText(raw) {
    const hide = /^(Documento:|Contexto:|Preparación:|Consulta directa|Ollama:|Total:|Respuesta recuperada|Retomo|Revisión completa|Cobertura:|Respuestas:)/;
    const t = raw.replace(/\r/g, '')
        .split('\n')
        .filter(l => !hide.test(l.trim()))
        .join('\n')
        .replace(/^\s*Respuesta:\s*/m, '')
        .trim();

    return escapeHtml(t)
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/^Fuentes consultadas:/m, '<b>Fuentes consultadas:</b>')
        .replace(/^[\-\*]\s+/gm, '• ')
        .replace(/\n/g, '<br>');
}

async function handleDocsMessage(text) {
    isWaitingResponse = true;
    const history = chatHistories.docs;

    history.push({ text: escapeHtml(text), type: 'unamba-msg-user' });
    const msg = { text: loadingHtml('Consultando documentos...'), type: 'unamba-msg-bot', isLoading: true };
    history.push(msg);
    if (currentMode === 'docs') renderCurrentChat();

    let raw = '';
    try {
        const res = await fetch(ENDPOINTS.docs, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, session: docsSessionId })
        });
        if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            raw += decoder.decode(value, { stream: true });

            if (/Respuesta:/.test(raw)) {
                msg.isLoading = false;
                msg.text = formatDocsText(raw);
                if (currentMode === 'docs') renderCurrentChat();
            }
        }
        msg.isLoading = false;
        msg.text = formatDocsText(raw) || 'No se obtuvo respuesta.';
    } catch (e) {
        msg.isLoading = false;
        msg.text = 'No se pudo conectar con el servidor de normativas. Verifica que esté encendido.';
    } finally {
        isWaitingResponse = false;
        if (currentMode === 'docs') renderCurrentChat();
    }
}

MODES.docs = { send: handleDocsMessage };
