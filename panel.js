'use strict';
const $=id=>document.getElementById(id), C=TGLCore;
const S={tabId:null,context:null,items:[],known:new Set(),selected:new Set(),allMode:true,history:{},scan:null,scanId:null,queue:null,previews:new Map(),previewPending:new Map(),previewItem:null,visible:100,polling:false,scopeOK:false,busy:false};
const optionsIds=['query','dateFrom','dateTo','extensions','minSize','maxSize','limit','parallel','folder','skipDone','byType','addId','quickMode','maxRetries','outputMode','zipPartGiB','zipSaveMode','notify','thumbnails','compact','listDensity','allowRestricted'];
let engine;
const destination=new TGLDestination();
let lastDone=0;
const hasWork=q=>!!q&&(q.jobs.some(j=>['pending','waiting','transfer','delivering','saving','staged'].includes(j.status))||['packing','saving','delivering'].includes(q.archiveStatus));
const dateFormat=new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'});
const icons={image:'▧',video:'▷',document:'▤',audio:'♫'};
function notice(text,info=false){$('notice').hidden=!text;$('notice').textContent=text;$('notice').classList.toggle('info',info);}
async function call(command,args={},tabId=S.tabId){
  if(!tabId)throw new Error('Conectá Telegram primero.');
  const [r]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:async(c,a)=>{try{return {ok:true,value:await window.__telegramLote.dispatch(c,a)};}catch(e){return {ok:false,error:String(e?.message||e)};}},args:[command,args]});
  if(!r?.result?.ok)throw new Error(r?.result?.error||'No se pudo hablar con Telegram. Volvé a conectar.');
  return r.result.value;
}
async function message(type,payload){const r=await chrome.runtime.sendMessage({type,payload});if(!r?.ok)throw new Error(r?.error||'No se pudo guardar el archivo.');return r.value;}
function values(){const out={types:[...document.querySelectorAll('input[name=type]:checked')].map(x=>x.value)};for(const id of optionsIds)out[id]=$(id).type==='checkbox'?$(id).checked:$(id).value;return out;}
function savePrefs(){void chrome.storage.local.set({preferences:values()});}
function persist(){return engine?engine.save():Promise.resolve();}
function downloaded(item){return !!S.history[`history:${S.context?.key}:${item.id}`];}
function total(items){return items.reduce((n,x)=>n+(x.size||0),0);}
function canDownload(){return !S.busy && !engine?.running.size && S.scopeOK && S.scan?.status!=='running' && !hasWork(S.queue);}
function updateSelection(){
  const eligible=S.items.filter(x=>!$('skipDone').checked||!downloaded(x));
  const chosen=S.items.filter(x=>S.selected.has(x.id));
  $('selectedCount').textContent=`${chosen.length.toLocaleString('es-AR')} seleccionados`;
  const unknown=chosen.filter(x=>x.size==null).length;
  $('selectedSize').textContent=chosen.length?`${C.formatBytes(total(chosen))}${unknown?` + ${unknown} sin tamaño`:''}`:'Elegí los archivos de tu lote';
  $('download').disabled=!chosen.length||!canDownload();
  $('selectAll').disabled=!eligible.length;
  $('selectAll').checked=!!eligible.length&&eligible.every(x=>S.selected.has(x.id));
  $('selectAll').indeterminate=eligible.some(x=>S.selected.has(x.id))&&!$('selectAll').checked;
  $('export').disabled=!S.items.length;
  const zip=$('outputMode').value==='zip';$('zipPartGiB').disabled=!zip;$('zipSaveMode').disabled=!zip;$('chooseZipFolder').disabled=!zip||hasWork(S.queue);$('zipFolderName').textContent=destination.handle?`Carpeta ZIP: ${destination.handle.name}`:'Al iniciar un ZIP, elegís su carpeta de destino.';
  const cap=Number($('zipPartGiB').value)*1073741824;
  const count=zip&&chosen.length&&C.zipEligible(chosen)&&cap>0?C.zipParts(chosen,cap).length:null;
  $('zipPlan').textContent=zip?`${count?`Al menos ${count} ZIP · `:''}Se ajusta al espacio temporal disponible. Cada parte se abre por separado. Un archivo mayor al tamaño elegido ocupa su propio ZIP.`:'Elegí ZIP para guardar el lote en una o varias partes.';
}
function sorted(){const query=$('filterResults').value.trim().toLocaleLowerCase('es'),a=S.items.filter(x=>!query||`${x.name} ${x.caption||''}`.toLocaleLowerCase('es').includes(query)),sort=$('sort').value;a.sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name,'es'):sort==='biggest'?(a,b)=>(b.size||0)-(a.size||0):sort==='oldest'?(a,b)=>a.date-b.date:(a,b)=>b.date-a.date);return a;}
function setListDensity(value){const chosen=['normal','compact','minimal'].includes(value)?value:'normal';$('listDensity').value=chosen;$('compact').checked=chosen!=='normal';}
function renderList(){
  $('resultCount').textContent=S.items.length.toLocaleString('es-AR');
  const list=$('fileList'),scrollBefore=list.scrollTop,density=$('listDensity').value;list.replaceChildren();list.classList.toggle('compact-list',density!=='normal');list.classList.toggle('minimal-list',density==='minimal');
  if(!S.items.length){
    const box=document.createElement('div');box.className='empty';
    const symbol=document.createElement('div');symbol.className='empty-symbol';symbol.textContent='▤';
    const title=document.createElement('strong');title.textContent=S.scan?.status==='done'?'No encontramos archivos con esos filtros':'Tu próximo lote empieza acá';
    const p=document.createElement('p');p.textContent=S.scan?.status==='done'?'Probá ampliar las fechas o cambiar el tipo de archivo.':'Buscá en el tema abierto y elegí todos los archivos con un clic.';
    box.append(symbol,title,p);list.append(box);
  }
  for(const item of sorted().slice(0,S.visible)){
    const label=document.createElement('label');label.className='file-row';label.title=item.name;
    const check=document.createElement('input');check.type='checkbox';check.checked=S.selected.has(item.id);check.setAttribute('aria-label',`Seleccionar ${item.name}`);check.disabled=$('skipDone').checked&&downloaded(item);
    check.addEventListener('change',()=>{S.allMode=false;check.checked?S.selected.add(item.id):S.selected.delete(item.id);updateSelection();});
    const icon=document.createElement('span');icon.className=`type-icon ${item.type}`;icon.textContent=icons[item.type];
    const info=document.createElement('div');info.className='file-info';
    const name=document.createElement('div');name.className='file-name';name.textContent=item.name;
    const meta=document.createElement('div');meta.className='file-meta';meta.textContent=`${C.formatBytes(item.size)} · ${dateFormat.format(new Date(item.date*1000))} · ${item.ext.toUpperCase()||C.TYPES[item.type]}`;
    const heading=document.createElement('div');heading.className='file-heading';heading.append(name);if(downloaded(item)){const badge=document.createElement('span');badge.className='downloaded-indicator';badge.textContent='✓';badge.title='Ya descargado con esta extensión';badge.setAttribute('aria-label',badge.title);heading.append(badge);}info.append(heading,meta);label.title=`${item.name}\n${meta.textContent}${downloaded(item)?'\nYa descargado con esta extensión':''}`;
    if(downloaded(item)){const d=document.createElement('div');d.className='done-tag';d.textContent='✓ Ya descargado con esta extensión';info.append(d);}
    const actions=document.createElement('div');actions.className='file-actions';const jump=document.createElement('button');jump.className='text-button';jump.type='button';jump.textContent=density==='minimal'?'↗':'Mensaje ↗';jump.title='Abrir mensaje en Telegram';jump.setAttribute('aria-label',jump.title);jump.disabled=!S.scopeOK;jump.addEventListener('click',e=>{e.preventDefault();void openMessage(item);});actions.append(jump);if(['image','video'].includes(item.type)){const view=document.createElement('button');view.type='button';view.className='text-button';view.textContent=density==='minimal'?'▧':'Vista previa';view.title='Vista previa';view.setAttribute('aria-label',view.title);view.disabled=!S.scopeOK;view.addEventListener('click',e=>{e.preventDefault();void showPreview(item);});actions.append(view);if($('thumbnails').checked&&density!=='minimal'){const cached=S.previews.get(S.context.key+':'+item.id);if(cached){const image=document.createElement('img');image.className='thumbnail';image.src=cached;image.alt='';label.append(check,image,info,actions);list.append(label);continue;}void requestPreview(item,icon);}}label.append(check,icon,info,actions);list.append(label);
  }
  $('showMore').hidden=S.items.length<=S.visible;
  $('showMore').textContent=`Mostrar 100 más (${Math.min(S.visible,S.items.length)} de ${S.items.length})`;
  list.scrollTop=scrollBefore;updateSelection();
}
function renderScope(){
  $('connectionDot').classList.toggle('connected',S.scopeOK);
  $('connectionLabel').textContent=S.scopeOK?(S.context?.threadId?'CONECTADO AL TEMA ABIERTO':'CONECTADO AL CANAL'):S.context?'CAMBIÓ LA PESTAÑA O EL TEMA':'SIN CONECTAR';
  $('channelTitle').textContent=S.context?.channel||'Abrí tu canal en Telegram';
  $('topicTitle').textContent=S.context?(S.context.threadId?`Tema: ${S.context.topic}`:'Canal completo · sin temas'):'Elegí un tema si el grupo tiene temas.';
  $('scopeNote').textContent=S.context?.threadId?`Solo este tema · ID ${S.context.serverThreadId}. No incluye archivos de otros temas.`:'La búsqueda se limita al canal o tema abierto.';if(S.context?.restricted)$('scopeNote').textContent+=' · Guardado restringido: intento habilitado.';
  $('scan').textContent=S.context?.threadId?'⌕  Buscar archivos de este tema':'⌕  Buscar archivos del canal';
  $('scan').disabled=!!S.busy||!S.scopeOK||S.scan?.status==='running'||hasWork(S.queue);$('saveFavorite').disabled=!S.context;$('loadFavorite').disabled=!S.context;$('deleteFavorite').disabled=!S.context;
  $('connect').textContent=S.context?'Actualizar canal / tema abierto ↗':'Conectar con la pestaña abierta ↗';
  updateSelection();
}
function renderScan(){
  const scan=S.scan;
  $('stopScan').hidden=scan?.status!=='running';
  if(!scan){$('scanStatus').textContent=S.context?'Listo para buscar en el historial.':'Conectá Telegram para empezar.';return;}
  $('scanStatus').textContent=scan.status==='running'?`${scan.phase} · ${scan.found} archivos encontrados`:scan.status==='done'?`${scan.found} archivos encontrados${scan.truncated?' · se alcanzó el límite: ampliá el límite o filtrá por fecha.':' · búsqueda completa.'}`:scan.status==='stopped'?`${scan.found} archivos · búsqueda detenida.`:`Búsqueda interrumpida: ${scan.error}`;
  if(scan.error)notice(scan.error);
  renderScope();
}

