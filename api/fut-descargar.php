<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

$token = $_GET['token'] ?? '';
if ($_SERVER['REQUEST_METHOD'] !== 'GET' || !is_string($token) || !preg_match('/^[A-Za-z0-9_-]{30,80}$/', $token)) {
    http_response_code(400);
    exit('Descarga no válida.');
}
if (IA_TOKEN === '' || !extension_loaded('curl')) {
    http_response_code(503);
    exit('El puente FUT no está configurado.');
}
$ch = curl_init(IA_BASE . '/fut/download/' . $token);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['X-Token: ' . IA_TOKEN],
    CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 60,
]);
$body = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
if ($body === false || $status !== 200) {
    http_response_code($status === 404 ? 404 : 502);
    exit('El FUT ya no está disponible. Genera uno nuevo.');
}
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="FUT-UNAMBA.pdf"');
header('Content-Length: ' . strlen($body));
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo $body;
