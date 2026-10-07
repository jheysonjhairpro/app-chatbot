<?php
declare(strict_types=1);

/*
 * Proxy de consulta del historial académico UNAMBA.
 * Requisitos: PHP 7.4+ y extensión cURL habilitada.
 * No registra ni conserva el código o el DNI.
 */

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function jsonError(int $status, string $message, array $extra = []): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['error' => $message], $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonErrorAndCleanup(string $cookieFile, int $status, string $message, array $extra = []): void
{
    if (is_file($cookieFile)) {
        @unlink($cookieFile);
    }
    jsonError($status, $message, $extra);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    jsonError(405, 'Método no permitido.');
}

if (!extension_loaded('curl')) {
    jsonError(500, 'El servidor no tiene habilitada la extensión cURL de PHP.');
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false || strlen($rawBody) > 2048) {
    jsonError(400, 'Solicitud inválida.');
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    jsonError(400, 'Solicitud inválida.');
}

$studentCode = strtoupper(trim((string)($payload['studentCode'] ?? '')));
$dni = trim((string)($payload['dni'] ?? ''));
$documentType = defined('ACADEMIC_DOCUMENT_TYPE')
    ? strtolower((string)ACADEMIC_DOCUMENT_TYPE)
    : 'historial';

if (!in_array($documentType, ['historial', 'constancia'], true)) {
    jsonError(422, 'El tipo de documento solicitado no es válido.');
}

if (!preg_match('/^[A-Z0-9]{6}$/', $studentCode)) {
    jsonError(422, 'El código de estudiante debe tener 6 letras o números.');
}

if (!preg_match('/^\d{8}$/', $dni)) {
    jsonError(422, 'El DNI debe tener exactamente 8 dígitos.');
}

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Strict',
    'use_strict_mode' => true,
]);

$now = time();
$attempts = $_SESSION['unamba_history_attempts'] ?? [];
$attempts = array_values(array_filter($attempts, static function ($timestamp) use ($now) {
    return is_int($timestamp) && $timestamp > $now - 60;
}));

if (count($attempts) >= 5) {
    jsonError(429, 'Has realizado demasiadas consultas. Espera un minuto e inténtalo otra vez.');
}

$attempts[] = $now;
$_SESSION['unamba_history_attempts'] = $attempts;
session_write_close();

$baseUrl = 'http://sisacademico.unamba.edu.pe:8080';
$reportConfig = $documentType === 'constancia'
    ? [
        'linker' => 'r_constancias',
        'type' => 'r_constancias',
        'subtype' => 'constanciamatricula',
        'label' => 'constancia de matrícula',
        'filename' => 'Constancia_Matricula_',
    ]
    : [
        'linker' => 'r_historial',
        'type' => 'r_historial',
        'subtype' => null,
        'label' => 'historial académico',
        'filename' => 'Historial_Academico_',
    ];
$historyUrl = $baseUrl . '/matricula/sLinker?ln=' . $reportConfig['linker'];
$reportUrl = $baseUrl . '/matricula/sRepEstudiante';
$cookieFile = tempnam(sys_get_temp_dir(), 'unamba_history_');

if ($cookieFile === false) {
    jsonError(500, 'No se pudo iniciar una sesión temporal con el sistema académico.');
}