function renderQueue(){
  const q=S.queue;if(S.busy==='queue'){$('queueSection').hidden=false;$('queueStatus').textContent='INICIANDO';return;}$('queueSection').hidden=!q;if(!q)return;
  const jobs=q.jobs,done=jobs.filter(j=>j.status==='done').length,errors=jobs.filter(j=>j.status==='error').length,pending=jobs.filter(j=>['pending','waiting'].includes(j.status)).length;
  const terminal=!hasWork(q),known=jobs.every(j=>j.total!=null),denom=jobs.reduce((n,j)=>n+(j.total||0),0);
  const bytes=jobs.reduce((n,j)=>n+Math.min(j.bytes||0,j.total||Infinity),0),fraction=known&&denom?bytes/denom:jobs.reduce((n,j)=>n+(j.status==='done'?1:j.total?j.bytes/j.total:0),0)/jobs.length;
  $('overallBar').style.width=`${Math.min(100,Math.round(fraction*100))}%`;
  $('queueStatus').textContent=q.archiveStatus==='error'||terminal&&errors?'CON ERRORES':terminal?(jobs.every(j=>j.status==='cancelled')?'CANCELADO':'FINALIZADO'):q.paused?'PAUSADO':q.archiveStatus==='packing'?'ARMANDO ZIP':q.archiveStatus==='delivering'&&q.options.zipSaveMode==='folder'?'GUARDANDO ZIP':'DESCARGANDO';
  $('queueDetail').textContent=`${done} de ${jobs.length} guardados${errors?` · ${errors} con error`:''}${pending?` · ${pending} pendientes`:''}${q.mode==='zip'?` · Parte ${Math.min((q.currentPart||0)+1,q.parts?.length||1)} de ${q.parts?.length||1} · ZIP ${q.archiveStatus==='packing'?`${C.formatBytes(q.archiveBytes)} / ${C.formatBytes(q.archiveTotal)}`:q.options.zipSaveMode==='folder'?`en ${q.destinationName}`:'del tema abierto'}`:''}`;
  $('speed').textContent=q.paused?'Pausado':engine.speed?`${C.formatBytes(engine.speed)}/s`:'Calculando velocidad…';
  const remain=jobs.filter(j=>!['done','staged','saving','cancelled','error'].includes(j.status)).reduce((n,j)=>n+Math.max(0,(j.total||0)-(j.bytes||0)),0);
  $('eta').textContent=q.paused?'Retomá desde el tema original':engine.speed&&known?`Restante aprox.: ${C.formatDuration(remain/engine.speed)}`:'Tiempo estimado: calculando…';
  $('pause').hidden=terminal;$('pause').textContent=q.paused?'Reanudar':'Pausar';$('pause').disabled=q.paused&&!S.scopeOK;
  $('cancel').hidden=terminal;$('retry').hidden=!errors&&q.archiveStatus!=='error';$('retry').disabled=!S.scopeOK||!!engine.running.size;
  $('openFolder').hidden=!q.archiveId&&!jobs.some(j=>j.status==='done'&&j.downloadId);
  $('openArchive').hidden=q.archiveStatus!=='done'||q.options.zipSaveMode==='folder';
  const list=$('queueFiles');list.replaceChildren();
  for(const j of [...jobs.filter(j=>['transfer','waiting','saving','error'].includes(j.status)),...jobs.filter(j=>!['transfer','waiting','saving','error'].includes(j.status))].slice(0,80)){
    const row=document.createElement('div');row.className=`queue-line ${j.status}`;
    const name=document.createElement('span');name.textContent=j.item.name;const state=document.createElement('span');
    const percent=j.total?Math.min(100,Math.round(j.bytes/j.total*100)):0;
    state.textContent=({pending:j.bytes?'Pendiente · conserva bloques':'En cola',waiting:`Reintento en ${Math.max(0,Math.ceil((j.retryAt-Date.now())/1000))} s`,transfer:`${percent}% · ${C.formatBytes(j.bytes)}`,delivering:'Preparando guardado',saving:'Guardando en Chrome',staged:'✓ Listo para ZIP',done:'✓ Guardado',error:'Error',cancelled:'Cancelado'})[j.status];
    row.append(name,state);const progress=document.createElement('div');progress.className='job-progress';const bar=document.createElement('span');bar.style.width=(j.status==='done'?100:percent)+'%';progress.append(bar);row.append(progress);
    if(j.status==='done'&&j.downloadId){const actions=document.createElement('div');actions.className='job-actions';for(const [label,action] of [['Abrir',()=>chrome.downloads.open(j.downloadId)],['Carpeta',()=>chrome.downloads.show(j.downloadId)]]){const b=document.createElement('button');b.className='text-button';b.textContent=label;b.addEventListener('click',()=>Promise.resolve(action()).catch(e=>notice(e.message)));actions.append(b);}row.append(actions);}
    if(j.error){const detail=document.createElement('p');detail.className='queue-error';detail.textContent=j.error;row.append(detail);}list.append(row);
  }
  if(q.mode==='zip'&&q.options.zipSaveMode==='folder'&&q.parts){for(const [i,part] of q.parts.entries()){if(part.status!=='done')continue;const p=document.createElement('p');p.className='hint';p.textContent=`✓ Parte ${i+1}: ${part.savedName} · ${q.destinationName}`;list.append(p);}}
  if(q.mode==='zip'&&q.options.zipSaveMode!=='folder'&&q.parts){for(const [i,part] of q.parts.entries()){if(part.status!=='done')continue;const row=document.createElement('div');row.className='job-actions';const name=document.createElement('span');name.textContent=`✓ ZIP · Parte ${i+1}`;row.append(name);for(const [label,action] of [['Abrir',()=>chrome.downloads.open(part.downloadId)],['Carpeta',()=>chrome.downloads.show(part.downloadId)]]){const b=document.createElement('button');b.className='text-button';b.textContent=label;b.addEventListener('click',()=>Promise.resolve(action()).catch(e=>notice(e.message)));row.append(b);}list.append(row);}}
  if(q.zipNote){const p=document.createElement('p');p.className='hint';p.textContent=q.zipNote;list.append(p);}
  if(q.archiveError){const p=document.createElement('p');p.className='queue-error';p.textContent=q.archiveError;list.append(p);}
  renderScope();
}

