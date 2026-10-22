
const ENDPOINTS = {
    web: 'api/web.php',
    docs: 'api/docs.php',
    historial: 'api/ssaa/historial.php',
    constancias: 'api/ssaa/constancias.php'
};

const MODES = {};

let isWaitingResponse = false;
let currentMode = 'web';

// Preguntas seleccionadas de los documentos locales del portal y resoluciones indexadas.
const chipOptions = {
    web: [
        { label: "¿Qué carreras ofrece la UNAMBA?", icon: "bi-mortarboard-fill" },
        { label: "¿Qué información publica la UNAMBA sobre Beca Permanencia?", icon: "bi-award" },
        { label: "¿Dónde puedo realizar trámites virtuales de la UNAMBA?", icon: "bi-file-earmark-text" },
        { label: "¿Dónde puedo realizar pagos virtuales de la UNAMBA?", icon: "bi-credit-card" }
    ],
    docs: [
        { label: "Ver documentos disponibles", question: "/pdfs", icon: "bi-files" }
    ],
    academic: [
        { label: "Consultar mi historial académico", question: "/historial", icon: "bi-file-earmark-person" },
        { label: "Obtener mi constancia de matrícula", question: "/constancias", icon: "bi-file-earmark-check" },
        { label: "Cancelar consulta", question: "/cancelar", icon: "bi-x-circle" }
    ]
};

const chatHistories = {
    web: [
        { text: "¡Hola! 👋 Soy el asistente de la UNAMBA.<br><br>Explora carreras, maestrías, servicios, becas y trámites con información de los documentos del portal. Elige una pregunta para empezar; las respuestas incluyen fuentes cuando hay información disponible.", type: "unamba-msg-bot" }
    ],
    docs: [
        { text: "¡Hola! 📄 Consulta las resoluciones disponibles con referencias por página.<br><br>Usa <b>Ver documentos disponibles</b> para elegir una resolución y preguntar por su contenido.", type: "unamba-msg-bot" }
    ],
    academic: [
        { text: "🎓 Estás en <b>Consultas universitarias</b>.<br><br>Escribe <b>/historial</b> para solicitar tu historial académico o <b>/constancias</b> para obtener tu constancia de matrícula. Por seguridad, tu DNI se ocultará y no se guardará en el chat.<span class=\"unamba-privacy-note\">Usa este servicio únicamente para consultar tu propia información académica.</span>", type: "unamba-msg-bot" }
    ]
};

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadingHtml(texto) {
    return `<div class="unamba-loading-state">
        <span class="unamba-dots"><span></span><span></span><span></span></span>
        ${texto}
    </div>`;
}

document.addEventListener("DOMContentLoaded", () => {
    renderCurrentChat();
    renderChips();
    if (new URLSearchParams(window.location.search).get('chat') === '1') {
        document.getElementById('unambaWindow').style.display = 'flex';
        document.getElementById('unambaInput').focus();
    }
});

function setMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    document.getElementById('btnModeWeb').classList.toggle('active', mode === 'web');
    document.getElementById('btnModeDocs').classList.toggle('active', mode === 'docs');
    document.getElementById('btnModeAcademic').classList.toggle('active', mode === 'academic');

    renderCurrentChat();
    renderChips();
}

function renderChips() {
    const container = document.getElementById('chipContainer');
    if (!container) return;
    container.innerHTML = '';

    (chipOptions[currentMode] || []).forEach(item => {
        const div = document.createElement('button');
        div.type = 'button';
        div.className = 'unamba-chip';
        div.title = item.label;
        div.onclick = () => quickQuery(item.question || item.label);
        div.innerHTML = `<i class="bi ${item.icon}" aria-hidden="true"></i> ${escapeHtml(item.label)}`;
        container.appendChild(div);
    });
}

function renderCurrentChat() {
    const container = document.getElementById('unambaMsgs');
    if (!container) return;
    container.innerHTML = '';

    (chatHistories[currentMode] || []).forEach(item => {
        const div = document.createElement('div');
        div.className = `unamba-msg ${item.type}`;
        div.innerHTML = item.text;
        container.appendChild(div);
    });

    if (currentMode === 'web' && chatHistories[currentMode].length === 1) {
        const suggestions = document.createElement('section');
        suggestions.className = 'unamba-recommended';
        suggestions.setAttribute('aria-label', 'Preguntas recomendadas');
        const title = document.createElement('p');
        title.className = 'unamba-recommended-title';
        title.textContent = 'Preguntas para empezar';
        suggestions.appendChild(title);
        const grid = document.createElement('div');
        grid.className = 'unamba-question-grid';
        chipOptions[currentMode].slice(0, 4).forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'unamba-question-card';
            button.textContent = item.label;
            button.onclick = () => quickQuery(item.question || item.label);
            grid.appendChild(button);
        });
        suggestions.appendChild(grid);
        container.appendChild(suggestions);
    }
    container.scrollTop = chatHistories[currentMode].length === 1 ? 0 : container.scrollHeight;
}

function toggleUnambaChat() {
    const win = document.getElementById('unambaWindow');
    win.style.display = (win.style.display === 'flex') ? 'none' : 'flex';
}

