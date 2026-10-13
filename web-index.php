<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UNAMBA - Auditor de índice web</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="assets/web-index.css?v=4">
</head>
<body>
    <header class="audit-header">
        <div>
            <p class="audit-kicker">Portal Web UNAMBA</p>
            <h1>Auditor de páginas indexadas</h1>
        </div>
        <a class="audit-back" href="index.php">
            <i class="bi bi-chat-dots"></i>
            Volver al chat
        </a>
    </header>

    <main class="audit-shell">
        <section class="audit-panel audit-domains">
            <div class="audit-panel-title">
                <div>
                    <span>Portales</span>
                    <strong id="domainCount">0</strong>
                </div>
                <button id="refreshBtn" title="Actualizar datos" aria-label="Actualizar datos">
                    <i class="bi bi-arrow-clockwise"></i>
                </button>
            </div>
            <div class="audit-stats">
                <div><span>Páginas</span><b id="totalPages">0</b></div>
                <div><span>Enlaces documentales</span><b id="totalDocuments">0</b></div>
            </div>
            <div id="domainList" class="domain-list"></div>
        </section>

        <section class="audit-panel audit-pages">
            <div class="audit-search">
                <i class="bi bi-search"></i>
                <input id="searchInput" type="search" aria-label="Buscar páginas" placeholder="Buscar páginas...">
            </div>
            <div class="audit-current-filter" id="currentFilter">Todas las páginas indexadas</div>
            <div id="pageList" class="page-list"></div>
            <nav class="audit-pagination" aria-label="Páginas del catálogo">
                <button id="previousPage" aria-label="Página anterior" disabled>Anterior</button>
                <span id="paginationStatus" role="status">0 resultados</span>
                <button id="nextPage" aria-label="Página siguiente" disabled>Siguiente</button>
            </nav>
        </section>

        <section class="audit-panel audit-detail">
            <div id="emptyDetail" class="empty-detail">
                <i class="bi bi-window-sidebar"></i>
                <p>Selecciona una página para ver el contenido indexado.</p>
            </div>
            <article id="pageDetail" class="page-detail" hidden>
                <div class="detail-head">
                    <p id="detailDomain"></p>
                    <h2 id="detailTitle"></h2>
                    <a id="detailUrl" href="#" target="_blank" rel="noopener noreferrer"></a>
                </div>
                <div class="detail-metrics">
                    <span><i class="bi bi-file-text"></i> <b id="detailChunks">0</b> bloques de texto</span>
                    <span><i class="bi bi-fonts"></i> <b id="detailChars">0</b> caracteres</span>
                </div>
                <div class="detail-toolbar">
                    <div class="view-modes" role="group" aria-label="Vista del contenido">
                        <button id="readingView" aria-pressed="true"><i class="bi bi-text-paragraph"></i> Lectura</button>
                        <button id="rawView" aria-pressed="false"><i class="bi bi-code-slash"></i> Original</button>
                    </div>
                </div>
                <div id="chunkList" class="chunk-list"></div>
            </article>
        </section>
    </main>

    <script src="assets/js/web-index-viewer.js?v=3"></script>
</body>
</html>
