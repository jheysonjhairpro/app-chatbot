/* Edita una copia del FUT descargado. Los datos permanecen en esta ventana. */
const token = document.body.dataset.token;
const sourceUrl = 'api/fut-descargar.php?token=' + encodeURIComponent(token);
const form = document.getElementById('futEditorForm');
const status = document.getElementById('editorStatus');
const error = document.getElementById('editorError');
const notice = document.getElementById('editorNotice');
const preview = document.getElementById('pdfPreview');
const applyButton = document.getElementById('applyChanges');
const saveButton = document.getElementById('savePdf');
const fields = ['resumen','destinatario','cargo','nombre','escuela','codigo','dni','direccion','distrito','provincia','departamento','celular','correo','fundamentacion','adjuntos','folios'];
let originalValues = Object.fromEntries(fields.map(name => [name, '']));
let sourceRequest = null;
let editedUrl = null;
let previewVersion = 0;
let formVersion = 0;
const previewLibrary = import('./vendor/pdf.min.mjs').then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('assets/js/vendor/pdf.worker.min.mjs', document.baseURI).href;
    return pdfjs;
});
const fixedLocation = { distrito: 'Abancay', provincia: 'Abancay', departamento: 'Apurímac' };

renderPreview(loadPdf()).then(shown => {
    if (shown && !formVersion) status.textContent = 'PDF original listo';
}).catch(caught => {
    if (previewVersion === 1) {
        const placeholder = preview.querySelector('p');
        if (placeholder) placeholder.textContent = 'No se pudo mostrar la vista previa.';
        showError(caught);
    }
});

window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.opener || event.data?.type !== 'fut-editor-draft' || event.data.token !== token) return;
    const draft = event.data.draft || {};
    fields.forEach(name => {
        if (name === 'dni') return;
        const value = String(draft[name] || '');
        form.elements[name].value = fixedLocation[name] || value;
        originalValues[name] = value.trim();
    });
});
if (window.opener) window.opener.postMessage({ type: 'fut-editor-ready', token }, location.origin);

function loadPdf() {
    if (!sourceRequest) {
        sourceRequest = fetch(sourceUrl, { cache: 'no-store', credentials: 'same-origin' }).then(response => {
            if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
                throw new Error('El FUT ya no está disponible. Genera uno nuevo desde el chat.');
            }
            return response.arrayBuffer();
        }).catch(caught => {
            sourceRequest = null;
            throw caught;
        });
    }
    return sourceRequest;
}

