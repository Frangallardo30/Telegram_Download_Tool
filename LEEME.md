# Telegram Lote · 2.5

Extensión para Chrome que busca y descarga archivos de **Telegram Web K**, siempre dentro del canal o del tema abierto. Interfaz oscura; código completo, sin compilación ni dependencias externas.

## Instalar

1. Extraé el ZIP en una carpeta fija.
2. Abrí `chrome://extensions`.
3. Activá **Modo de desarrollador**.
4. Elegí **Cargar descomprimida** y seleccioná **Telegram_Lote**, donde está `manifest.json`.
5. Fijá la extensión con la chincheta del menú de extensiones.

Requiere Chrome 116 o posterior. No hace falta Python, una API key ni instalar programas adicionales.

## Actualizar sin perder preferencias

1. Terminá o cancelá los pendientes de la versión anterior.
2. Cerrá su panel.
3. Copiá los archivos de la nueva carpeta **Telegram_Lote** dentro de la carpeta original de la extensión, reemplazando los archivos existentes.
4. En `chrome://extensions`, pulsá **Recargar** en Telegram Lote.
5. Recargá Telegram Web K y abrí el panel nuevamente.

Conservá la ruta original: Chrome usa esa carpeta para identificar una extensión descomprimida. Cargarla desde una carpeta diferente puede crear otra instalación con datos separados. La cola incompleta de 1.0 no se migra; el historial y las preferencias de esa instalación se conservan si mantenés su identidad.

## Uso

1. Abrí https://web.telegram.org/k/ e iniciá sesión si hace falta.
2. Entrá al canal o **abrí el tema específico**.
3. Abrí la extensión y conectá con la pestaña. Verificá el grupo, el tema y su ID.
4. Elegí imágenes, videos, documentos y/o audio.
5. Elegí todo el historial, los últimos 20/50/100 archivos o los nuevos desde tu última descarga completa en ese tema.
6. Si querés, agregá fechas, palabras, extensiones y tamaño.
7. Buscá. Los resultados nuevos quedan seleccionados automáticamente.
8. Elegí archivos separados o un ZIP y pulsá **Descargar lote**. Para ZIP, usá **Carpeta elegida · recomendado** y elegí dónde guardar las partes.

Dejá abiertos Telegram y el panel mientras se descargan datos. Al cerrar el panel o Chrome, la cola queda guardada. Para continuar, abrí nuevamente el mismo tema, conectá la extensión y pulsá **Reanudar**.

## Mejoras de 2.5

- El ZIP ya no repite dentro las carpetas del canal y del tema. Por defecto, los archivos quedan directamente en la raíz del ZIP.
- Si activás **Crear subcarpetas por tipo**, dentro del ZIP aparecen solo **Documentos**, **Imágenes**, **Videos** y **Audio**, según los archivos incluidos.
- La ubicación del ZIP final sigue siendo la carpeta de descargas del canal/tema, o la carpeta que elegiste en el modo de guardado directo. Se aplica también a cada ZIP de un lote dividido en partes.
- Si se detecta un temporal incompleto al armar el ZIP, los reintentos automáticos pueden recuperar ese archivo con un temporal nuevo antes de entregar el ZIP, hasta el número configurado.
- Conserva los nombres saneados y los ID de mensaje para evitar colisiones. Los ZIP que ya se descargaron no se modifican; la estructura nueva se aplica al armar un ZIP nuevo.

## Mejoras de 2.4

- Selector **Tamaño de la lista** arriba de los archivos: **Normal**, **Compacta** y **Muy compacta**.
- Muy compacta muestra una línea por archivo, conserva los accesos al mensaje y a la vista previa y oculta las miniaturas y los detalles repetidos. Pasá el mouse sobre el archivo para ver el nombre completo, el tamaño y la fecha.
- En las vistas compactas, el indicador verde **✓** muestra que un archivo ya fue descargado. Podés volver a descargarlo desactivando **Omitir archivos ya descargados**.
- La lista tiene su propia zona de desplazamiento, con altura limitada, para acceder a los controles y al resumen sin recorrer una página enorme.
- Recuerda el tamaño elegido y conserva la selección al cambiar de vista. La opción “Vista compacta” de versiones anteriores se migra a **Compacta**.

## Mejoras de 2.3

