# Vista del chatbot UNAMBA en XAMPP

Interfaz PHP del asistente institucional. Ofrece consultas del portal, documentos PDF y servicios académicos en una misma ventana. Las respuestas del portal y PDF se muestran en streaming, con fuentes cuando hay información disponible.

## Requisitos

XAMPP con Apache y PHP 8 o posterior, con cURL y mbstring habilitados, y un navegador moderno con JavaScript. La API del chatbot debe estar accesible desde este equipo. Historial académico y constancias dependen de servicios externos.

Los recursos visuales y scripts están incluidos en `assets/`. La vista no necesita Node.js ni compilación.

## Instalación e inicio

1. Coloca esta carpeta en `C:\xampp\htdocs\app-chatbot`.
2. Copia `.env.example` a `.env` en esta carpeta y configura `BASE` con la URL de la API y `TOKEN` con el mismo valor de `UNAMBA_TOKEN` del servidor.
3. En el `.env` de la raíz del servidor, configura:

   ```dotenv
   UNAMBA_UI_DIR="C:/xampp/htdocs/app-chatbot"
   ```

4. Ejecuta `iniciar.bat` del servidor.
5. Inicia **Apache** desde XAMPP.
6. Abre [el chatbot](http://localhost/app-chatbot/) o [el chat desplegado](http://localhost/app-chatbot/?chat=1).

Si Apache usa otro puerto o cambias el nombre de la carpeta, ajusta la URL. La vista no tiene un `.bat` propio. El lanzador del servidor inicia la API, Ollama y el panel documental, cuya página se abre automáticamente. Apache se administra desde XAMPP.

## Configuración y conexión

PHP lee `BASE` y `TOKEN` del `.env` en la raíz de esta carpeta, tanto si la API está en el mismo equipo como si está en otro. No subas `.env` a Git; Apache bloquea su descarga mediante `.htaccess`. El token no se entrega al navegador ni se incluye en JavaScript.

Como alternativa, configura `UNAMBA_ENV_FILE` en el entorno de Apache para usar un `.env` fuera de `htdocs`.

Usa el `.env` para mantener el mismo puerto y token en ambos procesos. Si los sobreescribes mediante variables de entorno, aplica valores coincidentes en Apache. `IA_BASE` e `IA_TOKEN` del entorno de Apache tienen prioridad sobre el archivo.

## Indicador de conexión

El punto aparece en la cabecera y en la burbuja del chat:

| Color | Significado |
| --- | --- |
| Verde | La API del servidor responde. |
| Gris | El servidor no responde o falló la comprobación. |
| Amarillo | Comprobación inicial en curso. |

Se actualiza cada 8 segundos mientras la pestaña está visible y al regresar a ella. Usa `api/estado.php` para comprobar `/salud` de la API. No confirma la disponibilidad de modelos, índices ni servicios académicos externos.

## Modos de consulta

### Crear FUT

El asistente pregunta por el tipo de trámite, destinatario, datos personales,
fundamentación y adjuntos. Antes de generar el archivo permite corregir campos
con `campo: nuevo valor`. Con `/generar` entrega un PDF para revisar y firmar;
`/cancelar` descarta el borrador. El token de descarga vence después de
15 minutos. El módulo requiere la ruta `/fut/chat` y `/fut/download` de la
versión correspondiente del servidor Python.

Debajo de la descarga aparece **Editar este FUT**. Abre una ventana con los campos
del borrador y el PDF original para revisar. Al aplicar cambios, genera una copia
editada en el navegador mediante la biblioteca local `pdf-lib`; el servidor Python
no se modifica ni almacena esta edición. Si el enlace caduca, genera otro FUT.

### Portal Web

Pregunta sobre la información de los documentos extraídos de la UNAMBA. Las cuatro preguntas destacadas priorizan carreras, Beca Permanencia, trámites virtuales y pagos virtuales. Al pulsarlas se envía la pregunta.

Las respuestas incluyen fuentes cuando hay evidencia. El contenido procede del índice local, no de una visita en vivo a cada página; fechas y convocatorias corresponden a la información extraída.

### Normativas / PDF

1. Pulsa **Ver documentos disponibles**.
2. Selecciona un documento de la lista con desplazamiento.
3. Comprueba el nombre que confirma el chat.
4. Escribe tu pregunta, por ejemplo: «¿Qué dispone el artículo 1?».

La lista muestra títulos del índice, elimina la repetición de nombres y conserva el número real de selección. Si falta un título, muestra un nombre legible derivado del archivo; no agrega un año que no esté disponible. Los documentos con nombres similares siguen siendo entradas distintas.

**Consultar todos los documentos** vuelve a la búsqueda global. También puedes escribir `/pdfs`, `/pdf N`, `/pdf 0` o `/todos`. Las acciones realizadas con botones se muestran con nombres legibles en la conversación. Las respuestas pueden citar páginas del documento. La lista permite seleccionar documentos para consultar; no descarga ni abre los PDF originales.

### Consultas universitarias

Permite solicitar **mi historial académico** o **mi constancia de matrícula**. Sigue los pasos del asistente y usa **Cancelar consulta** para interrumpir el proceso. Consulta únicamente tu propia información académica. Estas funciones dependen del sistema académico externo; el punto verde no comprueba ese sistema.

## Estructura

```text
app-chatbot/
  index.php                     Ventana del chat y selector de modos
  README.md
  .gitignore
  api/
    config.php                  Lectura del .env y puente PHP con streaming
    fut.php                     Puente del asistente FUT
    fut-descargar.php           Descarga protegida del FUT
    estado.php                  Comprobación de disponibilidad de la API
    web.php                     Puente de Portal Web
    docs.php                    Puente de Normativas / PDF
    ssaa/                       Integración de historial y constancias
  assets/
    chat.css                    Estilos, indicador y lista de documentos
    js/chat-core.js             Conversación, sugerencias, streaming y estado
    js/modo-web.js              Adaptador del portal
    js/modo-docs.js             Lista y selección de PDF
    js/modo-academico.js        Flujo de servicios académicos
    js/modo-fut.js              Interfaz del asistente FUT
    js/vendor/                  Biblioteca local para generar PDF
    fonts/                      Iconos locales
    img/                        Imágenes del chatbot
```

## Detener y actualizar

Para detener la API, haz doble clic en **`detener.bat` de la carpeta del servidor**. También puedes ejecutar `iniciar.bat detener` desde esa carpeta. Cerrar el navegador no detiene el servidor. Apache se detiene por separado desde XAMPP.

Después de modificar HTML, CSS o JavaScript, recarga con **Ctrl + F5**. Después de modificar código Python o el `.env`, detén y vuelve a iniciar el servidor. La gestión de documentos y reindexación se realizan desde el servidor y su panel documental.

## Problemas frecuentes

| Problema | Qué revisar |
| --- | --- |
| La página no abre | Apache iniciado, ubicación en `htdocs`, nombre y puerto de la URL. |
| Punto gris | Servidor iniciado y disponible en `/salud` del puerto configurado. |
| Punto verde pero falla una respuesta | Registros del servidor, Ollama, modelos e índice del modo consultado. |
| Falta configurar la conexión | `BASE` y `TOKEN` en el `.env` de esta carpeta. |
| Error de autorización | Token coincidente entre Apache y API; revisa variables de entorno antiguas. |
| Faltan extensiones PHP | Habilita cURL y mbstring en PHP de XAMPP y reinicia Apache. |
| Aparecen nombres antiguos o comandos sin formato | Ctrl + F5; si cambió código Python, reinicia también el servidor. |
| Falla historial o constancias | Disponibilidad del servicio académico y datos requeridos. |

## Traslado a otro equipo

Copia la vista a `htdocs` y prepara el servidor por separado. Configura `BASE` y `TOKEN` en el `.env` del cliente con los valores correspondientes a esa API. Si usas un archivo fuera de `htdocs`, indica su ruta mediante `UNAMBA_ENV_FILE` en Apache.
