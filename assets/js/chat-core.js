
const ENDPOINTS = {
    web: 'api/web.php',
    docs: 'api/docs.php',
    historial: 'api/ssaa/historial.php',
    constancias: 'api/ssaa/constancias.php'
};

const MODES = {};

let isWaitingResponse = false;
let currentMode = 'web';

const chipOptions = {
    web: [
        { label: "¿Cómo realizo trámites virtuales?", icon: "bi-file-earmark-text" },
        { label: "¿Dónde hago pagos virtuales?", icon: "bi-credit-card" },
        { label: "¿Qué información hay sobre admisión?", icon: "bi-person-badge" },
        { label: "/estado", icon: "bi-database-check" }
    ],
    docs: [
        { label: "/pdfs", icon: "bi-list-ul" },
        { label: "/todos", icon: "bi-collection" },
        { label: "Resoluciones", icon: "bi-file-text" },
        { label: "Reglamento General", icon: "bi-book" }
    ],
    academic: [
        { label: "/historial", icon: "bi-file-earmark-person" },
        { label: "/constancias", icon: "bi-file-earmark-check" },
        { label: "/cancelar", icon: "bi-x-circle" }
    ]
};

const chatHistories = {
    web: [
        { text: "¡Hola! 👋 Estás en la sección <b>Portal Web</b>.<br><br>Consulta información indexada de las páginas públicas de la UNAMBA: trámites, servicios, admisión, costos, horarios, contactos y noticias. Las respuestas incluyen fuentes cuando hay evidencia disponible.<br><br>Cada consulta es independiente: incluye en tu pregunta los datos necesarios. Usa <b>/estado</b> para comprobar la disponibilidad del servicio.", type: "unamba-msg-bot" }
    ],
    docs: [
        { text: "¡Hola! 📄 Estás en la sección <b>Normativas / PDF</b>.<br><br>Pregunta por el número de una resolución, por ejemplo: <i>¿Qué dice el artículo 1 de la Resolución 218-2026?</i><br><br>Comandos: <b>/pdfs</b>, <b>/pdf N</b>, <b>/todos</b>.", type: "unamba-msg-bot" }
    ],
    academic: [
        { text: "🎓 Estás en <b>Consultas universitarias</b>.<br><br>Escribe <b>/historial</b> para solicitar tu historial académico o <b>/constancias</b> para obtener tu constancia de matrícula. Por seguridad, tu DNI se ocultará y no se guardará en el chat.<span class=\"unamba-privacy-note\">Usa este servicio únicamente para consultar tu propia información académica.</span>", type: "unamba-msg-bot" }
    ]
};

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        const div = document.createElement('div');
        div.className = 'unamba-chip';
        div.onclick = () => quickQuery(item.label);
        div.innerHTML = `<i class="bi ${item.icon}"></i> ${item.label}`;
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

    container.scrollTop = container.scrollHeight;
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
