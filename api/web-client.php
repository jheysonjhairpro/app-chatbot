<?php
// Conexiones exclusivas del modo web. PDF y académico conservan config.php.
require_once __DIR__ . '/config.php';

//define('WEB_CHAT_BASE', rtrim(getenv('WEB_CHAT_BASE') ?: 'http://127.0.0.1:5000', '/'));
define('WEB_CHAT_BASE', rtrim(getenv('WEB_CHAT_BASE') ?: 'http://172.16.15.10:5000', '/'));
define('WEB_API_BASE', rtrim(getenv('WEB_API_BASE') ?: 'http://127.0.0.1:8002', '/'));

function web_json(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function web_get(string $base, string $path, array $query = [], bool $authenticated = false): array
{
    $url = $base . $path . ($query ? '?' . http_build_query($query) : '');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => $authenticated ? 130 : 30,
        CURLOPT_HTTPHEADER => $authenticated ? ['X-Token: ' . IA_TOKEN] : [],
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false) {
        web_json(['ok' => false, 'error' => 'No se pudo conectar con el servicio web. Revisa su dirección y que esté iniciado.'], 502);
    }
    $data = json_decode($body, true);
    if ($status < 200 || $status >= 300) {
        $message = is_array($data) ? ($data['error'] ?? $data['detail'] ?? null) : null;
        if (!is_string($message)) {
            $message = $status === 404
                ? 'La ruta web no está disponible en el servidor configurado.'
                : 'El servicio web no pudo completar la consulta.';
        }
        web_json(['ok' => false, 'error' => $message], $status >= 400 && $status <= 599 ? $status : 502);
    }
    if (!is_array($data)) {
        web_json(['ok' => false, 'error' => 'El servicio web devolvió una respuesta no válida.'], 502);
    }
    return $data;
}
