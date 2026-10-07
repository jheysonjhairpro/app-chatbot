<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UNAMBA - Asistente Virtual</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="assets/chat.css?v=1">
    <script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js"></script>
</head>
<body style="background-color: #eef2f5; height: 100vh; margin: 0;">

<div id="unamba-chat-widget">
    <div class="unamba-bubble" onclick="toggleUnambaChat()">
        <i class="bi bi-mortarboard-fill"></i>
    </div>

    <div class="unamba-window" id="unambaWindow">
        <div class="unamba-header">
            <div class="unamba-header-info">
                <div class="unamba-avatar">
                    <img src="http://www.unamba.edu.pe/wp-content/uploads/2026/09/logo-unamba-1.png" alt="UNAMBA">
                </div>
                <div>
                    <p class="unamba-title">Asistente UNAMBA</p>
                    <p class="unamba-subtitle">IA Institucional</p>
                </div>
            </div>
            <i class="bi bi-x-lg unamba-close" onclick="toggleUnambaChat()"></i>
        </div>

        <div class="unamba-mode-container">
            <div class="unamba-mode-label">
                <i class="bi bi-layers-fill"></i> Fuente de consulta:
            </div>
            <div class="unamba-mode-selector">
                <button class="unamba-mode-btn active" id="btnModeWeb" onclick="setMode('web')">
                    <i class="bi bi-globe"></i> Portal Web
                </button>
                <button class="unamba-mode-btn" id="btnModeDocs" onclick="setMode('docs')">
                    <i class="bi bi-file-earmark-pdf"></i> Normativas / PDF
                </button>
                <button class="unamba-mode-btn" id="btnModeAcademic" onclick="setMode('academic')">
                    <i class="bi bi-person-vcard"></i> Consultas universitarias
                </button>
            </div>
        </div>

        <div class="unamba-messages" id="unambaMsgs"></div>

        <div class="unamba-carousel-wrapper">
            <button class="unamba-carousel-arrow" onclick="scrollChips(-120)"><i class="bi bi-chevron-left"></i></button>
            <div class="unamba-suggestions-scroll" id="chipContainer"></div>
            <button class="unamba-carousel-arrow" onclick="scrollChips(120)"><i class="bi bi-chevron-right"></i></button>
        </div>

        <div class="unamba-input-box">
            <input type="text" id="unambaInput" placeholder="Escribe tu consulta aquí..." onkeypress="if(event.key==='Enter') sendUnambaMsg()">
            <button id="unambaSendBtn" onclick="sendUnambaMsg()">
                <i class="bi bi-send-fill"></i>
            </button>
        </div>
    </div>
</div>

<script src="assets/js/chat-core.js?v=2"></script>
<script src="assets/js/modo-web.js?v=2"></script>
<script src="assets/js/modo-docs.js?v=1"></script>
<script src="assets/js/modo-academico.js?v=1"></script>

</body>
</html>