- **Descargas a la vez** se puede cambiar de 1 a 3 durante el lote: subí a 3 para probar más velocidad. Si bajás el número, los archivos que ya están en curso terminan y la cola respeta el nuevo valor al iniciar los siguientes.
- Empieza el siguiente archivo apenas se libera un lugar, sin esperar la consulta periódica del panel. También comienza a armar el ZIP al terminar su última transferencia.
- Conversión de bloques más eficiente y actualizaciones de la lista limitadas a cuatro por segundo.
- Agrupa las sincronizaciones a disco: hasta 8 MB o aproximadamente un segundo entre sincronizaciones, con sincronización obligatoria al pausar/cerrar una transferencia y antes de empaquetar. Si el navegador termina abruptamente, la reanudación revisa el tamaño real del temporal y puede repetir los bloques más recientes.
- Cuando el panel no ofrece selector de carpetas, usa automáticamente **Descargas del navegador** y deshabilita la opción no disponible.

La mejora de MB/s depende del servidor, la conexión y el equipo. No elimina límites de Telegram ni garantiza una velocidad fija. Los cambios de concurrencia se aplican en vivo desde **Filtros y opciones**. Para actualizar un lote que está en curso, primero pausalo, esperá a que se cierre el bloque actual y cerrá el panel; actualizá sobre la carpeta original, recargá la extensión y Telegram y reanudá desde el mismo tema.

## Mejoras de 2.2

- Guardado directo del ZIP en una carpeta elegida, sin usar una URL temporal como descarga final.
- Escritura por bloques, cierre del archivo y comprobación de tamaño y cierre ZIP antes de liberar los temporales.
- No sobrescribe archivos existentes: agrega `(2)`, `(3)`, etc. Las partes se guardan en la carpeta elegida.
- Conserva los temporales y permite reintentar si la escritura o la verificación fallan.
- Guardado clásico con Descargas del navegador como alternativa. Espera una comprobación de existencia antes de marcar un ZIP como guardado; si figura eliminado o con tamaño distinto, conserva sus temporales.

## Mejoras de 2.1

- ZIP64 sin el límite de 80 MB ni 100 archivos por ZIP.
- ZIP independientes por partes, tamaño automático o elegible hasta 128 GB.
- Liberación de temporales después de guardar cada parte y recuperación entre partes.

## Mejoras de 2.0

### Archivos grandes y recuperación

Los archivos se piden en **bloques de 512 KB**, se escriben en un temporal privado de la extensión y se conservan entre reinicios. No se carga el archivo completo en RAM. Al terminar, Chrome lo guarda en Descargas con su nombre y carpeta.

La extensión consulta el tamaño real del temporal al reanudar. Si se cortó en un bloque, lo vuelve a pedir sin repetir todos los bloques anteriores. Restaura el mensaje y las referencias del archivo desde el mismo canal y tema después de recargar Telegram. Si el mensaje fue eliminado o cambió a otro archivo, lo informa y no lo reemplaza silenciosamente.

Los temporales usan espacio en disco además del archivo final. Se borran cuando Chrome confirma el guardado. **Limpiar temporales** libera restos de lotes terminados o cancelados y no borra tus descargas finales. No permite limpiar una cola pendiente.

### Reintentos

Elegí cero, tres o cinco reintentos automáticos. Los fallos de red se vuelven a intentar con espera progresiva. Si Telegram indica una espera, se respeta ese tiempo. Los errores de acceso, archivos eliminados o falta de espacio se muestran para revisión.

Si una descarga de Chrome se interrumpe y permite reanudación, se intenta retomarla. Si no permite, se puede guardar de nuevo desde el temporal completo sin pedir otra vez el archivo entero a Telegram.

### Elección y vista previa

- Miniaturas de fotos y videos cuando Telegram las ofrece. Se descargan miniaturas pequeñas, no videos completos para generar una vista previa.
- Vista previa ampliada y datos del archivo.
- Botón **Mensaje** para abrir su mensaje original dentro del mismo tema.
- Búsqueda local en el listado sin volver a consultar Telegram.
- Vista compacta, orden por nombre, fecha o tamaño y selección global.
- Favoritos de filtros guardados por cuenta, canal y tema. **Aplicar** restaura el favorito; **Guardar** crea o actualiza el nombre indicado; **×** lo elimina.

### Modos rápidos

**Últimos 20/50/100** reúne resultados de los tipos elegidos y los ordena por fecha, en lugar de quedarse con la primera categoría consultada.

**Nuevos desde mi última descarga** usa la fecha de inicio del último lote que terminó completamente, dentro de ese tema. Si todavía no hay un lote anterior, busca el historial completo. Puede incluir mensajes del mismo segundo para evitar perder novedades; la opción de omitir ya descargados evita repetir archivos. Para recuperar archivos anteriores, elegí **Todo el historial**.

### Progreso y avisos

- Progreso global y por archivo, cantidad de bytes y estado de guardado.
- Velocidad y tiempo restante aproximado cuando se conocen los tamaños.
- Aviso de finalización opcional, sin mostrar nombres del grupo o de archivos en la notificación.
- Botones para abrir el archivo, el ZIP o su carpeta, una vez guardados.
- Exportación CSV con nombres, tipos, bytes, fechas, grupo, tema y errores.

