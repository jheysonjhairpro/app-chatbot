/* Modo Consultas universitarias: consume historial.php y constancias.php. */

let academicFlow = { step: 'idle', studentCode: '', documentType: '' };
const downloadUrls = [];

function addAcademicMessage(text, type = 'unamba-msg-bot') {
    chatHistories.academic.push({ text, type });
    if (currentMode === 'academic') renderCurrentChat();
}

function resetAcademicFlow() {
    academicFlow = { step: 'idle', studentCode: '', documentType: '' };
}

async function handleAcademicMessage(rawText) {
    const text = rawText.trim();
    const command = text.toLowerCase();

    if (command === '/cancelar') {
        addAcademicMessage('/cancelar', 'unamba-msg-user');
        resetAcademicFlow();
        addAcademicMessage('Consulta cancelada. Escribe <b>/historial</b> o <b>/constancias</b> cuando quieras comenzar otra vez.');
        return;
    }

    if (command === '/historial') {
        addAcademicMessage('/historial', 'unamba-msg-user');
        academicFlow = { step: 'awaiting_code', studentCode: '', documentType: 'historial' };
        addAcademicMessage('Ingresa tu <b>código de estudiante</b> (6 caracteres).<br><span class="unamba-privacy-note">Puedes escribir /cancelar en cualquier momento.</span>');
        return;
    }

    if (command === '/constancias') {
        addAcademicMessage('/constancias', 'unamba-msg-user');
        academicFlow = { step: 'awaiting_code', studentCode: '', documentType: 'constancia' };
        addAcademicMessage('<b>Importante:</b> esta opción es únicamente para estudiantes que ya realizaron su matrícula. Si no estás matriculado, el sistema no generará ninguna constancia.<br><br>Ingresa tu <b>código de estudiante</b> (6 caracteres).<br><span class="unamba-privacy-note">Puedes escribir /cancelar en cualquier momento.</span>');
        return;
    }

    if (academicFlow.step === 'awaiting_code') {
        const studentCode = text.toUpperCase();
        addAcademicMessage(escapeHtml(studentCode), 'unamba-msg-user');

        if (!/^[A-Z0-9]{6}$/.test(studentCode)) {
            addAcademicMessage('El código debe tener exactamente <b>6 letras o números</b>. Inténtalo nuevamente.');
            return;
        }

        academicFlow = { step: 'awaiting_dni', studentCode, documentType: academicFlow.documentType };
        addAcademicMessage('Ahora ingresa tu <b>DNI de 8 dígitos</b>.<br><span class="unamba-privacy-note">El DNI aparecerá oculto y se usará solo para esta consulta.</span>');
        return;
    }

    if (academicFlow.step === 'awaiting_dni') {
        addAcademicMessage('DNI recibido (oculto por seguridad)', 'unamba-msg-user');

        if (!/^\d{8}$/.test(text)) {
            addAcademicMessage('El DNI debe contener exactamente <b>8 dígitos</b>. Inténtalo nuevamente.');
            return;
        }

        const { studentCode, documentType } = academicFlow;
        resetAcademicFlow();
        await requestAcademicHistory(studentCode, text, documentType);
        return;
    }

    addAcademicMessage(escapeHtml(text), 'unamba-msg-user');
    addAcademicMessage('Comando no reconocido. Escribe <b>/historial</b> o <b>/constancias</b>.');
}

async function requestAcademicHistory(studentCode, dni, documentType = 'historial') {
    const isConstancia = documentType === 'constancia';
    const documentLabel = isConstancia ? 'constancia de matrícula' : 'historial académico';
    const fileName = `${isConstancia ? 'Constancia_Matricula' : 'Historial_Academico'}_${studentCode}.pdf`;
    isWaitingResponse = true;
    chatHistories.academic.push({
        text: loadingHtml(`Consultando ${documentLabel}...`),
        type: 'unamba-msg-bot',
        isAcademicLoading: true
    });
    if (currentMode === 'academic') renderCurrentChat();

    try {
        const endpoint = isConstancia ? ENDPOINTS.constancias : ENDPOINTS.historial;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ studentCode, dni })
        });

        if (!response.ok) {
            let message = 'No se pudo obtener el historial académico.';
            try {
                const errorData = await response.json();
                if (errorData && errorData.error) message = errorData.error;
            } catch (_) {}
            throw new Error(message);
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        let pdfBlob;

        if (contentType.includes('application/pdf')) {
            pdfBlob = await response.blob();
        } else if (contentType.includes('text/html')) {
            const academicHtml = await response.text();
            pdfBlob = await academicHtmlToPdf(academicHtml, studentCode);
        } else {
            throw new Error('El sistema académico devolvió un formato no reconocido.');
        }

        const downloadUrl = URL.createObjectURL(pdfBlob);
        downloadUrls.push(downloadUrl);

        const loadingIndex = chatHistories.academic.findIndex(item => item.isAcademicLoading);
        const successHtml = `
            Tu ${documentLabel} está lista.
            <div class="unamba-download-card">
                <i class="bi bi-file-earmark-pdf-fill"></i>
                <a href="${downloadUrl}" download="${fileName}">Descargar ${documentLabel}</a>
            </div>
            <span class="unamba-privacy-note">El enlace estará disponible mientras mantengas abierta esta página.</span>
        `;

        if (loadingIndex !== -1) {
            chatHistories.academic[loadingIndex] = { text: successHtml, type: 'unamba-msg-bot' };
        } else {
            chatHistories.academic.push({ text: successHtml, type: 'unamba-msg-bot' });
        }
    } catch (error) {
        const loadingIndex = chatHistories.academic.findIndex(item => item.isAcademicLoading);
        const safeMessage = escapeHtml(String(error.message || 'No se pudo completar la consulta.'));
        const errorHtml = `${safeMessage}<br><br>Verifica tus datos y escribe <b>/historial</b> para intentarlo otra vez.`;

        if (loadingIndex !== -1) {
            chatHistories.academic[loadingIndex] = { text: errorHtml, type: 'unamba-msg-bot' };
        } else {
            chatHistories.academic.push({ text: errorHtml, type: 'unamba-msg-bot' });
        }
    } finally {
        isWaitingResponse = false;
        if (currentMode === 'academic') renderCurrentChat();
    }
}

