<p align="center">
  <img src="icons/icon128.png" width="88" alt="Logo de Telegram Lote">
</p>

<h1 align="center">📦 Telegram Lote</h1>

<p align="center">
  <strong>Descargá varios archivos de Telegram en un solo lote.<br>Elegí qué bajar y trabajá únicamente dentro del tema que tenés abierto.</strong>
</p>

<p align="center">
  🧩 Extensión para Chrome · 🌙 Interfaz oscura · 🗜️ ZIP / ZIP64 · 🏷️ v2.5.0
</p>

---

## ✨ ¿Qué es Telegram Lote?

**Telegram Lote** es una extensión que busca y descarga archivos desde **Telegram Web K**, usando la sesión que ya tenés abierta en el navegador.

Podés filtrar los resultados, seleccionar todos los archivos con un clic y guardarlos por separado o reunirlos en uno o varios ZIP. Es útil para canales con muchas fotos, documentos, videos o audios, y para grupos organizados por temas.

> 🎯 **En grupos con temas, trabaja solo con el tema abierto.** Para empezar, abrí ese tema en Telegram y verificá su nombre en el panel.

## 🚀 Funciones principales

| Función | Qué permite hacer |
| :--- | :--- |
| 🖼️ Tipos de archivo | Elegir imágenes, videos, documentos y audio, incluidas notas de voz. |
| 🔎 Filtros | Buscar por nombre o texto del mensaje, fechas, extensiones y tamaño. |
| ☑️ Selección por lotes | Seleccionar todos los resultados o ajustar la selección manualmente. |
| 🗜️ ZIP / ZIP64 | Agrupar archivos de varios GB y dividir el lote en ZIP independientes. |
| ⏸️ Pausa y reanudación | Conservar la cola y los bloques temporales para continuar después. |
| ⚡ Descargas simultáneas | Trabajar con 1, 2 o 3 archivos a la vez y cambiarlo durante el lote. |
| 🔁 Reintentos | Reintentar fallos de red y recuperar temporales incompletos, según la configuración. |
| 🪶 Vistas compactas | Elegir Normal, Compacta o Muy compacta, con una línea por archivo. |
| 👁️ Vista previa | Consultar miniaturas de imágenes y videos cuando Telegram las ofrece. |
| ↗️ Mensaje original | Abrir el mensaje correspondiente dentro del mismo canal o tema. |
| ⭐ Favoritos | Guardar filtros para una cuenta, canal y tema. |
| 🕒 Modos rápidos | Buscar los últimos 20, 50 o 100 archivos, o los nuevos desde el último lote completo. |
| 📊 Exportación CSV | Exportar el listado con nombres, tamaños, fechas, estados y errores. |
| 🔔 Avisos | Recibir una notificación cuando termine el lote. |

## 🆕 Novedades de la versión 2.5

- **ZIP sin carpetas repetidas:** los archivos quedan directamente dentro del ZIP; las carpetas del canal y del tema se usan para su ubicación final.
- **Agrupación opcional por tipo:** al activarla, dentro del ZIP aparecen solo Documentos, Imágenes, Videos o Audio.
- **Recuperación de temporales incompletos:** puede volver a descargar el archivo afectado antes de armar el ZIP, respetando los reintentos configurados.
- Conserva ZIP64, las partes independientes, las vistas compactas y el ajuste de descargas simultáneas durante el lote.

## 🧩 Requisitos

