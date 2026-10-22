<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$available = false;
if (extension_loaded('curl')) {
    $curl = curl_init(IA_BASE . '/salud');
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 3]);
    $response = curl_exec($curl);
    $available = curl_getinfo($curl, CURLINFO_RESPONSE_CODE) === 200 && !empty(json_decode($response ?: '{}', true)['ok']);
    curl_close($curl);
}
echo json_encode(['vista' => 'unamba-chatbot', 'servidor' => IA_BASE, 'servidor_disponible' => $available]);
