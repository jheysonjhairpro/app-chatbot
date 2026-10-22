/* Lista documental legible; conserva los números originales de /pdfs. */
const docsSessionId = window.crypto?.randomUUID?.() || String(Date.now()) + Math.random();
const pdfTitles = new Map();
function pdfDisplayName(filename) {
    const stem = filename.replace(/\.pdf$/i, '').replace(/_[a-f0-9]{8,}$/i, '')
        .replace(/^\d{6,}-/, '').replace(/resoluci-on/ig, 'resolucion');
    const match = stem.match(/resolucion-(directoral-)?(?:no?-)?(?:0-)?0*(\d+)(?:-(20\d{2}))?/i);
    if (!match) return stem.replace(/[_-]+/g, ' ');
    const kind = match[1] ? 'Resolución Directoral' : 'Resolución';
    const year = match[3] ? `-${match[3]}` : '';
    const office = /diga-unamba/i.test(stem) ? ' · DIGA-UNAMBA' : '';
    return `${kind} N.º ${Number(match[2])}${year}${office}`;
}
function formatDocsText(raw, selectedTitle = null) {
    if (selectedTitle && /Documento seleccionado\. Ya puedes preguntar\./.test(raw)) {
        return `Documento seleccionado: <b>${escapeHtml(selectedTitle)}</b>.<br>Escribe tu pregunta sobre este documento.`;
    }
    const lines = raw.replace(/\r/g, '').split('\n');
    if (lines.some(line => /^0\. Todos los PDF\s*$/.test(line.trim()))) {
        const entries = lines.map(line => line.match(/^(\d+)\. (.+\.pdf)\s*$/i))
            .filter(match => match && Number(match[1]) > 0);
        if (entries.length) {
            const rows = entries.map(match => {
                const number = Number(match[1]);
                const index = lines.findIndex(line => line.match(/^(\d+)\. /)?.[1] === match[1]);
                const titleLine = lines[index + 1]?.match(/^\s*Título:\s*(.+)$/);
                const title = titleLine && !/\.pdf$/i.test(titleLine[1]) ? titleLine[1].replace(/ - Documentos de Google$/i, '') : pdfDisplayName(match[2]);
                pdfTitles.set(number, title);
                return `<button type="button" class="unamba-pdf-select" data-pdf-number="${number}" title="${escapeHtml(match[2])}"><span class="unamba-pdf-number">${number}</span><span>${escapeHtml(title)}</span><span aria-hidden="true">›</span></button>`;
            }).join('');
            return `<div class="unamba-pdf-catalog"><b>Documentos disponibles</b><p>Selecciona un documento y luego escribe tu pregunta.</p><button type="button" class="unamba-pdf-select unamba-pdf-all" data-pdf-number="0">Consultar todos los documentos</button><div class="unamba-pdf-list" aria-label="Lista de documentos">${rows}</div></div>`;
        }
    }
    return formatRagText(raw, /^(Documento:|Contexto:|Preparación:|Consulta directa|Ollama:|Total:|Respuesta recuperada|Retomo|Revisión completa|Cobertura:|Respuestas:)/);
}
document.addEventListener('click', event => {
    const button = event.target.closest('.unamba-pdf-select');
    if (!button || !/^\d+$/.test(button.dataset.pdfNumber || '')) return;
    if (currentMode === 'docs') quickQuery(`/pdf ${Number(button.dataset.pdfNumber)}`);
});
MODES.docs = { send: text => {
    const selection = text.trim().match(/^\/pdf\s+(\d+)$/i);
    const title = selection ? (Number(selection[1]) === 0 ? 'Todos los documentos' : pdfTitles.get(Number(selection[1]))) : null;
    const display = title ? `Consultar: ${title}` : text.trim() === '/pdfs' ? 'Ver documentos disponibles' : text;
    return sendRagMessage('docs', text, docsSessionId, raw => formatDocsText(raw, title), display);
} };
