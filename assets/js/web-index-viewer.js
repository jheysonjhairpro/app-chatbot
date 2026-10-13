const API_URL = 'api/web-index.php';
const state = { portals: [], pages: [], selectedDomain: '', selectedUrl: '', search: '', detail: null, view: 'reading', offset: 0, limit: 20, total: 0, listRequest: 0, detailRequest: 0 };
const $ = (id) => document.getElementById(id);
const qualityLabels = { sin_fecha: 'Sin fecha', sin_titulo: 'Sin título', vacio: 'Sin texto', breve: 'Texto breve', titulo_repetido: 'Título repetido', contenido_repetido: 'Contenido repetido' };

function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function formatNumber(value) { return new Intl.NumberFormat('es-PE').format(Number(value || 0)); }
function safeUrl(value) {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
    catch { return null; }
}
async function fetchJson(params) {
    const res = await fetch(`${API_URL}?${new URLSearchParams(params)}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `No se pudo cargar el índice (HTTP ${res.status}).`);
    return data;
}
function renderDomains() {
    const rows = [{ value: '', label: 'Todos los portales' }, ...state.portals.map((value) => ({ value, label: value }))];
    $('domainList').innerHTML = rows.map(({ value, label }) => `<button class="domain-item${value === state.selectedDomain ? ' active' : ''}" data-domain="${escapeHtml(value)}"><span>${escapeHtml(label)}</span></button>`).join('');
    document.querySelectorAll('.domain-item').forEach((button) => button.addEventListener('click', () => {
        state.selectedDomain = button.dataset.domain;
        state.offset = 0;
        clearDetail();
        renderDomains();
        loadPages();
    }));
}
function pagination(loading = false) {
    $('previousPage').disabled = loading || state.offset === 0;
    $('nextPage').disabled = loading || state.offset + state.limit >= state.total;
    $('paginationStatus').textContent = state.total ? `${state.offset + 1}–${Math.min(state.offset + state.limit, state.total)} de ${formatNumber(state.total)}` : '0 resultados';
}
function renderPages() {
    $('currentFilter').textContent = state.selectedDomain ? `Portal: ${state.selectedDomain}` : 'Todas las páginas indexadas';
    if (!state.pages.length) {
        $('pageList').innerHTML = '<div class="empty-list">No hay páginas con ese filtro.</div>';
        return;
    }
    $('pageList').innerHTML = state.pages.map((page) => {
        const quality = (page.calidad || []).map((key) => qualityLabels[key] || key).join(' · ') || 'Sin alertas';
        return `<button class="page-item${page.url === state.selectedUrl ? ' active' : ''}" data-url="${escapeHtml(page.url)}">
            <span class="page-title">${escapeHtml(page.titulo || page.url)}</span><span class="page-url">${escapeHtml(page.url)}</span>
            <span class="page-meta"><b class="${page.calidad?.length ? 'warn' : 'ok'}">${escapeHtml(quality)}</b>
            ${formatNumber(page.documentos)} enlaces documentales · ${formatNumber(page.caracteres)} caracteres</span>
            <span class="page-preview">${escapeHtml(page.extracto)}</span></button>`;
    }).join('');
    document.querySelectorAll('.page-item').forEach((button) => button.addEventListener('click', () => loadPageDetail(button.dataset.url)));
}
function clearDetail() {
    state.selectedUrl = '';
    state.detail = null;
    state.detailRequest++;
    $('pageDetail').hidden = true;
    $('emptyDetail').hidden = false;
    $('emptyDetail').innerHTML = '<i class="bi bi-window-sidebar"></i><p>Selecciona una página para ver el contenido indexado.</p>';
}
function readingHtml(text) {
    return String(text || '').split(/\r?\n/).filter((line) => line.trim()).map((line) => `<p>${line.split(/(https?:\/\/[^\s<>]+)/g).map((part) => {
        const url = /^https?:\/\//.test(part) && safeUrl(part);
        return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part)}</a>` : escapeHtml(part);
    }).join('')}</p>`).join('');
}
function renderBlocks() {
    if (!state.detail) return;
    $('readingView').setAttribute('aria-pressed', String(state.view === 'reading'));
    $('rawView').setAttribute('aria-pressed', String(state.view === 'raw'));
    const blocks = state.detail.pagina.blocks || [];
    $('chunkList').innerHTML = blocks.map((block, index) => `<section class="chunk-card">
        <header><b>Bloque ${formatNumber(index + 1)} de ${formatNumber(blocks.length)}</b></header>
        ${state.view === 'raw' ? `<pre>${escapeHtml((block.heading ? block.heading + '\n' : '') + (block.text || ''))}</pre>` : `<div class="reader-content">${block.heading ? `<h3>${escapeHtml(block.heading)}</h3>` : ''}${readingHtml(block.text)}</div>`}</section>`).join('') || '<p class="empty-list">Esta página no contiene texto guardado.</p>';
    const documents = state.detail.documentos || [];
    if (documents.length) {
        $('chunkList').insertAdjacentHTML('beforeend', `<section class="reader-content"><h3>Documentos enlazados</h3><p>Son referencias de la página; el motor web no ha leído el contenido de estos archivos.</p>${documents.map((doc) => {
            const url = safeUrl(doc.url);
            return url ? `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(doc.nombre || doc.texto || doc.titulo || doc.url)}</a></p>` : '';
        }).join('')}</section>`);
    }
}
function renderDetail(data) {
    state.detail = data;
    const page = data.pagina;
    $('emptyDetail').hidden = true;
    $('pageDetail').hidden = false;
    const url = safeUrl(state.selectedUrl);
    $('detailDomain').textContent = url ? new URL(url).hostname : '';
    $('detailTitle').textContent = page.titulo || state.selectedUrl;
    $('detailUrl').textContent = state.selectedUrl;
    if (url) $('detailUrl').href = url;
    else $('detailUrl').removeAttribute('href');
    $('detailChunks').textContent = formatNumber((page.blocks || []).length);
    $('detailChars').textContent = formatNumber(Array.from((page.blocks || []).map((block) => block.text || '').join(' ').trim()).length);
    renderBlocks();
    $('chunkList').scrollTop = 0;
    renderPages();
}
async function loadPages() {
    const request = ++state.listRequest;
    $('pageList').innerHTML = '<div class="loading-row">Cargando páginas...</div>';
    pagination(true);
    try {
        const data = await fetchJson({ action: 'pages', portal: state.selectedDomain, q: state.search, offset: state.offset, limit: state.limit });
        if (request !== state.listRequest) return;
        state.pages = data.items || [];
        state.total = data.total || 0;
        renderPages();
        pagination();
    } catch (error) {
        if (request !== state.listRequest) return;
        state.pages = [];
        state.total = 0;
        $('pageList').innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
        pagination(true);
    }
}
async function loadPageDetail(url) {
    clearDetail();
    state.selectedUrl = url;
    const request = state.detailRequest;
    $('emptyDetail').innerHTML = '<p>Cargando contenido...</p>';
    renderPages();
    try {
        const data = await fetchJson({ action: 'page', url });
        if (request !== state.detailRequest) return;
        renderDetail(data);
        if (window.matchMedia('(max-width: 720px)').matches) $('pageDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        if (request === state.detailRequest) $('emptyDetail').innerHTML = `<p class="error-box">${escapeHtml(error.message)}</p>`;
    }
}
async function refreshAll() {
    $('refreshBtn').disabled = true;
    state.listRequest++;
    state.offset = 0;
    clearDetail();
    pagination(true);
    $('domainList').innerHTML = '<div class="loading-row">Cargando portales...</div>';
    try {
        const data = await fetchJson({ action: 'summary' });
        state.portals = data.portals || [];
        if (!state.portals.includes(state.selectedDomain)) state.selectedDomain = '';
        $('domainCount').textContent = formatNumber(state.portals.length);
        $('totalPages').textContent = formatNumber(data.summary.paginas);
        $('totalDocuments').textContent = formatNumber(data.summary.documentos);
        renderDomains();
        await loadPages();
    } catch (error) {
        state.pages = [];
        state.total = 0;
        $('pageList').innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
        $('domainList').innerHTML = '';
        for (const id of ['domainCount', 'totalPages', 'totalDocuments']) $(id).textContent = '—';
        pagination(true);
    } finally { $('refreshBtn').disabled = false; }
}
let searchTimer = 0;
document.addEventListener('DOMContentLoaded', () => {
    $('readingView').addEventListener('click', () => { state.view = 'reading'; renderBlocks(); });
    $('rawView').addEventListener('click', () => { state.view = 'raw'; renderBlocks(); });
    $('refreshBtn').addEventListener('click', refreshAll);
    $('previousPage').addEventListener('click', () => { state.offset = Math.max(0, state.offset - state.limit); clearDetail(); loadPages(); });
    $('nextPage').addEventListener('click', () => { state.offset += state.limit; clearDetail(); loadPages(); });
    $('searchInput').addEventListener('input', (event) => {
        clearTimeout(searchTimer);
        state.search = event.target.value.trim();
        state.listRequest++;
        state.offset = 0;
        clearDetail();
        pagination(true);
        searchTimer = setTimeout(loadPages, 250);
    });
    refreshAll();
});
