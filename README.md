# Chatbot Test - Interfaz y Puente PHP

Módulo web en PHP diseñado para servir como interfaz de usuario y pasarela de comunicación (puente con cURL) hacia el servidor de Inteligencia Artificial (RAG).

---

## 🚀 Características principales
- **Puente cURL en PHP**: Conexión segura mediante tokens (`X-Token`) hacia el servicio backend de IA.
- **Streaming y Respuestas en Tiempo Real**: Configurado para manejar flujos de datos continuos (`ob_implicit_flush` y `CURLOPT_WRITEFUNCTION`).
- **Interfaz liviana**: Estructura lista para integrarse con entornos locales como XAMPP.

---

## 📂 Estructura del Proyecto

```text
chatbot-test/
│
├── api/
│   ├── config.php      # Configuración de conexión y lógica de cURL con la IA
│   └── docs.php        # Manejo de documentación o endpoints auxiliares
├── assets/             # Archivos estáticos (CSS, JS, imágenes)
├── index.php           # Interfaz principal del chatbot
├── .env                # Variables de entorno (No se sube a Git)
├── .gitignore          # Archivos excluidos del control de versiones
└── README.md           # Documentación del proyecto