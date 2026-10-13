<?php
// El catálogo se consulta por HTTP; no depende del esquema interno de Chroma.
require __DIR__ . '/web-client.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    web_json(['ok' => false, 'error' => 'Método no permitido.'], 405);
}
$action = $_GET['action'] ?? 'summary';
if ($action === 'summary') {
    $summary = web_get(WEB_API_BASE, '/indice/resumen');
    $portals = web_get(WEB_API_BASE, '/indice/portales');
    web_json(['ok' => true, 'summary' => $summary, 'portals' => $portals]);
}
if ($action === 'pages') {
    $query = [];
    foreach (['q', 'portal', 'offset', 'limit'] as $key) {
        if (isset($_GET[$key])) {
            if (!is_string($_GET[$key])) {
                web_json(['ok' => false, 'error' => 'Filtro no válido.'], 400);
            }
            $query[$key] = $_GET[$key];
        }
    }
    web_json(['ok' => true] + web_get(WEB_API_BASE, '/indice/paginas', $query));
}
if ($action === 'page') {
    $url = $_GET['url'] ?? '';
    if (!is_string($url) || trim($url) === '' || strlen($url) > 8192) {
        web_json(['ok' => false, 'error' => 'Indica la URL de la página.'], 400);
    }
    web_json(['ok' => true] + web_get(WEB_API_BASE, '/indice/pagina', ['url' => $url]));
}
web_json(['ok' => false, 'error' => 'Acción no reconocida.'], 400);
