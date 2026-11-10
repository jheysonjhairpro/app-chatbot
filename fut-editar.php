<?php
declare(strict_types=1);
$token = $_GET['token'] ?? '';
if (!is_string($token) || !preg_match('/^[A-Za-z0-9_-]{30,80}$/', $token)) {
    http_response_code(400);
    exit('Enlace de edición no válido.');
}
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; frame-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'");
?>
<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Editar FUT · UNAMBA</title>
    <link rel="stylesheet" href="assets/fut-editor.css?v=4">
</head>
<body data-token="<?= htmlspecialchars($token, ENT_QUOTES, 'UTF-8') ?>">
    <header class="editor-header">
        <div class="editor-brand"><img src="assets/img/logo-unamba.png" alt="Escudo UNAMBA"><span>UNAMBA <small>Formulario Único de Trámite</small></span></div>
        <div class="editor-header-actions"><span id="editorStatus" role="status">Preparando documento…</span><button id="savePdf" type="button" class="primary" disabled>Descargar PDF editado</button></div>
    </header>
    <main class="editor-layout">
        <section class="editor-fields" aria-labelledby="editorTitle">
            <div class="editor-intro"><p class="eyebrow">Edición del documento</p><h1 id="editorTitle">Revisa y corrige tu FUT</h1><p>Modifica los campos necesarios y aplica los cambios para ver el resultado. La edición se realiza en este navegador; revisa el PDF antes de firmarlo.</p></div>
            <form id="futEditorForm" autocomplete="off">
                <fieldset><legend>Pedido y destinatario</legend>
                    <label>Resumen del pedido<textarea name="resumen" rows="2" placeholder="Qué solicitas"></textarea></label>
                    <div class="field-grid"><label>Destinatario<input name="destinatario" type="text"></label><label>Cargo<input name="cargo" type="text"></label></div>
                </fieldset>
                <fieldset><legend>Datos del solicitante</legend>
                    <label>Nombres y apellidos<input name="nombre" type="text"></label>
                    <label>Escuela profesional<input name="escuela" type="text"></label>
                    <div class="field-grid"><label>Código de estudiante<input name="codigo" type="text"></label><label>DNI <small>Deja vacío para conservar el del PDF</small><input name="dni" type="text" inputmode="numeric" maxlength="8" placeholder="••••••••"></label></div>
                </fieldset>
                <fieldset><legend>Domicilio y contacto</legend>
                    <label>Dirección<input name="direccion" type="text"></label>
                    <p class="fixed-location">Ubicación del formulario: Abancay, provincia de Abancay, departamento de Apurímac.</p>
                    <div class="field-grid three"><label>Distrito<input name="distrito" type="text" value="Abancay" readonly></label><label>Provincia<input name="provincia" type="text" value="Abancay" readonly></label><label>Departamento<input name="departamento" type="text" value="Apurímac" readonly></label></div>
                    <div class="field-grid"><label>Celular<input name="celular" type="text"></label><label>Correo<input name="correo" type="email"></label></div>
                </fieldset>
                <fieldset><legend>Fundamentación y anexos</legend>
                    <label>Fundamentación<textarea name="fundamentacion" rows="5" placeholder="Explica el motivo con tus propias palabras"></textarea></label>
                    <label>Documentos adjuntos <small>Uno por línea; deja vacío si no hay</small><textarea name="adjuntos" rows="3"></textarea></label>
                    <label>Total de folios<input name="folios" type="text" inputmode="numeric" placeholder="Por completar"></label>
                </fieldset>
                <div class="editor-form-actions"><button id="applyChanges" type="submit" class="secondary">Aplicar cambios y ver PDF</button><span id="editorNotice" role="status"></span><span id="editorError" role="alert"></span></div>
            </form>
        </section>
        <section class="editor-preview" aria-labelledby="previewTitle"><div class="preview-title"><h2 id="previewTitle">Vista del documento</h2><span>Formato FUT original · una página</span></div><div id="pdfPreview" tabindex="0" role="region" aria-label="Vista previa del FUT"><p>Cargando el documento…</p></div></section>
    </main>
    <script src="assets/js/vendor/pdf-lib.min.js?v=1.17.1"></script>
    <script src="assets/js/fut-editor.js?v=5"></script>
</body>
</html>
