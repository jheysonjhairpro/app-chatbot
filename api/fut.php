<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Utiliza POST.']);
    exit;
}
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !is_string($input['message'] ?? null) || !is_string($input['session'] ?? null)) {
    http_response_code(400);
    echo json_encode(['error' => 'Mensaje o sesión no válidos.']);
    exit;
}
if (IA_TOKEN === '' || !extension_loaded('curl') || !extension_loaded('mbstring')) {
    http_response_code(503);
    echo json_encode(['error' => 'Falta configurar el puente PHP o cURL.']);
    exit;
}
$payload = json_encode([
    'message' => mb_substr(trim($input['message']), 0, 1000),
    'session' => substr($input['session'], 0, 64),
], JSON_UNESCAPED_UNICODE);
$ch = curl_init(IA_BASE . '/fut/chat');
curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Token: ' . IA_TOKEN],
    CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 180,
]);
$response = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
if ($response === false || $status === 0) {
    http_response_code(502);
    echo json_encode(['error' => 'No se pudo conectar con el servidor FUT.']);
    exit;
}
if ($status === 404) {
    http_response_code(503);
    echo json_encode(['error' => 'La API conectada todavía no tiene el módulo FUT. Actualiza y reinicia el servidor Python.'], JSON_UNESCAPED_UNICODE);
    exit;
}
if (json_decode($response, true) === null) {
    http_response_code(502);
    echo json_encode(['error' => 'El servidor FUT devolvió una respuesta no válida.'], JSON_UNESCAPED_UNICODE);
    exit;
}
http_response_code($status);
echo $response;