function academicRequest(string $url, ?array $formData, string $cookieFile, string $referer, bool $browserNavigation = false): array
{
    $handle = curl_init($url);
    if ($handle === false) {
        throw new RuntimeException('No se pudo iniciar la conexión.');
    }

    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 35,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_ENCODING => '',
        CURLOPT_HTTPHEADER => $browserNavigation
            ? [
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7',
                'Accept-Language: es-419,es;q=0.9',
                'Cache-Control: max-age=0',
                'Origin: http://sisacademico.unamba.edu.pe:8080',
                'Sec-Fetch-Dest: document',
                'Sec-Fetch-Mode: navigate',
                'Sec-Fetch-Site: same-origin',
                'Upgrade-Insecure-Requests: 1',
            ]
            : ['Accept: */*'],
        CURLOPT_REFERER => $referer,
    ];

    if ($formData !== null) {
        $options[CURLOPT_POST] = true;
        $queryEncoding = $browserNavigation ? PHP_QUERY_RFC1738 : PHP_QUERY_RFC3986;
        $options[CURLOPT_POSTFIELDS] = http_build_query($formData, '', '&', $queryEncoding);
        $options[CURLOPT_HTTPHEADER][] = 'Content-Type: application/x-www-form-urlencoded';
        $options[CURLOPT_HTTPHEADER][] = 'Expect:';
    }

    curl_setopt_array($handle, $options);
    $body = curl_exec($handle);

    if ($body === false) {
        $error = curl_error($handle);
        curl_close($handle);
        throw new RuntimeException('El sistema académico no respondió: ' . $error);
    }

    $result = [
        'status' => (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE),
        'contentType' => strtolower((string)curl_getinfo($handle, CURLINFO_CONTENT_TYPE)),
        'effectiveUrl' => (string)curl_getinfo($handle, CURLINFO_EFFECTIVE_URL),
        'body' => $body,
    ];
    curl_close($handle);

    if ($result['status'] < 200 || $result['status'] >= 300) {
        throw new RuntimeException('El sistema académico devolvió un error temporal.');
    }

    return $result;
}