- **Chrome 116 o posterior**, con soporte para el panel lateral de extensiones.
- Una sesión iniciada en [Telegram Web K](https://web.telegram.org/k/).
- Espacio en disco para los archivos temporales y las descargas finales.

Está diseñada para Chrome. En otros navegadores basados en Chromium, la disponibilidad de funciones depende de las API que ofrezca el navegador. Por ejemplo, el selector de carpetas puede no estar disponible en el panel.

Para usarla no necesitás Python, una API key ni compilar el proyecto.

## 📥 Instalación

1. Descargá el ZIP de la versión que quieras desde **Releases**.
2. Extraelo en una carpeta fija de tu PC.
3. Abrí `chrome://extensions`.
4. Activá **Modo de desarrollador**.
5. Pulsá **Cargar descomprimida**.
6. Seleccioná la carpeta **Telegram_Lote**, que contiene `manifest.json`.
7. Fijá la extensión en la barra del navegador desde el menú de extensiones.

Si descargaste el repositorio mediante **Code → Download ZIP**, seleccioná la carpeta extraída que contiene `manifest.json`.

> 📁 Conservá esa carpeta después de instalar: Chrome carga la extensión desde sus archivos.

## ▶️ Tu primer lote

1. Abrí **Telegram Web K** y entrá al canal o al tema que querés descargar.
2. Abrí el panel de **Telegram Lote** y pulsá **Conectar con la pestaña abierta**.
3. Verificá el nombre del canal y del tema.
4. Elegí los tipos de archivo y, si hace falta, agregá filtros.
5. Pulsá **Buscar archivos** y esperá los resultados.
6. Usá **Seleccionar todos** o ajustá los archivos marcados.
7. En **Filtros y opciones**, elegí archivos separados o ZIP.
8. Pulsá **Descargar lote** y dejá abiertos Telegram y el panel mientras trabaja.

El progreso distingue la transferencia, el armado del ZIP y el guardado final. La velocidad y el tiempo restante son estimaciones.

## 🎯 Canales y grupos con temas

| Situación | Cómo se comporta |
| :--- | :--- |
| Canal sin temas | Busca dentro del canal abierto. |
| Grupo con temas | Busca y descarga únicamente dentro del tema abierto. |
| Tema General | Se trata como un tema específico. |
| Vista de todos los mensajes de un grupo con temas | Hay que abrir un tema antes de buscar. |
| Cambio de pestaña, canal, tema o cuenta | Pausa las nuevas peticiones. Un guardado ya iniciado puede terminar. |

Para reanudar una cola, volvé al mismo tema y a la misma cuenta. Para trabajar en otra conversación, cancelá los pendientes y conectá nuevamente.

## 🗜️ ZIP, ZIP64 y partes

### 📦 Cómo queda organizado

En el modo **Descargas del navegador**, el ZIP se guarda por defecto en:

```text
Descargas/Telegram Lote/Canal/Tema/Telegram_Lote_Tema.zip
```

Su contenido queda así:

| Configuración | Ejemplo de archivo dentro del ZIP |
| :--- | :--- |
| Sin subcarpetas por tipo | `Foto_m123.jpg` |
| Con subcarpetas por tipo | `Imágenes/Foto_m123.jpg` |

El canal y el tema **no se repiten dentro del ZIP**. Los nombres incluyen el ID del mensaje para evitar coincidencias.

### 🧱 Lotes de varios gigas

- **Automático** ajusta el tamaño de las partes a la cuota temporal que informa Chrome.
- También podés elegir tamaños de **1 a 128 GB por parte**; el navegador puede reducirlos si dispone de menos espacio.
- ZIP64 permite representar archivos y posiciones superiores a 4 GB.
- Se trabaja una parte por vez y se liberan sus temporales después de confirmar el guardado.

Las partes se nombran, por ejemplo:

```text
Telegram_Lote_Tema_parte_001.zip
Telegram_Lote_Tema_parte_002.zip
Telegram_Lote_Tema_parte_003.zip
```

**Cada parte se abre por separado.** Son ZIP independientes y no requieren recombinar volúmenes.

Un archivo individual no se divide: si supera el tamaño elegido para una parte, ocupa su propio ZIP, que puede ser más grande. Para ese caso necesitás espacio suficiente para ese archivo y su ZIP.

Los ZIP agrupan los archivos **sin recomprimir su contenido**. Por eso, el tamaño del ZIP será parecido a la suma de sus archivos. Se calcula CRC-32 para verificar las entradas.

### 💾 Dónde guardar el ZIP

| Modo | Destino |
| :--- | :--- |
| **Descargas del navegador** | Carpeta configurada en el navegador, organizada por canal y tema. |
| **Carpeta elegida** | Carpeta que seleccionás; se verifica el archivo final antes de liberar temporales. |

Si el panel no ofrece selector de carpetas, la extensión elige **Descargas del navegador** y deshabilita la opción no disponible.

Los ZIP guardados directamente en una carpeta elegida se encuentran en esa carpeta y no aparecen en la lista de descargas del navegador.

## ⚡ Velocidad, pausa y recuperación

En **Filtros y opciones → Descargas a la vez**, elegí entre **1 y 3**. Podés cambiarlo durante el lote. Si reducís el número, los archivos que ya están en curso terminan y los siguientes respetan el nuevo límite.

La extensión solicita bloques de 512 KB y utiliza temporales en disco. El archivo completo no se carga en RAM para transferirlo o construir el ZIP. La velocidad real depende de la conexión, el equipo y los límites de Telegram.

Para continuar después de cerrar el panel o el navegador:

1. Abrí nuevamente Telegram Web K con la misma cuenta.
2. Entrá al canal y al tema originales.
3. Abrí la extensión, conectá y pulsá **Reanudar**.

Al reanudar, se revisa el tamaño real del temporal. Si hubo un cierre abrupto, pueden repetirse los bloques más recientes.

## 🌙 Una vista para cada listado

El selector **Tamaño de la lista** está arriba de los archivos:

| Vista | Qué muestra |
| :--- | :--- |
| **Normal** | Filas amplias, detalles y miniaturas si están activadas. |
| **Compacta** | Filas más pequeñas y menos información repetida. |
| **Muy compacta** | Una línea por archivo, sin miniaturas, con accesos al mensaje y a la vista previa. |

La selección se conserva al cambiar de vista y el tamaño elegido se recuerda. En las vistas compactas, **✓** indica que el archivo figura como descargado en el historial de la extensión. Pasá el mouse sobre una fila para consultar el nombre completo y sus detalles.

También podés **filtrar el listado sin volver a buscar en Telegram**, y ordenar por fecha, nombre o tamaño.

## 🔁 Cómo actualizar

1. Pausá el lote y esperá a que termine el bloque actual, o terminá/cancelá los pendientes.
2. Cerrá el panel de la extensión.
3. Copiá los archivos de la versión nueva sobre la **carpeta original**, reemplazando los anteriores.
4. En `chrome://extensions`, pulsá **Recargar**.
5. Recargá Telegram Web K y abrí el panel.
6. Si quedó una cola pendiente, volvé al tema original y reanudá.

Mantener la carpeta original ayuda a conservar la identidad de la instalación, las preferencias y el historial. La cola incompleta de la versión 1.0 no se migra.

## ❓ Preguntas frecuentes

<details>
<summary>🔁 ¿Cómo vuelvo a descargar un archivo que figura como “Ya descargado”?</summary>

Desactivá **Filtros y opciones → Omitir archivos ya descargados**, marcá el archivo y descargalo nuevamente. Si no aparece, volvé a buscar. El aviso puede seguir visible, pero ya no bloquea la selección.

El historial registra descargas realizadas por la extensión; no garantiza que el archivo final siga en tu PC si lo borraste después.

</details>

<details>
<summary>🕒 ¿Qué hace “Nuevos desde mi última descarga”?</summary>

Busca desde el inicio del último lote que terminó completamente en ese tema. Si todavía no hay un lote anterior, busca el historial completo. Para recuperar archivos más antiguos, elegí **Todo el historial**.

</details>

<details>
<summary>🚫 ¿Puede guardar contenido con descarga restringida?</summary>

Existe la opción **Intentar guardar contenido con descarga restringida**, desactivada por defecto. Permite intentar guardar archivos a los que tu cuenta ya tiene acceso, utilizando la misma sesión y los mismos controles de tema.

Depende de que Telegram entregue el archivo. No obtiene permisos nuevos ni garantiza que todos los canales protegidos funcionen. Los medios de pago, el contenido temporal, las historias, los stickers y los emojis personalizados no se incluyen.

</details>

<details>
<summary>🗑️ ¿Qué hago si un ZIP figura como eliminado o el guardado falla?</summary>

La extensión comprueba el guardado y conserva los temporales cuando detecta un fallo. Usá **Reintentar errores** y revisá el espacio disponible. Si está disponible, podés elegir el guardado directo en una carpeta para reintentar un ZIP que falló con las descargas del navegador.

Si ocurrió con una versión anterior y el lote ya quedó marcado como descargado, desactivá **Omitir archivos ya descargados** y buscá nuevamente.

La extensión no impide que otro programa o el usuario borren un archivo final después del guardado.

</details>

<details>
<summary>💽 ¿Cuánto espacio necesita y cómo libero temporales?</summary>

Necesita espacio para los archivos de la parte actual, su ZIP y el archivo final. La cuota informada por Chrome es una estimación; el espacio real disponible puede ser menor.

**Limpiar temporales de lotes terminados** elimina restos de temporales, conservando las descargas finales y los favoritos. Primero terminá o cancelá los pendientes; una cola activa no se puede limpiar.

</details>

<details>
<summary>🔎 ¿Por qué no encuentro todos los archivos del canal?</summary>

Revisá el tema abierto, los tipos seleccionados, las fechas, el texto buscado, las extensiones y los límites de tamaño. Una búsqueda admite hasta **10.000 resultados**; para historiales mayores, trabajá por rangos de fechas.

</details>

## 🔐 Privacidad y permisos

- El procesamiento de la cola y de los ZIP ocurre en el navegador.
- La cola, el historial, los filtros favoritos y los temporales se almacenan localmente.
- La extensión utiliza la sesión de Telegram abierta y no exporta cookies, contraseñas ni claves de sesión.
- No agrega un servidor propio al que se envíen tus archivos.

Solicita permisos para el panel lateral, la integración con Telegram Web, las descargas, el almacenamiento y las notificaciones. El acceso a sitios se limita a `https://web.telegram.org/*`.

Desinstalar la extensión o borrar sus datos puede eliminar la cola, los temporales y las preferencias.

## 🛠️ Código y pruebas

| Archivo | Responsabilidad |
| :--- | :--- |
| `panel.html`, `panel.css`, `panel.js` | Interfaz, filtros y selección. |
| `page.js` | Búsqueda y descarga por bloques desde Telegram Web K. |
| `engine.js` | Cola, progreso, pausa, recuperación y reintentos. |
| `disk.js`, `disk-worker.js` | Lectura y escritura de temporales en disco. |
| `zip.js` | Generación de ZIP y ZIP64 con nombres UTF-8 y CRC-32. |
| `destination.js` | Escritura y verificación en la carpeta elegida. |
| `background.js` | Guardado con el navegador, historial y notificaciones. |
| `core.js` | Tipos, filtros, nombres, rutas y controles de tema. |

<details>
<summary>🧪 Cómo ejecutar las pruebas</summary>

Las pruebas de lógica requieren Node.js; algunas verificaciones de ZIP utilizan Python 3. Desde la carpeta de la extensión:

```bash
node --test pruebas/core.test.cjs pruebas/page.test.cjs pruebas/v2.test.cjs pruebas/engine.test.cjs pruebas/destination.test.cjs
```

Las pruebas de navegador requieren Playwright y un Chromium disponible:

```bash
node pruebas/browser.test.cjs
node pruebas/opfs.test.cjs
node pruebas/destination-browser.test.cjs
```

Podés indicar el ejecutable con `TG_TEST_BROWSER` y, si corresponde, la carpeta de módulos con `CODEX_PRIMARY_RUNTIME_NODE_MODULES`.

Se probaron temas separados, bloques, pausas, recuperación, escritura real de temporales, integridad de ZIP, partes independientes, rutas sin carpetas repetidas y vistas compactas. Las pruebas utilizan Telegram y las API de extensión simulados. El selector nativo de carpetas también se simuló; la escritura y la recuperación de identificadores se verificaron con directorios OPFS reales.

</details>

## 📌 Compatibilidad y alcance

- Integra **Telegram Web K**. Telegram Web A, Desktop y las aplicaciones móviles no están integrados.
- La transferencia requiere que Telegram y el panel permanezcan abiertos. Al cerrarlos, conserva la cola, pero no continúa consultando Telegram.
- No admite monoforos ni botforos de negocios.
- Usa interfaces internas de Telegram Web K, por lo que sus cambios pueden requerir una actualización.
- Las pruebas automatizadas no garantizan compatibilidad con todos los canales, navegadores o cuentas. La descarga real de varios GB desde Telegram no se validó durante esas pruebas.

## 📄 Licencia

Distribuido bajo la **licencia MIT**. Consultá [LICENSE.txt](LICENSE.txt).

---

<p align="center">
  📦 <strong>Muchos archivos. Un lote. Solo el tema que elegiste.</strong><br>
  <sub>Proyecto independiente, sin afiliación con Telegram ni Google.</sub>
</p>
