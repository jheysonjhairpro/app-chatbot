<?php
// ==========================================
define('IA_BASE', getenv('IA_BASE') ?: 'http://172.16.15.10:5000');
define('IA_TOKEN', getenv('IA_TOKEN') ?: 'unamba2026-Xk9Pq7Lm3Rt8Vw2Zc5'); // TOKEN
// ==========================================

function puente_ia(string $ruta): void
{
    set_time_limit(0);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no');
    while (ob_get_level()) { ob_end_clean(); }
    ob_implicit_flush(true);

    $in = json_decode(file_get_contents('php://input'), true) ?: [];
    $payload = json_encode([
        'message' => mb_substr((string)($in['message'] ?? ''), 0, 1000),
        'session' => substr((string)($in['session'] ?? ''), 0, 64),
    ]);

    $ch = curl_init(IA_BASE . $ruta);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Token: ' . IA_TOKEN],
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 0,
        CURLOPT_WRITEFUNCTION => function ($c, $data) { echo $data; flush(); return strlen($data); },
    ]);
    if (!curl_exec($ch)) {
        http_response_code(502);
        echo "No se pudo conectar con el servidor de IA.";
    }
    curl_close($ch);
}