function pdfUrl(bytes) {
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

async function renderPreview(bytes) {
    const version = ++previewVersion;
    const [pdfjs, data] = await Promise.all([previewLibrary, bytes]);
    // PDF.js transfiere el búfer al worker. Conserva los bytes para editar o descargar.
    const task = pdfjs.getDocument({ data: new Uint8Array(data).slice(), useWasm: false, isEvalSupported: false });
    try {
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Vista previa del Formulario Único de Trámite');
        await page.render({ canvas, viewport }).promise;
        if (version !== previewVersion) return false;
        preview.replaceChildren(canvas);
        return true;
    } finally {
        await task.destroy();
    }
}

function showError(caught) {
    error.textContent = caught.message || 'No se pudo cargar el PDF.';
    status.textContent = 'Revisa el formulario';
}

function clean(value) {
    return String(value || '').replace(/[\u0000-\u001f]/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').trim();
}

function linesFor(value, font, size, width, maximum) {
    const words = clean(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const next = (line + ' ' + word).trim();
        if (font.widthOfTextAtSize(next, size) <= width) line = next;
        else {
            if (!line || font.widthOfTextAtSize(word, size) > width) throw new Error('Una palabra no cabe en su casilla. Acórtala.');
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    if (lines.length > maximum) throw new Error('Un texto no cabe en su casilla. Resúmelo antes de descargar.');
    return lines;
}

function white(page, x, y, width, height) {
    page.drawRectangle({ x, y, width, height, color: PDFLib.rgb(1, 1, 1) });
}

function write(page, font, value, { x, y, width, size = 8, max = 1, leading = 14, maskX = x - 1, maskY = y - 2.5, maskW = width + 2, maskH = 9.5 }) {
    const lines = linesFor(value, font, size, width, max);
    white(page, maskX, maskY, maskW, maskH);
    lines.forEach((line, index) => page.drawText(line, { x, y: y - index * leading, size, font, color: PDFLib.rgb(0, 0, 0) }));
}

function drawUpdatedField(page, font, name, value) {
    const one = (x, y, width, size = 8) => write(page, font, value, { x, y, width, size });
    switch (name) {
        case 'resumen': {
            const lines = linesFor(value, font, 8.5, 224, 2);
            white(page, 313, 649, 228, 31);
            page.drawLine({ start: { x: 310, y: 664.5 }, end: { x: 546, y: 664.5 }, thickness: .45, color: PDFLib.rgb(.55, .55, .55) });
            lines.forEach((line, index) => page.drawText(line, { x: 315, y: 668 - index * 14, size: 8.5, font }));
            break;
        }
        case 'destinatario': one(101, 612, 416); break;
        case 'cargo': one(101, 592, 416); break;
        case 'nombre': one(55, 552, 470); break;
        case 'escuela': one(55, 508, 460); break;
        case 'codigo': write(page, font, value, { x: 425, y: 483, width: 112, maskX: 424, maskY: 480.7, maskW: 115, maskH: 9.3 }); break;
        case 'dni': write(page, font, value, { x: 111, y: 483, width: 170, maskX: 109, maskY: 480.7, maskW: 174, maskH: 9.3 }); break;
        case 'direccion': one(55, 451, 470); break;
        case 'distrito': write(page, font, value, { x: 115, y: 430, width: 85, maskX: 114, maskY: 427.5, maskW: 87, maskH: 9.5 }); break;
        case 'provincia': write(page, font, value, { x: 277, y: 430, width: 76, maskX: 275, maskY: 427.5, maskW: 79, maskH: 9.5 }); break;
        case 'departamento': write(page, font, value, { x: 427, y: 430, width: 100, maskX: 425, maskY: 427.5, maskW: 117, maskH: 9.5 }); break;
        case 'celular': {
            write(page, font, value, { x: 276, y: 405.5, width: 74, maskX: 274, maskY: 402, maskW: 81, maskH: 13.6 });
            page.drawLine({ start: { x: 274, y: 415.6 }, end: { x: 355, y: 415.6 }, thickness: .45, color: PDFLib.rgb(.5, .5, .5) });
            break;
        }
        case 'correo': {
            // El correo del PDF original comienza antes de la división de la celda.
            write(page, font, value, { x: 427, y: 405.5, width: 111, size: 7.7, maskX: 419, maskY: 402, maskW: 122, maskH: 13.6 });
            page.drawLine({ start: { x: 424, y: 401.2 }, end: { x: 424, y: 415.6 }, thickness: .45, color: PDFLib.rgb(.5, .5, .5) });
            page.drawLine({ start: { x: 49.5, y: 415.6 }, end: { x: 547.6, y: 415.6 }, thickness: .45, color: PDFLib.rgb(.5, .5, .5) });
            break;
        }
        case 'fundamentacion': {
            const lines = linesFor(value, font, 8.5, 463, 4);
            for (const y of [331, 314, 297, 280]) white(page, 56, y - 2.5, 468, 11);
            lines.forEach((line, index) => page.drawText(line, { x: 58, y: 331 - index * 17, size: 8.5, font }));
            break;
        }
        case 'adjuntos': {
            const items = value.split(/\n|[,;]/).map(item => item.trim()).filter(Boolean);
            if (items.length > 12) throw new Error('El formato FUT admite hasta 12 documentos adjuntos.');
            for (let i = 0; i < 12; i++) {
                const col = Math.floor(i / 6), row = i % 6;
                const x = 77 + col * 248, y = 230 - row * 15.3;
                write(page, font, items[i] || '', { x, y, width: 205, size: 8, maskX: x - 1, maskY: y - 2.5, maskW: 206, maskH: 9.5 });
            }
            break;
        }
        case 'folios': one(290, 129, 235); break;
    }
}

function drawToday(page, font) {
    const date = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date());
    const lines = ['Abancay, provincia de Abancay, Apurímac', date];
    white(page, 53, 46, 225, 35);
    lines.forEach((line, index) => {
        const size = index ? 8.5 : 8;
        const width = font.widthOfTextAtSize(line, size);
        if (width > 216) throw new Error('El lugar y la fecha no caben en la casilla.');
        page.drawText(line, { x: 165 - width / 2, y: 66 - index * 13, size, font });
    });
}

function normalized(value) {
    return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function subject(value) {
    const text = normalized(value).slice(0, 180);
    const patterns = [
        ['comedor', /\bcomedor\b/],
        ['estudios', /constancia.{0,30}estudios|constancia.{0,30}academica/],
        ['similitud', /filtro.{0,25}similitud|similitud/],
        ['rectificacion', /rectific|correccion.{0,25}datos academicos/],
    ];
    return patterns.map(([topic, pattern]) => ({ topic, index: text.search(pattern) }))
        .filter(match => match.index >= 0).sort((a, b) => a.index - b.index)[0]?.topic || '';
}

function suggestedSummary(topic, foundation) {
    if (topic === 'comedor') return /tarjeta/.test(normalized(foundation))
        ? 'Solicito la asignación de una tarjeta de comedor universitario.'
        : 'Solicito el acceso al servicio de comedor universitario.';
    if (topic === 'estudios') return 'Solicito la emisión de mi constancia de estudios.';
    if (topic === 'similitud') return 'Solicito la emisión de mi constancia de filtro de similitud.';
    if (topic === 'rectificacion') return 'Solicito la rectificación de mis datos académicos.';
    return '';
}

function alignSummary(values) {
    if (/^(si+|ok|porfa|ninguno)$/i.test(normalized(values.fundamentacion))) {
        throw new Error('La fundamentación debe explicar el motivo del pedido; escribe una frase sobre tu situación o necesidad.');
    }
    const foundationTopic = subject(values.fundamentacion);
    const summaryTopic = subject(values.resumen);
    const suggested = suggestedSummary(foundationTopic, values.fundamentacion);
    if (foundationTopic && summaryTopic && foundationTopic !== summaryTopic) {
        throw new Error(`El resumen y la fundamentación describen pedidos distintos. Para esta fundamentación, revisa el resumen; por ejemplo: «${suggested}»`);
    }
    const vague = !values.resumen || /^(si+|ok|ya|porfa|quiero|solicito)$/i.test(normalized(values.resumen));
    const informal = !!foundationTopic && /^(quiero|necesito|me gustaria|dame|denme)\b/.test(normalized(values.resumen));
    if ((vague || informal) && suggested) {
        values.resumen = suggested;
        form.elements.resumen.value = suggested;
        notice.textContent = 'Ajusté el resumen para que describa el mismo pedido que la fundamentación. Revísalo en la vista previa.';
    } else if (vague) {
        throw new Error('Escribe qué solicitas en el resumen; una respuesta como «sí» no describe el pedido.');
    }
}

async function applyChanges() {
    error.textContent = '';
    notice.textContent = '';
    status.textContent = 'Actualizando vista previa…';
    const version = formVersion;
    const bytes = await loadPdf();
    const doc = await PDFLib.PDFDocument.load(bytes);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const values = Object.fromEntries(fields.map(name => [name, form.elements[name].value.trim()]));
    values.codigo = values.codigo.replace(/^c[oó]digo\s*:\s*/i, '');
    values.celular = values.celular.replace(/^\+51\s*/, '').replace(/[\s-]/g, '');
    Object.assign(values, fixedLocation);
    alignSummary(values);
    if (values.dni && !/^\d{8}$/.test(values.dni)) throw new Error('El DNI debe tener 8 dígitos.');
    if (values.codigo && !/^[a-z0-9-]{1,20}$/i.test(values.codigo)) throw new Error('Escribe solo el código de estudiante.');
    if (values.celular && !/^\d{7,9}$/.test(values.celular)) throw new Error('Escribe un número de contacto de 7 a 9 dígitos.');
    for (const name of fields) {
        if (name === 'dni' && !values.dni) continue;
        const realign = values[name] && ['codigo', 'celular', 'correo'].includes(name);
        if (realign || values[name] !== originalValues[name]) drawUpdatedField(page, font, name, values[name]);
    }
    drawToday(page, font);
    const pdfBytes = await doc.save();
    await renderPreview(pdfBytes);
    if (editedUrl) URL.revokeObjectURL(editedUrl);
    editedUrl = pdfUrl(pdfBytes);
    saveButton.disabled = version !== formVersion;
    status.textContent = saveButton.disabled ? 'Cambios sin aplicar' : 'Vista previa actualizada';
}

form.addEventListener('submit', async event => {
    event.preventDefault();
    if (applyButton.disabled) return;
    applyButton.disabled = true;
    saveButton.disabled = true;
    try { await applyChanges(); }
    catch (caught) { showError(caught); }
    finally { applyButton.disabled = false; }
});
saveButton.addEventListener('click', () => {
    if (!editedUrl) return;
    const link = document.createElement('a');
    link.href = editedUrl;
    link.download = 'FUT-UNAMBA-editado.pdf';
    link.click();
});
form.addEventListener('input', () => {
    formVersion++;
    saveButton.disabled = true;
    notice.textContent = '';
    status.textContent = 'Cambios sin aplicar';
});
window.addEventListener('beforeunload', () => {
    if (editedUrl) URL.revokeObjectURL(editedUrl);
});