### ZIP64 y lotes por partes

Ya no tiene el límite de 80 MB ni de 100 archivos por ZIP. Usa **ZIP64** cuando un archivo o las posiciones del ZIP superan los 4 GB. Conserva los archivos sin comprimir y calcula CRC-32 para verificar cada entrada. Los nombres incluyen el ID del mensaje para evitar colisiones. Los archivos van directamente en la raíz del ZIP, o en carpetas por tipo si activás esa opción; el canal y el tema se usan para la ubicación del ZIP final y no se repiten adentro.

**División automática:** en los ajustes, elegí “Automático” para formar las partes más grandes que permite la cuota temporal informada por Chrome. También podés elegir de 1 a 128 GB por parte. Chrome puede reducir ese tamaño si dispone de menos espacio. El lote completo puede sumar muchos más GB: se trabaja una parte por vez, se espera a que Chrome confirme el guardado y se borran los temporales de esa parte antes de continuar. No es necesario mantener todo el canal en el temporal al mismo tiempo.

Los archivos quedan como `Telegram_Lote_Tema_parte_001.zip`, `…parte_002.zip`, etc. **Cada ZIP se abre por separado**; no requiere recombinar volúmenes ni instalar herramientas especiales. Si un archivo es mayor que el tamaño elegido, se guarda completo en un ZIP propio, que puede superar ese tamaño. No divide internamente un archivo. Para ese caso necesitás espacio suficiente para el archivo y su ZIP.

El tamaño automático reserva margen para los originales, el ZIP y su descarga final. La cuota de Chrome es una estimación, no una garantía de espacio libre. Si se agota al armar un ZIP de varios archivos, esa parte se subdivide automáticamente. Si no alcanza para un único archivo, aparece un error y podés liberar espacio y reintentar. Sin una cuota informada, divide preventivamente en 8 GB. Una búsqueda devuelve hasta 10.000 resultados; para canales mayores, hacé lotes por fechas. Dejá abierto el panel mientras trabaja; al cerrarlo podés retomar desde el tema original.

En el modo recomendado, se marcan como descargados después de cerrar la escritura y volver a leer el archivo final para verificar su tamaño y su cierre ZIP. La carpeta se recuerda para la cola, pero Chrome puede volver a pedir permiso al reanudar. Estos ZIP no aparecen en la lista de descargas del navegador; buscalos en la carpeta que elegiste. El modo clásico con Descargas del navegador sigue disponible y demora unos 13 segundos adicionales por parte para comprobar si el archivo final sigue disponible. Si un archivo falla, primero reintentá o cancelá; no se crea silenciosamente un ZIP incompleto.

## Tema abierto: regla obligatoria

- En grupos con temas, nunca busca en la vista de todos los mensajes. Hay que abrir un tema, incluido **General**.
- Envía el ID del tema en la búsqueda y verifica el canal y la pertenencia de cada mensaje.
- El mismo control se aplica al restaurar una cola, pedir bloques, mostrar miniaturas y abrir mensajes.
- Si cambiás de tema, canal, cuenta o pestaña, pausa las nuevas peticiones. Un guardado que Chrome ya comenzó puede terminar.
- Para otra conversación, cancelá los pendientes y conectá de nuevo.

## Contenido con descarga restringida

En **Filtros y opciones**, activá **Intentar guardar contenido con descarga restringida**. Está desactivado por defecto.

Permite intentar guardar un archivo que tu cuenta ya puede ver cuando Telegram oculta el botón de descarga por la restricción de guardado del canal. Se utiliza la misma sesión y los mismos controles de tema.

**No garantiza el acceso:** si el servidor no entrega el archivo, si no pertenecés al canal, si el mensaje fue eliminado o si el medio necesita un pago, se muestra un error o no se incluye. No obtiene permisos de acceso nuevos ni descarga medios de pago. No incluye contenido temporal, historias, stickers ni emojis.

## Carpetas

Por defecto: **Descargas / Telegram Lote / canal o grupo / tema / archivo**.

Podés cambiar el nombre de la primera carpeta y agregar subcarpetas por tipo. Chrome administra la ubicación base de Descargas. Si pregunta dónde guardar cada archivo, desactivá esa pregunta en `chrome://settings/downloads`.

## Si un ZIP figura como “Eliminado”

