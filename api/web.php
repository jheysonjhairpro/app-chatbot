<?php
require __DIR__ . '/web-client.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'health') {
    web_json(web_get(WEB_CHAT_BASE, '/salud/web', [], true));
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST, GET');
    web_json(['error' => 'Método no permitido.'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !isset($input['message']) || !is_string($input['message'])) {
    web_json(['error' => 'Envía una pregunta de texto.'], 400);
}
$question = trim($input['message']);
if (mb_strlen($question, 'UTF-8') < 2 || mb_strlen($question, 'UTF-8') > 2000) {
    web_json(['error' => 'La pregunta debe tener entre 2 y 2000 caracteres.'], 400);
}
$payload = json_encode([
    'message' => $question,
    'session' => is_string($input['session'] ?? null) ? substr($input['session'], 0, 64) : '',
], JSON_UNESCAPED_UNICODE);

set_time_limit(0);
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no');
@ini_set('zlib.output_compression', '0');
while (ob_get_level()) { ob_end_clean(); }
ob_implicit_flush(true);

$started = false;
$ch = curl_init(WEB_CHAT_BASE . '/chat/web');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Token: ' . IA_TOKEN],
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => 0,
    CURLOPT_LOW_SPEED_LIMIT => 1,
    CURLOPT_LOW_SPEED_TIME => 180,
    CURLOPT_HEADERFUNCTION => static function ($curl, $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $match) && (int)$match[1] >= 200) {
            http_response_code((int)$match[1]);
        }
        return strlen($header);
    },
    CURLOPT_WRITEFUNCTION => static function ($curl, $data) use (&$started) {
        $started = true;
        echo $data;
        flush();
        return strlen($data);
    },
]);
$result = curl_exec($ch);
curl_close($ch);
if ($result === false) {
    if (!$started) { http_response_code(502); }
    echo "\nNo se pudo completar la conexión con el servicio web. Inténtalo nuevamente.";
}
