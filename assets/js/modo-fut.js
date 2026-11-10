/* Asistente FUT: respuestas JSON y descarga protegida por el puente PHP. */
const futSessionId = window.crypto?.randomUUID?.() || String(Date.now()) + Math.random();
let futAwaitingDni = false;
let futLatestReview = {};
const futEditorDrafts = new Map();

function futReviewFields(reply) {
    if (!reply.startsWith('Revisa tu borrador antes de crear el PDF:')) return null;
    const line = label => (reply.match(new RegExp('^' + label + ': (.*)$', 'm')) || [,''])[1].trim();
    const pair = value => value.split(' · ');
    const recipient = pair(line('Destinatario'));
    const applicant = pair(line('Solicitante'));
    const school = pair(line('Escuela'));
    const address = pair(line('Domicilio'));
    const contact = pair(line('Contacto'));
    const places = (address[1] || '').split(',').map(value => value.trim());
    const attachments = line('Adjuntos');
    return {
        resumen: line('Pedido'), destinatario: recipient[0] || '', cargo: recipient[1] || '',
        nombre: applicant[0] || '', escuela: school[0] === 'No indicada' ? '' : school[0] || '',
        codigo: (school[1] || '').replace(/^Código:\s*/i, '').replace(/^No indicado$/i, ''),
        direccion: address[0] === 'No indicado' ? '' : address[0] || '',
        distrito: places[0] || '', provincia: places[1] || '', departamento: places[2] || '',
        celular: contact[0] === 'No indicado' ? '' : contact[0] || '',
        correo: contact[1] === 'Correo no indicado' ? '' : contact[1] || '',
        fundamentacion: line('Fundamentación'), adjuntos: attachments === 'Ninguno indicado' ? '' : attachments,
        folios: line('Folios') === 'Por completar' ? '' : line('Folios')
    };
}

document.addEventListener('click', event => {
    const edit = event.target.closest('[data-fut-edit]');
    if (!edit) return;
    const token = edit.dataset.futEdit;
    if (!/^[A-Za-z0-9_-]{30,80}$/.test(token)) return;
    window.open('fut-editar.php?token=' + encodeURIComponent(token), '_blank');
});

window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.data?.type !== 'fut-editor-ready') return;
    const token = event.data.token;
    if (futEditorDrafts.has(token)) event.source?.postMessage({ type: 'fut-editor-draft', token, draft: futEditorDrafts.get(token) }, event.origin);
});

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
        const review = futReviewFields(result.reply || '');
        if (review) futLatestReview = review;
        placeholder.text = escapeHtml(result.reply || '').replace(/\n/g, '<br>');
        if (result.download_token && /^[A-Za-z0-9_-]{30,80}$/.test(result.download_token)) {
            futEditorDrafts.set(result.download_token, { ...futLatestReview });
            const url = 'api/fut-descargar.php?token=' + encodeURIComponent(result.download_token);
            placeholder.text += `<div class="unamba-download-card"><i class="bi bi-file-earmark-pdf"></i><a href="${url}" download="FUT-UNAMBA.pdf">Descargar FUT en PDF</a></div>`;
            placeholder.text += `<button type="button" class="unamba-fut-edit" data-fut-edit="${result.download_token}"><i class="bi bi-pencil-square" aria-hidden="true"></i> Editar este FUT</button>`;
        }
    } catch (error) {
        placeholder.text = `<span class="unamba-stream-error">${escapeHtml(error.message)}</span>`;
    } finally {
        isWaitingResponse = false;
        button.disabled = false;
        if (currentMode === 'fut') renderCurrentChat();
    }
} };