1. Actualizá los archivos sobre la carpeta original y recargá la extensión y Telegram.
2. En **Formato del lote**, elegí ZIP y, en **Guardar ZIP con**, elegí **Carpeta elegida · recomendado**.
3. Si usabas 2.1 y el archivo desapareció, desactivá **Omitir archivos ya descargados**, buscá de nuevo y seleccioná el lote. La versión anterior pudo haber registrado los archivos aunque el ZIP ya no exista.
4. Pulsá **Descargar lote**, elegí una carpeta común de tu PC y esperá a **FINALIZADO**. Todas las partes quedarán en esa carpeta.
5. Si falla, no limpies temporales: usá **Reintentar errores**. En 2.2 se conservan los datos del lote cuando falla el guardado.

La causa específica del aviso reportado en Brave no se pudo reproducir. La actualización evita la entrega del ZIP mediante URL Blob en el modo recomendado y agrega controles al modo clásico. No impide que otro programa o el usuario borren el archivo final después de guardarlo.

## Límites y privacidad

- Integra Telegram **Web K**. Web A, las apps de escritorio y las de celular no están integradas.
- No extrae ni guarda cookies, contraseñas o claves de sesión. No agrega un servidor externo ni envía archivos a terceros.
- La cola, el historial, los favoritos y los temporales quedan en tu navegador. Desinstalar la extensión o borrar sus datos puede perderlos.
- Descarga datos solo mientras el panel y Telegram están abiertos. Al cerrarlos conserva la cola, pero no continúa consultando Telegram.
- Hasta 10.000 resultados por búsqueda. Si se alcanza el límite, filtrá por fechas o descargá por tandas.
- “Ya descargado” se basa en el historial de la extensión. Si borraste el archivo final y querés bajarlo otra vez, desactivá esa opción.
- El guardado final puede ser más lento que la transferencia; la velocidad y el tiempo son estimaciones, no una promesa.
- Monoforos y botforos de negocios no están admitidos.
- Telegram Web K puede cambiar sus interfaces internas y requerir una actualización de esta extensión.

## Verificación

Incluye pruebas de lógica y pruebas de navegador con una conversación controlada y las APIs de extensión simuladas. Se verificaron bloques de 512 KB, tamaño y contenido, escritura OPFS real, cierre y reinicio del navegador conservando datos, recuperación del panel, reintentos, CRC del ZIP, temas separados, General, álbumes, favoritos, miniaturas y modo restringido opcional. También se probó un ZIP real de 90 MB con CRC, ZIP64 con posiciones superiores a 4 GB en un archivo disperso, encabezados de tamaños de varios GB, división en ZIP independientes, limpieza entre partes y recuperación de la cola entre partes. No se hizo una descarga real de varios GB desde Telegram. Se probaron el guardado directo, la conservación del ZIP final tras borrar el origen temporal y reiniciar el navegador, colisiones de nombres, cancelación, archivos truncados y estados nativos “eliminado”. El selector de carpeta del usuario se simuló; la escritura y la recuperación de los identificadores de carpeta se ejercitaron con directorios OPFS reales. También se probaron escrituras en disco mediante un adaptador de la API. No se probó el selector nativo de carpetas instalado en Brave.

**No se validó con una cuenta real de Telegram ni con la instalación en tu Chrome.** No había una sesión de Telegram disponible. Para la primera prueba real, elegí un lote pequeño. Tampoco se promete compatibilidad con todos los canales protegidos: depende de la respuesta del servidor.

## Código y pruebas

- `panel.html`, `panel.css`, `panel.js`: interfaz.
- `page.js`: integración con Telegram, búsquedas, restauración y bloques.
- `engine.js`: cola, recuperación, reintentos y progreso.
- `destination.js`: carpeta elegida, permisos recordados, escritura y verificación del ZIP final.
- `disk.js`, `disk-worker.js`: temporales y escrituras por bloques.
- `zip.js`: archivo ZIP con CRC-32 y nombres UTF-8.
- `background.js`: guardado en Chrome, historial y notificaciones.
- `core.js`: tipos, filtros, nombres y controles de tema.

Desde la carpeta **Telegram_Lote**, las pruebas de lógica se ejecutan con:

`node --test pruebas/core.test.cjs pruebas/page.test.cjs pruebas/v2.test.cjs pruebas/engine.test.cjs pruebas/destination.test.cjs`

Las pruebas de navegador requieren Playwright y un Chromium disponible. Podés indicar el ejecutable con `TG_TEST_BROWSER` y, si corresponde, la carpeta de módulos con `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. Se ejecutan por separado:

`node pruebas/browser.test.cjs`

`node pruebas/opfs.test.cjs`

`node pruebas/destination-browser.test.cjs`

Referencias técnicas: https://core.telegram.org/api/files · https://core.telegram.org/method/messages.search · https://github.com/morethanwords/tweb · https://web.dev/articles/origin-private-file-system · https://developer.chrome.com/docs/extensions/reference/api/downloads.

Extensión independiente, sin afiliación con Telegram.
