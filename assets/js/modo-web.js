/* Portal institucional: mismo puente PHP y sesión propia. */
const webSessionId = window.crypto?.randomUUID?.() || String(Date.now()) + Math.random();
function formatWebText(raw) {
    return formatRagText(raw, /^(Colección web:|Fragmentos indexados:)/);
}
MODES.web = { send: text => sendRagMessage('web', text, webSessionId, formatWebText) };
