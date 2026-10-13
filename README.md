# Asistente UNAMBA — Frontend PHP

Interfaz del chat y puente PHP hacia el backend. Conserva los modos Portal Web,
Normativas/PDF y Consultas universitarias y su estructura de JavaScript por modo.

## Ejecución

Con Apache de XAMPP activo, abre `http://localhost/VISTA/app-chatbot/`.
PHP necesita cURL y mbstring. El frontend no ejecuta Ollama ni abre bases de datos
para el modo web: consulta los servicios HTTP del backend.

## Conexión del modo web

Configura las variables de entorno de PHP/Apache, o ajusta los valores por defecto
en `api/web-client.php` al desplegar:

| Variable | Uso | Valor por defecto |
|---|---|---|
| `WEB_CHAT_BASE` | Servidor Flask con `/chat/web` y `/salud/web` | Hereda `IA_BASE` de `api/config.php` |
| `WEB_API_BASE` | API FastAPI con `/indice/*` para el visor | `http://127.0.0.1:8002` |
| `IA_TOKEN` | Token de acceso a Flask; permanece en PHP | Configuración existente de `api/config.php` |

`IA_BASE` conserva su configuración anterior para los otros modos. Cambiar
`WEB_CHAT_BASE` permite conectar el chat web a otro servidor sin cambiar el PDF.
No pongas el token en JavaScript. No se carga automáticamente un archivo `.env`:
las variables deben estar disponibles para el proceso de PHP/Apache.

Ejemplo para un entorno donde ambos servicios son accesibles desde PHP:

```apache
SetEnv WEB_CHAT_BASE "http://DIRECCION_DEL_SERVIDOR:5000"
SetEnv WEB_API_BASE "http://DIRECCION_ACCESIBLE_API_WEB:8002"
```

Sustituye esas direcciones por las reales en la configuración del sitio Apache y
reinicia Apache si cambias su entorno. `127.0.0.1` se refiere al equipo que ejecuta
PHP, no al navegador. Si el backend está en otra máquina y FastAPI solo escucha
en loopback, el visor necesita una dirección accesible mediante la infraestructura
existente (por ejemplo un proxy o túnel); cambiar solamente la IP no lo hace accesible.
Esta adaptación no cambia la escucha, el firewall ni el código del backend.

La conexión real queda pendiente de configurar esas direcciones. El servidor
anterior configurado respondió a `/salud`, pero no ofreció `/salud/web` durante
la revisión. Eso no valida que sea la versión integrada actual.

## Archivos

- `index.php`: widget y selección de modos.
- `assets/js/chat-core.js`: interfaz e historiales visibles por modo.
- `assets/js/modo-web.js`: respuestas progresivas, enlaces y comando `/estado`.
- `api/web.php`: valida preguntas de 2 a 2000 caracteres, envía el token a Flask y
  conserva los códigos HTTP y el streaming. `?action=health` consulta `/salud/web`.
- `api/web-client.php`: conexión exclusiva del modo web y consultas JSON del visor.
- `web-index.php`, `assets/js/web-index-viewer.js`, `assets/web-index.css`: visor
  con portales, búsqueda, paginación, bloques de texto y enlaces documentales.
- `api/web-index.php`: consulta `/indice/resumen`, `/indice/portales`,
  `/indice/paginas` y `/indice/pagina`. No lee tablas internas de Chroma.
- `api/config.php`, `api/docs.php`, `api/ssaa/`, `modo-docs.js` y
  `modo-academico.js`: mantienen su implementación anterior.

Cada consulta web es independiente aunque el widget muestre el historial.
`/estado` comprueba el servicio y no se envía como pregunta al modelo. Los documentos
mostrados en el visor son enlaces: su contenido no fue leído por el motor web.
El visor muestra bloques del catálogo, no el número de fragmentos vectoriales.
Las antiguas opciones `WEB_CHROMA_SQLITE` y `WEB_CHROMA_COLLECTION` de la
configuración compartida ya no intervienen en el visor.

## Pruebas

Con Node.js y PHP de XAMPP disponibles:

```powershell
node tests/web-integration.mjs
```

Para otra instalación de PHP, define `PHP_BINARY` con la ruta al ejecutable.
La prueba inicia temporalmente PHP y un servicio simulado en puertos locales libres,
verifica validación, errores HTTP, streaming UTF-8, preguntas largas, estado,
paginación, detalle y formato seguro de enlaces, y cierra ambos procesos.
No usa ni modifica el backend real. Para comprobar visualmente con datos ficticios:

```powershell
node tests/web-integration.mjs --serve
```

Abre la URL que imprime y detén con Ctrl+C al terminar. Los resultados de esta
prueba no certifican la conectividad con el servidor de producción.
