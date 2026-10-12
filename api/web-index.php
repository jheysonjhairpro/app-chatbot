<?php
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function responder_json(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function conectar_chroma(): PDO
{
    if (!is_file(WEB_CHROMA_SQLITE)) {
        responder_json([
            'ok' => false,
            'error' => 'No se encontró la base ChromaDB.',
            'path' => WEB_CHROMA_SQLITE,
        ], 500);
    }

    $pdo = new PDO('sqlite:' . WEB_CHROMA_SQLITE, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA query_only = ON');
    return $pdo;
}

function base_chunks_sql(): string
{
    return "
        WITH chunks AS (
            SELECT
                e.id,
                MAX(CASE WHEN m.key = 'domain' THEN m.string_value END) AS domain,
                MAX(CASE WHEN m.key = 'url' THEN m.string_value END) AS url,
                MAX(CASE WHEN m.key = 'title' THEN m.string_value END) AS title,
                MAX(CASE WHEN m.key = 'page_hash' THEN m.string_value END) AS page_hash,
                MAX(CASE WHEN m.key = 'chunk' THEN m.int_value END) AS chunk,
                MAX(CASE WHEN m.key = 'chunks' THEN m.int_value END) AS chunks,
                MAX(CASE WHEN m.key = 'chroma:document' THEN m.string_value END) AS document
            FROM embeddings e
            JOIN segments s ON s.id = e.segment_id
            JOIN collections c ON c.id = s.collection
            LEFT JOIN embedding_metadata m ON m.id = e.id
            WHERE c.name = :collection
            GROUP BY e.id
        )
    ";
}

function resumen(PDO $pdo): void
{
    $sql = base_chunks_sql() . "
        SELECT
            COALESCE(domain, 'sin-dominio') AS domain,
            COUNT(DISTINCT url) AS pages,
            COUNT(*) AS chunks,
            COALESCE(SUM(LENGTH(document)), 0) AS chars
        FROM chunks
        WHERE url IS NOT NULL
        GROUP BY COALESCE(domain, 'sin-dominio')
        ORDER BY domain
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':collection' => WEB_CHROMA_COLLECTION]);
    $domains = $stmt->fetchAll();

    $totals = ['pages' => 0, 'chunks' => 0, 'chars' => 0, 'domains' => count($domains)];
    foreach ($domains as $row) {
        $totals['pages'] += (int)$row['pages'];
        $totals['chunks'] += (int)$row['chunks'];
        $totals['chars'] += (int)$row['chars'];
    }

    responder_json([
        'ok' => true,
        'collection' => WEB_CHROMA_COLLECTION,
        'database' => WEB_CHROMA_SQLITE,
        'totals' => $totals,
        'domains' => $domains,
    ]);
}

function paginas(PDO $pdo): void
{
    $domain = trim((string)($_GET['domain'] ?? ''));
    $search = trim((string)($_GET['q'] ?? ''));

    $where = ['url IS NOT NULL'];
    $params = [':collection' => WEB_CHROMA_COLLECTION];

    if ($domain !== '') {
        $where[] = 'domain = :domain';
        $params[':domain'] = $domain;
    }
    if ($search !== '') {
        $where[] = '(title LIKE :search OR url LIKE :search OR document LIKE :search)';
        $params[':search'] = '%' . $search . '%';
    }

    $sql = base_chunks_sql() . "
        SELECT
            COALESCE(domain, 'sin-dominio') AS domain,
            url,
            COALESCE(NULLIF(title, ''), url) AS title,
            COUNT(*) AS chunk_count,
            COALESCE(MAX(chunks), COUNT(*)) AS expected_chunks,
            COALESCE(SUM(LENGTH(document)), 0) AS chars,
            MIN(page_hash) AS page_hash,
            SUBSTR(REPLACE(REPLACE(GROUP_CONCAT(document, ' '), CHAR(10), ' '), CHAR(13), ' '), 1, 360) AS preview
        FROM chunks
        WHERE " . implode(' AND ', $where) . "
        GROUP BY domain, url, title
        ORDER BY domain, title, url
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    responder_json(['ok' => true, 'pages' => $stmt->fetchAll()]);
}

function detalle_pagina(PDO $pdo): void
{
    $url = trim((string)($_GET['url'] ?? ''));
    if ($url === '') {
        responder_json(['ok' => false, 'error' => 'Falta la URL de la página.'], 400);
    }

    $sql = base_chunks_sql() . "
        SELECT
            COALESCE(domain, 'sin-dominio') AS domain,
            url,
            COALESCE(NULLIF(title, ''), url) AS title,
            COALESCE(chunk, 0) AS chunk,
            COALESCE(chunks, 0) AS chunks,
            COALESCE(document, '') AS document,
            COALESCE(LENGTH(document), 0) AS chars,
            page_hash
        FROM chunks
        WHERE url = :url
        ORDER BY chunk
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':collection' => WEB_CHROMA_COLLECTION,
        ':url' => $url,
    ]);
    $chunks = $stmt->fetchAll();

    if (!$chunks) {
        responder_json(['ok' => false, 'error' => 'La URL no existe en el índice.'], 404);
    }

    $first = $chunks[0];
    responder_json([
        'ok' => true,
        'page' => [
            'domain' => $first['domain'],
            'url' => $first['url'],
            'title' => $first['title'],
            'page_hash' => $first['page_hash'],
            'chunk_count' => count($chunks),
            'chars' => array_sum(array_map(static fn($row) => (int)$row['chars'], $chunks)),
        ],
        'chunks' => $chunks,
    ]);
}

try {
    $pdo = conectar_chroma();
    $action = (string)($_GET['action'] ?? 'summary');

    if ($action === 'summary') {
        resumen($pdo);
    }
    if ($action === 'pages') {
        paginas($pdo);
    }
    if ($action === 'page') {
        detalle_pagina($pdo);
    }

    responder_json(['ok' => false, 'error' => 'Acción no reconocida.'], 400);
} catch (Throwable $exc) {
    responder_json(['ok' => false, 'error' => $exc->getMessage()], 500);
}
