<?php
declare(strict_types=1);

/*
 * Endpoint exclusivo para la constancia de matrícula.
 * Reutiliza el proxy académico y fuerza una configuración permitida,
 * independientemente de cualquier valor enviado por el navegador.
 */

define('ACADEMIC_DOCUMENT_TYPE', 'constancia');
require __DIR__ . '/historial.php';
