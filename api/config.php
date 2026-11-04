<?php
declare(strict_types=1);

// Apache lee el .env del servidor; el navegador nunca recibe sus credenciales.
function configuracion_local_ia(): array
{
    $file = getenv('UNAMBA_ENV_FILE') ?: '';
    $link = __DIR__ . '/servidor.local.php';
    if ($file === '' && is_file($link)) {
        $configured = require $link;
        if (is_string($configured)) { $file = $configured; }
    }
    $values = [];
    if ($file !== '' && is_readable($file)) {
        foreach (file($file, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
            $line = trim($line, "\xEF\xBB\xBF \t\n\r\0\x0B");
            if (!preg_match('/^(?:export\s+)?(UNAMBA_TOKEN|UNAMBA_PORT)\s*=\s*(.*)$/', $line, $match)) { continue; }
            $value = trim($match[2]);
            if (str_starts_with($value, '"')) {
                // El .env generado usa cadenas JSON entre comillas dobles.
                $decoded = json_decode($value, true);
                if (!is_string($decoded)) { continue; }
                $value = $decoded;
            } elseif (strlen($value) >= 2 && $value[0] === "'" && substr($value, -1) === "'") {
                $value = str_replace(["\\'", "\\\\"], ["'", "\\"], substr($value, 1, -1));
            } else {
                $value = preg_replace('/\s+#.*$/', '', $value);
            }
            $values[$match[1]] = $value;
        }
    }
    $port = getenv('UNAMBA_PORT') ?: ($values['UNAMBA_PORT'] ?? '5000');
    if (!ctype_digit((string)$port) || (int)$port < 1 || (int)$port > 65535) { $port = '5000'; }
    return [
        'base' => rtrim(getenv('IA_BASE') ?: 'http://172.16.15.10:' . $port, '/'),
        'token' => getenv('IA_TOKEN') ?: (getenv('UNAMBA_TOKEN') ?: ($values['UNAMBA_TOKEN'] ?? '')),
    ];
}

$ia = configuracion_local_ia();
define('IA_BASE', $ia['base']);
define('IA_TOKEN', $ia['token']);
unset($ia);

function puente_ia(string $ruta): void
{
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Accel-Buffering: no');
    header('X-Content-Type-Options: nosniff');
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST');
        http_response_code(405);
        echo 'Utiliza POST para consultar el chatbot.';
        return;
    }
    $in = json_decode(file_get_contents('php://input'), true);
    if (!is_array($in) || !is_string($in['message'] ?? null) || !is_string($in['session'] ?? '')) {
        http_response_code(400);
        echo 'Envía una pregunta y una sesión válidas.';
        return;
    }
    $message = trim(function_exists('mb_substr') ? mb_substr($in['message'], 0, 1000) : substr($in['message'], 0, 1000));
    if ($message === '') {
        http_response_code(400);
        echo 'Escribe una pregunta.';
        return;
    }
    if (!extension_loaded('curl') || !extension_loaded('mbstring')) {
        http_response_code(503);
        echo 'El servidor PHP necesita las extensiones cURL y mbstring.';
        return;
    }
    if (IA_TOKEN === '') {
        http_response_code(503);
        echo 'Falta enlazar la vista con el servidor. Revisa UNAMBA_UI_DIR en el .env y ejecuta iniciar.bat.';
        return;
    }
    set_time_limit(0);
    ini_set('zlib.output_compression', '0');
    while (ob_get_level() > 0) { ob_end_clean(); }
    ob_implicit_flush(true);
    $payload = json_encode(['message' => $message, 'session' => substr($in['session'] ?? '', 0, 64)], JSON_UNESCAPED_UNICODE);
    $started = false;
    $ch = curl_init(IA_BASE . $ruta);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Token: ' . IA_TOKEN],
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 600,
        CURLOPT_BUFFERSIZE => 1024,
        CURLOPT_WRITEFUNCTION => function ($curl, $data) use (&$started) {
            if (connection_aborted()) { return 0; }
            if (!$started) {
                $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
                if ($status >= 400) { http_response_code($status); }
                $started = true;
            }
            echo $data;
            flush();
            return strlen($data);
        },
    ]);
    $ok = curl_exec($ch);
    if ($ok === false && !connection_aborted()) {
        if (!$started) {
            http_response_code(502);
            echo 'No se pudo conectar con el servidor local de IA. Inicia el servidor y Ollama.';
        } else {
            echo "\n\nLa conexión se interrumpió antes de terminar la respuesta. Puedes volver a consultar.";
        }
    }
    curl_close($ch);
}