function pageAlert(string $html): ?string
{
    // El sistema heredado responde como ISO-8859-1. No se usa el modificador
    // Unicode porque invalidaría toda la búsqueda al encontrar bytes no UTF-8.
    if (preg_match('/alert\s*\(\s*[\'\"]([^\'\"]+)[\'\"]\s*\)/i', $html, $match)) {
        return trim(html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }
    return null;
}

function isPdf(array $response): bool
{
    return strpos($response['contentType'], 'application/pdf') !== false
        || strncmp($response['body'], '%PDF-', 5) === 0;
}

function extractStudentFormFields(string $html): array
{
    $formHtml = $html;
    if (preg_match('/<form\b[^>]*name\s*=\s*(?:[\'\"]festudiante[\'\"]|festudiante\b)[^>]*>.*?<\/form>/is', $html, $formMatch)) {
        $formHtml = $formMatch[0];
    }

    preg_match_all('/<input\b[^>]*>/i', $formHtml, $inputMatches);
    $fields = [];

    foreach ($inputMatches[0] as $inputTag) {
        if (!preg_match('/\bname\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $inputTag, $nameMatch)) {
            continue;
        }

        $name = implode('', array_slice($nameMatch, 1));

        $value = '';
        if (preg_match('/\bvalue\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $inputTag, $valueMatch)) {
            $rawValue = implode('', array_slice($valueMatch, 1));
            $value = html_entity_decode($rawValue, ENT_QUOTES | ENT_HTML5, 'ISO-8859-1');
        }

        $fields[$name] = $value;
    }

    return $fields;
}

function looksLikeAcademicHistory(string $html): bool
{
    $plainText = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $normalized = strtoupper(preg_replace('/\s+/u', ' ', $plainText) ?? $plainText);
    $academicTerms = [
        'ASIGNATURA', 'CURSO', 'SEMESTRE', 'PERIODO', 'CICLO',
        'CREDITO', 'NOTA', 'CALIFICACION', 'PROMEDIO', 'PLAN DE ESTUDIO'
    ];
    $matches = 0;

    foreach ($academicTerms as $term) {
        if (strpos($normalized, $term) !== false) {
            $matches++;
        }
    }

    return strpos($normalized, 'HISTORIAL') !== false
        && $matches >= 2
        && stripos($html, '<table') !== false;
}

function absoluteAcademicUrl(string $candidate, string $baseUrl): ?string
{
    $candidate = html_entity_decode(trim($candidate), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if ($candidate === '') {
        return null;
    }

    if (strpos($candidate, '//') === 0) {
        $candidate = (string)(parse_url($baseUrl, PHP_URL_SCHEME) ?: 'https') . ':' . $candidate;
    } elseif ($candidate[0] === '/') {
        $candidate = $baseUrl . $candidate;
    } elseif (!preg_match('#^https?://#i', $candidate)) {
        $candidate = $baseUrl . '/matricula/' . ltrim($candidate, '/');
    }

    $parts = parse_url($candidate);
    $baseParts = parse_url($baseUrl);
    $expectedScheme = strtolower((string)($baseParts['scheme'] ?? ''));
    $expectedPort = (int)($baseParts['port'] ?? ($expectedScheme === 'https' ? 443 : 80));
    if (!is_array($parts)
        || !is_array($baseParts)
        || strtolower((string)($parts['scheme'] ?? '')) !== $expectedScheme
        || strtolower((string)($parts['host'] ?? '')) !== strtolower((string)($baseParts['host'] ?? ''))
        || (int)($parts['port'] ?? ($expectedScheme === 'https' ? 443 : 80)) !== $expectedPort) {
        return null;
    }

    return $candidate;
}

try {
    // La visita inicial crea la cookie de sesión. El servlet permite buscar al
    // estudiante directamente después, tal como lo hace el bot de Telegram.
    $landingResponse = academicRequest($historyUrl, null, $cookieFile, $baseUrl . '/matricula/');
    if ($documentType === 'constancia'
        && stripos($landingResponse['body'], 'name="idestudiante"') === false
        && stripos($landingResponse['body'], "name='idestudiante'") === false) {
        // En sesiones nuevas, el primer acceso puede mostrar la portada aunque
        // la URL sea r_constancias. Un segundo acceso abre el formulario real.
        academicRequest($historyUrl, null, $cookieFile, $landingResponse['effectiveUrl']);
    }
    $searchForm = [
        'accion' => 'buscarEstudiante',
        'tipoReporte' => $reportConfig['type'],
        'subtipoReporte' => '',
        'idestudiante' => $studentCode,
        'recibo' => $dni,
    ];

    $searchResponse = academicRequest($reportUrl, $searchForm, $cookieFile, $historyUrl);
    if (stripos($searchResponse['body'], 'DATOS DEL ESTUDIANTE') === false) {
        jsonErrorAndCleanup($cookieFile, 401, 'No se encontró ningún estudiante con ese código y DNI. Verifica los datos.');
    }

    if ($documentType === 'constancia') {
        // La primera búsqueda identifica la sección en sesiones cURL nuevas.
        // La segunda reproduce el formulario oficial y completa semestre/escuela.
        $officialSearchForm = $searchForm;
        $officialSearchForm['tipoReporte'] = '';
        $officialSearchResponse = academicRequest($reportUrl, $officialSearchForm, $cookieFile, $reportUrl);
        if (stripos($officialSearchResponse['body'], 'DATOS DEL ESTUDIANTE') !== false) {
            $searchResponse = $officialSearchResponse;
        }
    }

    $reportSubtype = $reportConfig['subtype'];
    if ($reportSubtype === null
        && preg_match('/mostrarReporte\s*\(\s*[\'\"]([^\'\"]+)[\'\"]\s*\)/i', $searchResponse['body'], $reportMatch)) {
        $reportSubtype = $reportMatch[1];
    }

    if ($reportSubtype === null) {
        if (stripos($searchResponse['body'], 'DATOS DEL ESTUDIANTE') !== false) {
            jsonErrorAndCleanup($cookieFile, 502, 'El estudiante fue encontrado, pero no se pudo identificar el enlace del documento.');
        }
        if (stripos($searchResponse['body'], 'name="idestudiante"') !== false
            || stripos($searchResponse['body'], "name='idestudiante'") !== false) {
            jsonErrorAndCleanup($cookieFile, 401, 'El sistema académico devolvió nuevamente el formulario sin validar la consulta.');
        }
        if (stripos($searchResponse['body'], 'CALENDARIO DEL SEMESTRE') !== false) {
            jsonErrorAndCleanup($cookieFile, 502, 'El sistema académico perdió la sesión y regresó a la portada.');
        }
        if (stripos($searchResponse['body'], 'cloudflare') !== false
            || stripos($searchResponse['body'], 'cf-chl-') !== false) {
            jsonErrorAndCleanup($cookieFile, 502, 'El sistema académico bloqueó la consulta automática.');
        }
        $responsePath = (string)(parse_url($searchResponse['effectiveUrl'], PHP_URL_PATH) ?: 'desconocida');
        $safeContentType = preg_replace('/[^a-z0-9;=._+\/-]/i', '', $searchResponse['contentType']) ?: 'desconocido';
        jsonErrorAndCleanup(
            $cookieFile,
            502,
            sprintf(
                'Respuesta académica inesperada (HTTP %d, %s, %d bytes, ruta %s).',
                $searchResponse['status'],
                $safeContentType,
                strlen($searchResponse['body']),
                $responsePath
            )
        );
    }

    // El segundo POST debe reenviar todos los campos generados por el servlet
    // (código, nombres, escuela, semestre, etc.), no solo los cinco iniciales.
    $reportForm = extractStudentFormFields($searchResponse['body']);
    if ($documentType === 'constancia') {
        // Replica exactamente el envío del botón oficial: su onclick vuelve a
        // fijar buscarEstudiante y mostrarReporte() solo agrega el subtipo.
        $reportForm['accion'] = 'buscarEstudiante';
        $reportForm['tipoReporte'] = $reportConfig['type'];
        $reportForm['subtipoReporte'] = $reportSubtype;
        $reportForm['idestudiante'] = '';
        $reportForm['recibo'] = '';
        $reportForm['idescuela'] = '';
    } else {
        // El historial conserva la secuencia que usa el bot de Telegram.
        $reportForm['accion'] = 'buscarEstudiante';
        $reportForm['tipoReporte'] = $reportConfig['type'];
        $reportForm['subtipoReporte'] = $reportSubtype;
        $reportForm['idestudiante'] = $studentCode;
        $reportForm['recibo'] = $dni;
    }

    $pdfResponse = academicRequest(
        $reportUrl,
        $reportForm,
        $cookieFile,
        $reportUrl,
        $documentType === 'constancia'
    );

    if (!isPdf($pdfResponse)) {
        // Algunas versiones del sistema devuelven una página que enlaza al PDF.
        if (preg_match('/(?:href|src)\s*=\s*[\'\"]([^\'\"]+\.pdf(?:\?[^\'\"]*)?)[\'\"]/i', $pdfResponse['body'], $pdfLink)) {
            $resolvedPdfUrl = absoluteAcademicUrl($pdfLink[1], $baseUrl);
            if ($resolvedPdfUrl !== null) {
                $pdfResponse = academicRequest($resolvedPdfUrl, null, $cookieFile, $reportUrl);
            }
        }
    }

    if (!isPdf($pdfResponse)) {
        if ($documentType === 'constancia') {
            jsonErrorAndCleanup($cookieFile, 502, 'El sistema académico no devolvió la constancia de matrícula en PDF. Verifica que el estudiante esté matriculado.');
        }

        if (!looksLikeAcademicHistory($pdfResponse['body'])) {
            jsonErrorAndCleanup($cookieFile, 502, 'El sistema académico no devolvió un historial reconocible. Inténtalo más tarde.');
        }

        $historyHtml = $pdfResponse['body'];
        if (preg_match('//u', $historyHtml) !== 1 && function_exists('iconv')) {
            $converted = iconv('Windows-1252', 'UTF-8//IGNORE', $historyHtml);
            if ($converted !== false) {
                $historyHtml = $converted;
            }
        }

        if (strlen($historyHtml) > 4 * 1024 * 1024) {
            jsonErrorAndCleanup($cookieFile, 502, 'El historial recibido supera el tamaño permitido.');
        }

        header('Content-Type: text/html; charset=utf-8');
        header('X-Academic-Format: html');
        header('Content-Length: ' . strlen($historyHtml));
        if (is_file($cookieFile)) {
            @unlink($cookieFile);
        }
        echo $historyHtml;
        exit;
    }

    if (strlen($pdfResponse['body']) > 15 * 1024 * 1024) {
        jsonErrorAndCleanup($cookieFile, 502, 'El archivo recibido supera el tamaño permitido.');
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $reportConfig['filename'] . $studentCode . '.pdf"');
    header('Content-Length: ' . strlen($pdfResponse['body']));
    echo $pdfResponse['body'];
} catch (Throwable $error) {
    jsonErrorAndCleanup($cookieFile, 502, 'No se pudo conectar con el sistema académico. Inténtalo nuevamente en unos minutos.');
} finally {
    if (is_file($cookieFile)) {
        @unlink($cookieFile);
    }
}
