import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = Array.from({ length: 21 }, (_, i) => ({
    url: `https://example.org/pagina-${i + 1}`, titulo: i === 0 ? 'Biblioteca universitaria' : `Página oficial ${i + 1}`,
    portal: 'example.org', categorias: ['Servicios'], checked: '2026-10-13T10:00:00Z', publicacion: null,
    documentos: i === 0 ? 1 : 0, caracteres: 420, extracto: 'Información de prueba sobre servicios universitarios.', calidad: ['sin_fecha']
}));
const requests = [];
const fixture = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fixture');
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    requests.push(url);
    if (url.pathname === '/salud/web' || url.pathname === '/chat/web') {
        if (req.headers['x-token'] !== 'frontend-test-token') return json(403, { error: 'Token inválido' });
    }
    if (url.pathname === '/salud/web') return json(200, { ok: true, chroma: { fragmentos: 42 } });
    if (url.pathname === '/chat/web') {
        let body = ''; for await (const part of req) body += part;
        const data = JSON.parse(body);
        if (data.message === 'error') return json(503, { error: 'Servicio de prueba no disponible' });
        if (data.message.length > 1000) return json(200, { received: data.message.length });
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        const bytes = Buffer.from('La biblioteca ofrece préstamo y lectura.\n\nFuentes consultadas:\n- Biblioteca: https://example.org/pagina-1\n');
        res.write(bytes.subarray(0, 30));
        return setTimeout(() => res.end(bytes.subarray(30)), 30);
    }
    if (url.pathname === '/indice/resumen') return json(200, { paginas: 21, documentos: 1, categorias: ['Servicios'] });
    if (url.pathname === '/indice/portales') return json(200, ['example.org']);
    if (url.pathname === '/indice/paginas') {
        let items = pages.filter(p => (!url.searchParams.get('portal') || p.portal === url.searchParams.get('portal')) && (!url.searchParams.get('q') || p.titulo.toLowerCase().includes(url.searchParams.get('q').toLowerCase())));
        const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 20);
        return json(200, { items: items.slice(offset, offset + limit), total: items.length, offset, limit });
    }
    if (url.pathname === '/indice/pagina') {
        if (!pages.some(p => p.url === url.searchParams.get('url'))) return json(404, { detail: 'Página no encontrada' });
        return json(200, { pagina: { titulo: 'Biblioteca universitaria', blocks: [{ heading: 'Servicios', text: 'La biblioteca ofrece préstamo y lectura.' }, { heading: 'Horarios', text: 'Consulta la página oficial para conocer los horarios.' }] }, checked: '2026-10-13', documentos: [{ nombre: 'Guía de la biblioteca', url: 'https://example.org/guia.pdf' }] });
    }
    json(404, { detail: 'No encontrado' });
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const php = spawn(process.env.PHP_BINARY || 'C:/xampp/php/php.exe', ['-S', `127.0.0.1:${port}`, '-t', root], {
    cwd: root, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, IA_TOKEN: 'frontend-test-token', WEB_CHAT_BASE: fixtureUrl, WEB_API_BASE: fixtureUrl }
});
const base = `http://127.0.0.1:${port}`;
async function stop() {
    if (php.exitCode === null) {
        const exited = new Promise(resolve => php.once('exit', resolve));
        php.kill(); await exited;
    }
    fixture.closeAllConnections();
    await new Promise(resolve => fixture.close(resolve));
}
try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
        try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'PHP did not start');
    if (process.argv.includes('--serve')) {
        console.log(`FRONTEND_FIXTURE_URL=${base}`);
        await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
    } else {
        const post = (body) => fetch(base + '/api/web.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        assert.equal((await fetch(base + '/api/web.php?action=health').then(r => r.json())).ok, true);
        for (const body of [null, [], {}, { message: 3 }, { message: 'a' }, { message: 'a'.repeat(2001) }]) {
            assert.equal((await post(body)).status, 400);
        }
        assert.equal((await (await post({ message: 'a'.repeat(1500) })).json()).received, 1500, 'Do not truncate at 1000');
        const error = await post({ message: 'error' });
        assert.equal(error.status, 503);
        assert.match((await error.json()).error, /prueba/);
        const stream = await post({ message: '¿Qué ofrece la biblioteca?' });
        assert.equal(stream.status, 200);
        assert.match(await stream.text(), /préstamo.*lectura[\s\S]*Fuentes consultadas:/);
        const summary = await fetch(base + '/api/web-index.php?action=summary').then(r => r.json());
        assert.equal(summary.summary.paginas, 21);
        assert.deepEqual(summary.portals, ['example.org']);
        const list = await fetch(base + '/api/web-index.php?action=pages&offset=20&limit=20&portal=example.org').then(r => r.json());
        assert.equal(list.items.length, 1); assert.equal(list.total, 21);
        assert.equal((await fetch(base + '/api/web-index.php?action=page&url=missing')).status, 404);
        assert.equal((await fetch(base + '/api/web-index.php?action=invalid')).status, 400);
        const detail = await fetch(base + '/api/web-index.php?action=page&url=https%3A%2F%2Fexample.org%2Fpagina-1').then(r => r.json());
        assert.equal(detail.pagina.blocks.length, 2); assert.equal(detail.documentos.length, 1);
        assert.equal((await fetch(base + '/api/web-index.php?action=pages&q[]=bad')).status, 400);
        const context = vm.createContext({ window: { crypto: null }, console, URL, TextDecoder, AbortController, TypeError, setTimeout, clearTimeout,
            escapeHtml: s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
            ENDPOINTS: { web: base + '/api/web.php' }, MODES: {}, chatHistories: { web: [] }, currentMode: 'web', isWaitingResponse: false,
            loadingHtml: s => s, renderCurrentChat: () => {}, fetch });
        vm.runInContext(readFileSync(path.join(root, 'assets/js/modo-web.js'), 'utf8'), context);
        await vm.runInContext('handleWebMessage("/estado")', context);
        assert.match(context.chatHistories.web.at(-1).text, /42/);
        await vm.runInContext('handleWebMessage("consulta")', context);
        assert.match(context.chatHistories.web.at(-1).text, /préstamo/);
        assert.match(context.chatHistories.web.at(-1).text, /href="https:\/\/example.org\/pagina-1"/);
        await vm.runInContext('handleWebMessage("error")', context);
        assert.match(context.chatHistories.web.at(-1).text, /Servicio de prueba/);
        assert.equal(context.isWaitingResponse, false);
        const html = vm.runInContext('formatWebText(\'<script>alert(1)</script> [Guía](https://example.org/guia.pdf)\')', context);
        assert.ok(!html.includes('<script>')); assert.match(html, />Guía<\/a>/);
        console.log('OK: PHP chat/catalog bridges, validation, HTTP errors, UTF-8 streaming, pagination, detail, health and JS rendering.');
    }
} finally { await stop(); }
