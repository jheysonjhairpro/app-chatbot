/* Asistente FUT: respuestas JSON y descarga protegida por el puente PHP. */
const futSessionId = window.crypto?.randomUUID?.() || String(Date.now()) + Math.random();
let futAwaitingDni = false;

function futMessage(html, type) {
    chatHistories.fut.push({ text: html, type });
    if (currentMode === 'fut') renderCurrentChat();
}

MODES.fut = { send: async text => {
    if (isWaitingResponse) return;
    isWaitingResponse = true;
    const button = document.getElementById('unambaSendBtn');
    button.disabled = true;
    const privateInput = futAwaitingDni || /^dni\s*:/i.test(text);
    futMessage(privateInput ? 'DNI recibido (oculto)' : escapeHtml(text), 'unamba-msg-user');
    futMessage(loadingHtml('Preparando el FUT…'), 'unamba-msg-bot');
    const placeholder = chatHistories.fut[chatHistories.fut.length - 1];
    try {
        const response = await fetch(ENDPOINTS.fut, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
            body: JSON.stringify({ message: text, session: futSessionId })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Error ${response.status}`);
        futAwaitingDni = /DNI de 8 dígitos/i.test(result.reply || '');
        placeholder.text = escapeHtml(result.reply || '').replace(/\n/g, '<br>');
        if (result.download_token && /^[A-Za-z0-9_-]{30,80}$/.test(result.download_token)) {
            const url = 'api/fut-descargar.php?token=' + encodeURIComponent(result.download_token);
            placeholder.text += `<div class="unamba-download-card"><i class="bi bi-file-earmark-pdf"></i><a href="${url}" download="FUT-UNAMBA.pdf">Descargar FUT en PDF</a></div>`;
        }
    } catch (error) {
        placeholder.text = `<span class="unamba-stream-error">${escapeHtml(error.message)}</span>`;
    } finally {
        isWaitingResponse = false;
        button.disabled = false;
        if (currentMode === 'fut') renderCurrentChat();
    }
} };