async function bind(tabId){
  await chrome.scripting.executeScript({target:{tabId},world:'MAIN',files:['core.js','page.js']});
  await call('configure',{allowRestricted:$('allowRestricted').checked},tabId);
  const ctx=await call('hello',{},tabId);
  if(hasWork(S.queue)&&S.queue.context.key!==ctx.key)throw new Error('Hay una cola del tema anterior. Volvé a ese tema para reanudar o cancelá los pendientes.');
  if(S.context?.key!==ctx.key){S.items=[];S.known.clear();S.selected.clear();S.scan=null;S.scanId=null;S.visible=100;S.previews.clear();}
  S.tabId=tabId;S.context=ctx;S.scopeOK=true;if(S.queue?.context.key===ctx.key){S.queue.tabId=tabId;S.queue.context=ctx;}
  S.history=await chrome.storage.local.get(null);
  notice('');renderFavorites();renderScope();renderList();renderScan();await persist();
}
async function connect(){
  try{
    const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(!tab?.url?.startsWith('https://web.telegram.org/k/'))throw new Error('Abrí https://web.telegram.org/k/, entrá al canal o tema y volvé a conectar.');
    await bind(tab.id);await poll();
  }catch(e){notice(e.message);}
}
function filters(){
  const v=values();
  if(!v.types.length)throw new Error('Seleccioná al menos un tipo de archivo.');
  let minDate=v.dateFrom?Math.floor(new Date(v.dateFrom+'T00:00:00').getTime()/1000):0;
  const end=v.dateTo?new Date(v.dateTo+'T00:00:00'):null;if(end)end.setDate(end.getDate()+1);
  if(v.quickMode==='new'){const since=S.history[`lastDownload:${S.context.key}`];if(since)minDate=Math.max(minDate,since);else notice('Todavía no hay una descarga anterior en este tema. Se buscará el historial completo.',true);}
  const maxDate=end?Math.floor(end.getTime()/1000):0;
  if(minDate&&maxDate&&minDate>=maxDate)throw new Error('La fecha Desde debe ser anterior o igual a Hasta.');
  const minSize=Math.max(0,Number(v.minSize)||0)*1048576,maxSize=Math.max(0,Number(v.maxSize)||0)*1048576;
  if(minSize&&maxSize&&minSize>maxSize)throw new Error('El tamaño mínimo no puede superar al máximo.');
  const extensions=v.extensions.toLowerCase().split(/[\s,;]+/).map(x=>x.replace(/^\*?\./,'')).filter(Boolean);
  if(extensions.some(x=>!/^[a-z0-9]{1,16}$/.test(x)))throw new Error('Escribí extensiones separadas por comas: pdf, zip, mp4.');
  return {types:v.types,query:v.query.trim(),extensions,minDate,maxDate,minSize,maxSize,limit:Number(v.limit),latestN:/^\d+$/.test(v.quickMode)?Number(v.quickMode):0};
}
async function startScan(){
  const previous=S.scan;
  try{
    const f=filters();S.busy='scan';S.scan={status:'running',found:0,phase:'Conectando con Telegram'};renderScan();S.history=await chrome.storage.local.get(null);const ctx=await call('startScan',{filters:f});
    S.context=ctx;S.scanId=ctx.scanId;S.items=[];S.known.clear();S.selected.clear();S.allMode=true;S.visible=100;S.scan={status:'running',found:0,phase:'Iniciando búsqueda'};engine.q=null;S.queue=null;
    notice('');renderList();renderQueue();renderScan();savePrefs();await persist();
  }catch(e){S.scan=previous;notice(e.message);}
  finally{S.busy=false;renderScan();renderScope();}
}

