const API_URL = 'api/web-index.php';

const state = {
    domains: [],
    pages: [],
    selectedDomain: '',
    selectedUrl: '',
    search: '',
    detail: null,
    view: 'reading'
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatNumber(value) {
    return new Intl.NumberFormat('es-PE').format(Number(value || 0));
}

async function fetchJson(params) {
    const url = `${API_URL}?${new URLSearchParams(params)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
        throw new Error(data.error || `Error HTTP ${res.status}`);
    }
    return data;
}

function renderDomains(summary) {
    state.domains = summary.domains || [];
    $('domainCount').textContent = formatNumber(summary.totals?.domains);
    $('totalPages').textContent = formatNumber(summary.totals?.pages);
    $('totalChunks').textContent = formatNumber(summary.totals?.chunks);

    const rows = [
        { domain: '', pages: summary.totals?.pages || 0, chunks: summary.totals?.chunks || 0, label: 'Todos los subdominios' },
        ...state.domains
    ];

    $('domainList').innerHTML = rows.map((item) => {
        const domain = item.domain || '';
        const active = domain === state.selectedDomain ? ' active' : '';
        const label = item.label || domain;
        return `
            <button class="domain-item${active}" data-domain="${escapeHtml(domain)}">
                <span>${escapeHtml(label)}</span>
                <small>${formatNumber(item.pages)} páginas · ${formatNumber(item.chunks)} chunks</small>
            </button>
        `;
    }).join('');

    document.querySelectorAll('.domain-item').forEach((button) => {
        button.addEventListener('click', () => {
            state.selectedDomain = button.dataset.domain || '';
            state.selectedUrl = '';
            loadPages();
            renderDomains(summary);
            clearDetail();
        });
    });
}

function pageQuality(page) {
    const preview = String(page.preview || '');
    const chars = Number(page.chars || 0);
    if (chars < 250) return ['Revisar', 'warn'];
    if (/�|\\[\\]|Previous Next|Inicia sesi[oó]n|Recuperar Acceso/i.test(preview)) return ['Ruido visible', 'warn'];
    return ['Limpio', 'ok'];
}

function renderPages() {
    $('currentFilter').textContent = state.selectedDomain
        ? `Subdominio: ${state.selectedDomain}`
        : 'Todas las páginas indexadas';

    if (!state.pages.length) {
        $('pageList').innerHTML = '<div class="empty-list">No hay páginas con ese filtro.</div>';
        return;
    }

    $('pageList').innerHTML = state.pages.map((page) => {
        const [quality, tone] = pageQuality(page);
        const active = page.url === state.selectedUrl ? ' active' : '';
        return `
            <button class="page-item${active}" data-url="${escapeHtml(page.url)}">
                <span class="page-title">${escapeHtml(page.title)}</span>
                <span class="page-url">${escapeHtml(page.url)}</span>
                <span class="page-meta">
                    <b class="${tone}">${quality}</b>
                    ${formatNumber(page.chunk_count)} chunks · ${formatNumber(page.chars)} caracteres
                </span>
                <span class="page-preview">${escapeHtml(page.preview)}</span>
            </button>
        `;
    }).join('');

    document.querySelectorAll('.page-item').forEach((button) => {
        button.addEventListener('click', () => loadPageDetail(button.dataset.url));
    });
}

function clearDetail() {
    state.detail = null;
    $('pageDetail').hidden = true;
    $('emptyDetail').hidden = false;
    $('emptyDetail').innerHTML = '<i class="bi bi-window-sidebar"></i><p>Selecciona una página para ver el contenido indexado.</p>';
}

function readingHtml(document) {
    // Escape source HTML before formatting headings and HTTP(S) links.
    const inline = (text) => text.split(/(https?:\/\/[^\s<>]+)/g).map((part) => {
        if (!/^https?:\/\//i.test(part)) return escapeHtml(part);
        const safe = escapeHtml(part);
        return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
    }).join('');
    return String(document || '').split(/\r?\n/).map((line) => {
        if (!line.trim()) return '';
        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
            const level = Math.min(heading[1].length + 2, 6);
            return `<h${level}>${inline(heading[2])}</h${level}>`;
        }
        return `<p>${inline(line)}</p>`;
    }).join('');
}

function renderChunks() {
    if (!state.detail) return;
    $('readingView').setAttribute('aria-pressed', String(state.view === 'reading'));
    $('rawView').setAttribute('aria-pressed', String(state.view === 'raw'));
    const chunks = state.detail.chunks || [];
    $('chunkList').innerHTML = chunks.map((chunk, index) => `
        <section class="chunk-card">
            <header>
                <b>Fragmento ${formatNumber(index + 1)} de ${formatNumber(chunks.length)}</b>
                <span>${formatNumber(chunk.chars)} caracteres</span>
            </header>
            ${state.view === 'raw' ? `<pre>${escapeHtml(chunk.document)}</pre>` : `<div class="reader-content">${readingHtml(chunk.document)}</div>`}
        </section>
    `).join('');
}

function renderDetail(data) {
    state.detail = data;
    const page = data.page;
    state.selectedUrl = page.url;
    $('emptyDetail').hidden = true;
    $('pageDetail').hidden = false;
    $('detailDomain').textContent = page.domain;
    $('detailTitle').textContent = page.title;
    $('detailUrl').textContent = page.url;
    $('detailUrl').href = page.url;
    $('detailChunks').textContent = formatNumber(page.chunk_count);
    $('detailChars').textContent = formatNumber(page.chars);

    renderChunks();
    $('chunkList').scrollTop = 0;

    renderPages();
}

async function loadSummary() {
    $('domainList').innerHTML = '<div class="loading-row">Cargando subdominios...</div>';
    const summary = await fetchJson({ action: 'summary' });
    renderDomains(summary);
}

async function loadPages() {
    $('pageList').innerHTML = '<div class="loading-row">Cargando páginas...</div>';
    const data = await fetchJson({
        action: 'pages',
        domain: state.selectedDomain,
        q: state.search
    });
    state.pages = data.pages || [];
    renderPages();
}

async function loadPageDetail(url) {
    state.selectedUrl = url;
    clearDetail();
    $('emptyDetail').innerHTML = '<p>Cargando contenido...</p>';
    renderPages();
    try {
        const data = await fetchJson({ action: 'page', url });
        if (state.selectedUrl !== url) return;
        renderDetail(data);
        if (window.matchMedia('(max-width: 720px)').matches) {
            $('pageDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        if (state.selectedUrl === url) $('emptyDetail').innerHTML = `<p class="error-box">${escapeHtml(error.message)}</p>`;
    }
}

async function refreshAll() {
    try {
        await loadSummary();
        await loadPages();
    } catch (error) {
        $('pageList').innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
        $('domainList').innerHTML = '';
        clearDetail();
    }
}

let searchTimer = 0;

document.addEventListener('DOMContentLoaded', () => {
    $('readingView').addEventListener('click', () => { state.view = 'reading'; renderChunks(); });
    $('rawView').addEventListener('click', () => { state.view = 'raw'; renderChunks(); });
    $('refreshBtn').addEventListener('click', refreshAll);
    $('searchInput').addEventListener('input', (event) => {
        clearTimeout(searchTimer);
        state.search = event.target.value.trim();
        searchTimer = setTimeout(() => {
            state.selectedUrl = '';
            clearDetail();
            loadPages().catch((error) => {
                $('pageList').innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
            });
        }, 250);
    });

    refreshAll();
});