function buildSafeAcademicReport(sourceHtml) {
    const sourceDocument = new DOMParser().parseFromString(sourceHtml, 'text/html');
    const sourceRoot = sourceDocument.querySelector('#pagecell2, #enlace, .reporte, main') || sourceDocument.body;
    const report = document.createElement('section');
    report.setAttribute('aria-hidden', 'true');
    report.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;padding:28px;background:#fff;color:#111;font:12px Arial,sans-serif;z-index:-1;';

    const allowedTags = new Set([
        'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD',
        'DIV', 'SECTION', 'P', 'SPAN', 'FONT', 'CENTER',
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'STRONG', 'B', 'EM', 'I', 'U', 'SMALL', 'BR', 'HR',
        'UL', 'OL', 'LI'
    ]);
    const blockedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'INPUT', 'BUTTON', 'NOSCRIPT']);

    function copySafeNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(node.textContent || '');
        }
        if (node.nodeType !== Node.ELEMENT_NODE || blockedTags.has(node.tagName)) {
            return null;
        }

        const container = allowedTags.has(node.tagName)
            ? document.createElement(node.tagName === 'FONT' || node.tagName === 'CENTER' ? 'div' : node.tagName.toLowerCase())
            : document.createDocumentFragment();

        if (container instanceof HTMLElement) {
            if ((node.tagName === 'TD' || node.tagName === 'TH') && /^\d{1,2}$/.test(node.getAttribute('colspan') || '')) {
                container.setAttribute('colspan', node.getAttribute('colspan'));
            }
            if ((node.tagName === 'TD' || node.tagName === 'TH') && /^\d{1,2}$/.test(node.getAttribute('rowspan') || '')) {
                container.setAttribute('rowspan', node.getAttribute('rowspan'));
            }
            if (node.tagName === 'TABLE') {
                container.style.cssText = 'width:100%;border-collapse:collapse;margin:10px 0;page-break-inside:auto;';
            } else if (node.tagName === 'TD' || node.tagName === 'TH') {
                container.style.cssText = 'border:1px solid #777;padding:5px 7px;vertical-align:top;';
            } else if (node.tagName === 'TR') {
                container.style.pageBreakInside = 'avoid';
            }
        }

        node.childNodes.forEach(child => {
            const safeChild = copySafeNode(child);
            if (safeChild) container.appendChild(safeChild);
        });
        return container;
    }

    const heading = document.createElement('div');
    heading.style.cssText = 'border-bottom:3px solid #e6a100;padding-bottom:10px;margin-bottom:16px;color:#002060;';
    heading.innerHTML = '<h1 style="margin:0;font-size:20px;">UNAMBA — Historial académico</h1>';
    report.appendChild(heading);

    sourceRoot.childNodes.forEach(child => {
        const safeChild = copySafeNode(child);
        if (safeChild) report.appendChild(safeChild);
    });

    return report;
}

async function academicHtmlToPdf(sourceHtml, studentCode) {
    if (typeof window.html2pdf !== 'function') {
        throw new Error('No se pudo cargar el generador de PDF. Recarga la página e inténtalo otra vez.');
    }

    const report = buildSafeAcademicReport(sourceHtml);
    document.body.appendChild(report);

    try {
        return await window.html2pdf()
            .set({
                margin: [10, 8, 10, 8],
                filename: `Historial_Academico_${studentCode}.pdf`,
                image: { type: 'jpeg', quality: 0.96 },
                html2canvas: { scale: 2, useCORS: false, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
            })
            .from(report)
            .outputPdf('blob');
    } finally {
        report.remove();
    }
}

window.addEventListener('beforeunload', () => {
    downloadUrls.forEach(url => URL.revokeObjectURL(url));
});

MODES.academic = { send: handleAcademicMessage };