function scrollChips(amount) {
    const container = document.getElementById('chipContainer');
    if (container) container.scrollBy({ left: amount, behavior: 'smooth' });
}

function quickQuery(queryText) {
    if (isWaitingResponse) return;
    document.getElementById('unambaInput').value = queryText;
    sendUnambaMsg();
}

async function sendUnambaMsg() {
    const input = document.getElementById('unambaInput');
    const text = input.value.trim();
    if (!text || isWaitingResponse) return;

    const modo = MODES[currentMode];
    if (!modo) return;

    input.value = '';
    await modo.send(text);
}

// Texto del modelo: se escapa antes de crear enlaces; nunca se inserta HTML recibido.
function formatRagText(raw, hide = /$^/) {
    const text = raw.replace(/\r/g, '').split('\n')
        .filter(line => !hide.test(line.trim())).join('\n')
        .replace(/^\s*Respuesta:\s*/m, '').trim();
    function plain(value) {
        return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
            .replace(/^Fuentes consultadas:/m, '<b>Fuentes consultadas:</b>')
            .replace(/^[-*]\s+/gm, '• ').replace(/\n/g, '<br>');
    }
    const links = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g;
    let result = '', position = 0;
    for (const match of text.matchAll(links)) {
        result += plain(text.slice(position, match.index));
        const url = match[2] || match[3];
        result += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${plain(match[1] || url)}</a>`;
        position = match.index + match[0].length;
    }
    return result + plain(text.slice(position));
}

async function sendRagMessage(mode, text, sessionId, formatter, displayText = text) {
    isWaitingResponse = true;
    const button = document.getElementById('unambaSendBtn');
    button.disabled = true;
    const history = chatHistories[mode];
    history.push({ text: escapeHtml(displayText), type: 'unamba-msg-user' });
    const msg = { text: loadingHtml('Buscando información...'), type: 'unamba-msg-bot', isLoading: true };
    history.push(msg);
    const render = () => { if (currentMode === mode) renderCurrentChat(); };
    render();
    const controller = new AbortController();
    let timer, reader, raw = '';
    const resetTimeout = () => {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(), 300000);
    };
    resetTimeout();
    try {
        const response = await fetch(ENDPOINTS[mode], {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            cache: 'no-store', signal: controller.signal,
            body: JSON.stringify({ message: text, session: sessionId })
        });
        if (!response.ok || !response.body) {
            const messages = { 403: 'El puente PHP no tiene autorización para consultar el servidor. Revisa el token de conexión.',
                502: 'No se pudo conectar con el servidor local de IA. Inicia el servidor y Ollama.',
                503: 'El servicio local no está preparado. Revisa la configuración de PHP.' };
            throw new Error(messages[response.status] || `El servicio devolvió un error (${response.status}).`);
        }
        reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            resetTimeout();
            raw += decoder.decode(value, { stream: true });
            msg.text = formatter(raw);
            if (msg.text) { msg.isLoading = false; render(); }
        }
        raw += decoder.decode();
        msg.text = formatter(raw) || 'No se obtuvo respuesta. Puedes volver a consultar.';
    } catch (error) {
        const message = error.name === 'AbortError'
            ? 'No llegaron datos durante cinco minutos. Revisa Ollama y vuelve a consultar.'
            : (error instanceof TypeError ? 'No se pudo conectar con la interfaz local. Revisa que PHP esté iniciado.' : error.message);
        msg.text = (raw ? formatter(raw) : '') + `<span class="unamba-stream-error">${escapeHtml(message)}</span>`;
        if (reader) await reader.cancel().catch(() => {});
    } finally {
        clearTimeout(timer);
        msg.isLoading = false;
        isWaitingResponse = false;
        button.disabled = false;
        render();
    }
}


// Una sola comprobación a la vez; no descarga modelos ni consulta documentos.
let serverStatusPending = false;
function showServerStatus(status) {
    const label = status === 'online' ? 'Servidor en línea' : 'Servidor desconectado';
    document.querySelectorAll('[data-server-status]').forEach(node => {
        node.dataset.serverStatus = status;
    });
    const text = document.getElementById('unambaServerStatusText');
    if (text && text.textContent !== label) text.textContent = label;
    const bubble = document.querySelector('.unamba-bubble');
    if (bubble) bubble.title = label;
}
async function checkServerStatus() {
    if (serverStatusPending) return;
    if (!navigator.onLine) { showServerStatus('offline'); return; }
    serverStatusPending = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch('api/estado.php', {cache: 'no-store', signal: controller.signal});
        const data = response.ok ? await response.json() : null;
        showServerStatus(data && data.servidor_disponible === true ? 'online' : 'offline');
    } catch (_) {
        showServerStatus('offline');
    } finally {
        clearTimeout(timeout);
        serverStatusPending = false;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();
    setInterval(() => { if (!document.hidden) checkServerStatus(); }, 8000);
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkServerStatus(); });
window.addEventListener('online', checkServerStatus);
window.addEventListener('offline', () => showServerStatus('offline'));