async function authorizeDestination(q=null){
  const previous=destination.handle;await destination.authorize();
  if(q){
    if(!previous||!await previous.isSameEntry(destination.handle))for(const part of q.parts||[])if(part.status!=='done'){delete part.savedName;delete part.expectedSize;part.status='pending';}
    await destination.attach(q.id);q.destinationName=destination.handle.name;
  }
}
async function startQueue(){
  try{
    if($('outputMode').value==='zip'&&$('zipSaveMode').value==='folder')await destination.authorize();
    S.busy='queue';renderScope();renderQueue();
    const current=await call('hello');if(current.key!==S.context?.key)throw new Error('Cambiaste de tema. Conectá y buscá de nuevo.');
    S.history=await chrome.storage.local.get(null);const items=sorted().filter(x=>S.selected.has(x.id)&&(!$('skipDone').checked||!downloaded(x))).map(({caption,...item})=>item);
    if(!items.length)throw new Error('No hay archivos nuevos seleccionados.');
    await engine.start(items,S.context,S.tabId,{folder:$('folder').value,byType:$('byType').checked,addId:$('addId').checked,mode:$('outputMode').value,zipPartGiB:$('zipPartGiB').value,zipSaveMode:$('zipSaveMode').value,parallel:Number($('parallel').value),maxRetries:Number($('maxRetries').value),notify:$('notify').checked,allowRestricted:$('allowRestricted').checked});
    S.queue=engine.q;notice('');renderQueue();void poll();
  }catch(e){if(e.name!=='AbortError')notice(e.message);}
  finally{S.busy=false;renderScope();renderQueue();}
}
async function processQueue(){
  await engine.tick();S.queue=engine.q;
  const done=S.queue?.jobs.filter(j=>j.status==='done').length||0;
  if(done!==lastDone){lastDone=done;S.history=await chrome.storage.local.get(null);for(const j of S.queue?.jobs||[])if(j.status==='done')S.selected.delete(j.item.id);renderList();}
}

