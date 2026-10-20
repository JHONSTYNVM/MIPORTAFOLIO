# Asistente académico

Funciona sin IA externa ni dependencias. `conocimiento.js` recoge los temas de los dos sílabos y explicaciones académicas breves; los PDF originales se conservan en `silabos/`. `mascota.png` es una copia exacta del PNG proporcionado, con su canal alfa.

`motor.js` lee la organización actual de `cursos.html` y consulta por REST las tablas públicas existentes `materials` (solo `published=true`) y `galleries`, con paginación. Actualiza las publicaciones en cada pregunta sobre materiales/actividades y con el botón ↻. Usa únicamente la clave pública ya configurada, sin leer sesiones ni realizar escrituras. Una consulta fallida no se presenta como una fuente vacía. No extrae ni interpreta el contenido interno de archivos publicados; busca sus nombres, descripciones y enlaces. Los temas previstos se identifican como programación del sílabo.

`chatbot.js` contiene la interfaz accesible y la navegación a curso/semana/galería. `chatbot.css` aísla sus estilos y los dos nuevos enlaces del menú. No modifica la gestión de cursos, galerías o administración. Se integra en Inicio y Mis cursos mediante etiquetas de estilos/scripts y dos enlaces en cada menú.

## Integración de IA futura (no activada)

`PORTFOLIO_CHATBOT.Assistant` acepta un `responder` opcional. La implementación actual no pasa ninguno y resuelve localmente todas las preguntas. El contrato es una función asíncrona que recibe `{ question, evidence, localAnswer }` y devuelve `{ text, items?, links?, note? }`; si falla, se conserva la respuesta local. La evidencia está limitada a ocho registros temáticos. Las publicaciones se responden directamente desde sus fuentes verificadas.

Para habilitar un modelo, tras autorización: crear un endpoint de servidor (por ejemplo una Supabase Edge Function), guardar allí la clave del proveedor como secreto, validar entrada y salida, limitar frecuencia y tamaño, restringir CORS a los dominios del portafolio y exigir respuestas fundamentadas con enlaces. Conectar después un adaptador `responder` en la creación de `Assistant` en `chatbot.js`. Nunca incluir claves privadas en estos archivos. No se ha creado, desplegado ni llamado a un endpoint de IA, ni cambiado configuración o esquema de Supabase.