async function poll(){
  if(S.polling||!S.tabId)return;S.polling=true;
  try{
    const [active]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    let snapshot=await call('snapshot',{from:S.items.length});
    const valid=active?.id===S.tabId&&snapshot.liveKey===S.context?.key;
    if(S.scopeOK&&!valid){
      if(S.queue)await engine.pause();
      if(S.scan?.status==='running')await call('stopScan').catch(()=>{});
      await persist();notice('Cambiaste de pestaña, canal o tema. Las nuevas descargas están pausadas. Volvé al tema original para reanudar o cancelá los pendientes.',true);
    }
    const previouslyValid=S.scopeOK;S.scopeOK=valid;
    if(valid&&!previouslyValid)notice('Volviste al tema original. Podés reanudar la cola.',true);
    if(snapshot.scan.status==='done'&&S.scan?.status!=='done'&&snapshot.context?.key===S.context?.key){snapshot=await call('snapshot',{from:0});S.items=[];S.known.clear();S.selected.clear();S.allMode=true;}
    if(snapshot.scan.status!=='idle'&&snapshot.context?.key===S.context?.key&&(S.scanId===null||snapshot.scanId===S.scanId)){
      S.scanId=snapshot.scanId;
      let added=false;
      for(const item of snapshot.items){if(S.known.has(item.id))continue;S.known.add(item.id);S.items.push(item);if(S.allMode&&(!$('skipDone').checked||!downloaded(item)))S.selected.add(item.id);added=true;}
      S.scan=snapshot.scan;renderScan();if(added)renderList();
    }
    await processQueue();renderScope();
  }catch(e){
    S.scopeOK=false;if(S.queue)await engine.pause();
    notice('Se perdió la conexión con Telegram. Abrí el mismo tema, conectá y reanudá; los bloques guardados se conservan.');renderScope();renderQueue();
  }finally{S.polling=false;}
}
async function cancelPending(){await engine.cancel();renderQueue();}
function csvCell(x){let t=String(x??'');if(/^[\s]*[=+@-]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';}
function exportCSV(){
  const rows=[['Grupo / canal','Tema','Mensaje','Archivo','Tipo','Extensión','Tamaño (bytes)','Fecha','Ya descargado','Estado','Error']];
  for(const item of sorted()){const job=S.queue?.jobs.find(j=>j.item.id===item.id);rows.push([S.context.channel,S.context.topic,item.messageId,item.name,C.TYPES[item.type],item.ext,item.size,new Date(item.date*1000).toISOString(),downloaded(item)?'Sí':'No',job?.status||'',job?.error||'']);}
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`Telegram_Lote_${C.safeSegment(S.context.topic||S.context.channel)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
$('connect').addEventListener('click',connect);$('scan').addEventListener('click',startScan);$('download').addEventListener('click',startQueue);
$('stopScan').addEventListener('click',async()=>{await call('stopScan');await poll();});
$('selectAll').addEventListener('change',()=>{S.allMode=$('selectAll').checked;S.selected.clear();if(S.allMode)for(const x of S.items)if(!$('skipDone').checked||!downloaded(x))S.selected.add(x.id);renderList();});
$('allTypes').addEventListener('click',()=>{const inputs=[...document.querySelectorAll('input[name=type]')],enable=!inputs.every(x=>x.checked);for(const x of inputs)x.checked=enable;savePrefs();});
$('sort').addEventListener('change',renderList);$('showMore').addEventListener('click',()=>{S.visible+=100;renderList();});
$('export').addEventListener('click',exportCSV);$('pause').addEventListener('click',async()=>{try{if(S.queue.paused&&S.queue.mode==='zip'&&S.queue.options.zipSaveMode==='folder')await authorizeDestination(S.queue);await engine.pause(!S.queue.paused);renderQueue();void poll();}catch(e){notice(e.message);}});$('cancel').addEventListener('click',cancelPending);
$('retry').addEventListener('click',async()=>{try{if(S.scopeOK){
  if(S.queue.mode==='zip'&&$('zipSaveMode').value==='folder'){
    await authorizeDestination(S.queue);S.queue.options.zipSaveMode='folder';
  }await engine.retry();void poll();}}catch(e){notice(e.message);}});
$('help').addEventListener('click',()=>$('helpDialog').showModal());$('closeHelp').addEventListener('click',()=>$('helpDialog').close());
for(const id of optionsIds)$(id).addEventListener('change',async()=>{if(id==='compact')setListDensity($(id).checked?'compact':'normal');if(id==='listDensity')setListDensity($(id).value);savePrefs();updateSelection();if(id==='parallel'&&engine.q){await engine.setParallel($(id).value);renderQueue();}if(id==='skipDone'){for(const item of S.items)if(downloaded(item)){$('skipDone').checked?S.selected.delete(item.id):(S.allMode&&S.selected.add(item.id));}renderList();}if(['compact','listDensity','thumbnails'].includes(id))renderList();if(id==='allowRestricted'){if(S.queue)await engine.pause();if(S.tabId){await call('configure',{allowRestricted:$('allowRestricted').checked}).catch(()=>{});void connect();}}});
for(const x of document.querySelectorAll('input[name=type]'))x.addEventListener('change',savePrefs);
async function init(){
  const stored=await chrome.storage.local.get(null);S.history=stored;
  if(stored.preferences){const p=stored.preferences;for(const id of optionsIds)if(p[id]!=null){$(id).type==='checkbox'?$(id).checked=p[id]:$(id).value=p[id];}if(p.types)for(const x of document.querySelectorAll('input[name=type]'))x.checked=p.types.includes(x.value);}
  setListDensity(stored.preferences?.listDensity||(stored.preferences?.compact?'compact':'normal'));
  if(typeof showDirectoryPicker!=='function'){$('zipSaveMode').querySelector('[value=folder]').disabled=true;$('zipSaveMode').value='downloads';$('chooseZipFolder').hidden=true;}
  S.queue=await engine.load();if(S.queue){S.context=S.queue.context;S.tabId=S.queue.tabId;S.items=S.queue.jobs.map(j=>j.item);S.known=new Set(S.items.map(x=>x.id));}
  const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  if(tab?.url?.startsWith('https://web.telegram.org/k/')){
    try{await bind(tab.id);if(S.queue&&S.queue.context.key!==S.context.key)notice('Hay una cola de otro tema. Volvé al tema original para reanudar o cancelá sus pendientes.',true);}catch(e){notice(e.message);}
  }
  renderScope();renderQueue();await poll();
  setInterval(poll,850);
}

function renderFavorites(){const select=$('favorite');select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Mis filtros de este tema';select.append(placeholder);const saved=S.history[`favorites:${S.context?.key}`]||{};for(const name of Object.keys(saved)){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}}
async function openMessage(item){try{await call('openMessage',{item,contextKey:S.context.key});}catch(e){notice(e.message);}}

const previewTasks=[];let previewActive=0;
function drainPreviews(){while(previewActive<3&&previewTasks.length){const task=previewTasks.shift();previewActive++;void task().finally(()=>{previewActive--;drainPreviews();});}}
async function requestPreview(item,target){
  if(!S.scopeOK)return null;const key=S.context.key,cacheKey=key+':'+item.id;
  if(S.previews.has(cacheKey))return S.previews.get(cacheKey);if(S.previewPending.has(cacheKey))return S.previewPending.get(cacheKey);
  let resolve;const promise=new Promise(r=>resolve=r);S.previewPending.set(cacheKey,promise);
  previewTasks.push(async()=>{let data=null;try{if(S.context?.key===key&&S.scopeOK)data=await call('preview',{item,contextKey:key});}catch{}finally{S.previewPending.delete(cacheKey);}
    if(S.context?.key===key){S.previews.set(cacheKey,data);if(data&&target?.isConnected){const img=document.createElement('img');img.className='thumbnail';img.alt='';img.src=data;target.replaceWith(img);}}
    resolve(data);});drainPreviews();return promise;
}

async function showPreview(item){S.previewItem=item;$('previewName').textContent=item.name;$('previewMeta').textContent=`${C.formatBytes(item.size)} · ${dateFormat.format(new Date(item.date*1000))}`;$('previewImage').hidden=true;$('previewDialog').showModal();const data=await requestPreview(item);if(S.previewItem?.id!==item.id)return;if(data){$('previewImage').src=data;$('previewImage').hidden=false;}else $('previewMeta').textContent+=' · Sin miniatura disponible. Podés abrir el mensaje original.';}
$('closePreview').addEventListener('click',()=>{$('previewDialog').close();S.previewItem=null;});$('previewMessage').addEventListener('click',()=>{if(S.previewItem)void openMessage(S.previewItem);});
$('filterResults').addEventListener('input',renderList);
$('saveFavorite').addEventListener('click',async()=>{if(!S.context)return;const name=$('favoriteName').value.trim()||'Mis filtros';const key=`favorites:${S.context.key}`,saved={...(S.history[key]||{}),[name]:values()};await chrome.storage.local.set({[key]:saved});S.history[key]=saved;renderFavorites();$('favorite').value=name;notice('Filtros guardados para este tema.',true);});
$('loadFavorite').addEventListener('click',()=>{const p=S.history[`favorites:${S.context?.key}`]?.[$('favorite').value];if(!p)return;for(const id of optionsIds)if(p[id]!=null)$(id).type==='checkbox'?$(id).checked=p[id]:$(id).value=p[id];for(const x of document.querySelectorAll('input[name=type]'))x.checked=p.types.includes(x.value);setListDensity(p.listDensity||(p.compact?'compact':'normal'));savePrefs();if(S.tabId)void call('configure',{allowRestricted:$('allowRestricted').checked});renderList();});
$('deleteFavorite').addEventListener('click',async()=>{const name=$('favorite').value;if(!name||!S.context)return;const key=`favorites:${S.context.key}`,saved={...(S.history[key]||{})};delete saved[name];await chrome.storage.local.set({[key]:saved});S.history[key]=saved;renderFavorites();});
$('openFolder').addEventListener('click',()=>{const id=S.queue.archiveId||S.queue.jobs.find(j=>j.status==='done'&&j.downloadId)?.downloadId;if(id!=null)chrome.downloads.show(id);});
$('openArchive').addEventListener('click',()=>{if(S.queue?.archiveStatus==='done')void chrome.downloads.open(S.queue.archiveId).catch(e=>notice(e.message));});
$('chooseZipFolder').addEventListener('click',async()=>{try{await destination.choose();updateSelection();}catch(e){if(e.name!=='AbortError')notice(e.message);}});
$('cleanCache').addEventListener('click',async()=>{try{await engine.cleanup();notice('Temporales liberados. Tus descargas y favoritos se conservan.',true);}catch(e){notice(e.message);}});

let paintTimer=null,lastPaint=0;
function queueChanged(){S.queue=engine.q;if(paintTimer!==null)return;const delay=Math.max(0,250-(performance.now()-lastPaint));paintTimer=setTimeout(()=>{paintTimer=null;lastPaint=performance.now();renderQueue();},delay);}
engine=new TGLEngine({call,message,destination,isScopeOK:q=>S.scopeOK&&S.context?.key===q.context.key,onUpdate:queueChanged});
void init().catch(e=>notice(e.message));
