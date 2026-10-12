/* Browser integration with a controlled Telegram fixture and simulated extension APIs. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..');
const source=fs.existsSync(path.join(root,'telegram-lote-v2/manifest.json'))?path.join(root,'telegram-lote-v2'):root;
for(const dir of ['artifacts','research'])fs.mkdirSync(path.join(root,dir),{recursive:true});
let runningBrowser,runningPanel;
(async()=>{
 const context=await chromium.launchPersistentContext(path.join(root,'research',process.env.TG_TEST_PROFILE||'v2-profile'),{viewport:{width:420,height:1180},acceptDownloads:true,executablePath:process.env.TG_TEST_BROWSER||(fs.existsSync('/tmp/tg-chromium/chromium')?'/tmp/tg-chromium/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const browser=context;runningBrowser=browser;context.setDefaultTimeout(90000);let currentPanel;
 const telegram=await context.newPage();
 await telegram.route('https://web.telegram.org/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><title>Telegram fixture</title></head><body>Controlled test fixture</body></html>'}));
 await telegram.goto('https://web.telegram.org/k/');
 await context.route('https://extension.test/**',route=>{const file=new URL(route.request().url()).pathname.slice(1);const p=path.join(source,file);if(!fs.existsSync(p))return route.abort();return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'image/png',body:fs.readFileSync(p)});});
 await telegram.evaluate(()=>{
  const files=[['Planos_Planta_G16.pdf','application/pdf',748032],['Remitos_octubre.zip','application/zip',2097152],['Inventario_2026.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',52224],['Recorrido_almacen.mp4','video/mp4',4194304],['Foto_estanterias.jpg','image/jpeg',1048576],['Nota_de_voz.ogg','audio/ogg',65536]];
  const rows=files.map(([file_name,mime_type,size],i)=>({_:'message',id:900-i,date:1791752400-i*86400,reply_to:{reply_to_top_id:321,pFlags:{forum_topic:true}},peer_id:{_: 'peerChannel',channel_id:42},media:{document:{_: 'document',id:String(900-i),mime_type,size,file_name,attributes:[{_:'documentAttributeFilename',file_name}]}},message:'Archivos de prueba'}));
  rows.push({...rows[0],id:888,reply_to:{reply_to_top_id:444,pFlags:{forum_topic:true}},media:{document:{...rows[0].media.document,id:'888',file_name:'NO_DEBE_APARECER.pdf'}}});
  window.__rows=rows;window.__requests=[];window.__chunkLog=[];window.__failId='';window.__failCount=0;window.__protected=false;window.__opened=[];

  const pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const part=async(id,offset,limit)=>{window.__chunkLog.push({id:String(id),offset,limit});await new Promise(r=>setTimeout(r,110));if(window.__failId===String(id)&&window.__failCount-->0)throw new Error('NETWORK_TEST_ERROR');const row=window.__rows.find(x=>String(x.media?.document?.id)===String(id));if(!row)throw new Error('FILE_NOT_FOUND');return {bytes:new Uint8Array(Math.max(0,Math.min(limit,row.media.document.size-offset))).fill(97)};};
  for(const row of rows)if(['video/mp4','image/jpeg'].includes(row.media?.document?.mime_type))row.media.document.thumbs=[{_:'photoSize',type:'s',w:100,h:100,size:80}];
  const m={apiManager:{invokeApi:async(method,args)=>{window.__requests.push({method,...args});await new Promise(r=>setTimeout(r,30));if(method==='channels.getMessages'||method==='messages.getMessages')return {messages:structuredClone(window.__rows.filter(x=>args.id.some(a=>a.id===x.id)))};return {messages:args.offset_id?[]:structuredClone(window.__rows),count:window.__rows.length};}},appPeersManager:{getPeer:()=>({title:'Almacén · Galpón 16',pFlags:{forum:true,noforwards:window.__protected}}),isForum:()=>true,noForwards:()=>window.__protected,getInputPeerById:()=>({_:'inputPeerChannel',channel_id:42,access_hash:'x'})},appMessagesIdsManager:{getMessageIdInfo:mid=>({messageId:mid%4294967296})},appMessagesManager:{saveMessages:rows=>rows.map(x=>({...x,mid:x.id+4294967296}))},dialogsStorage:{getForumTopic:()=>({title:window.appImManager.chat.threadId===4294967617?'Documentación':'Otro tema'})},appDocsManager:{requestDocPart:(id,dc,offset,limit)=>part(id,offset,limit)},apiFileManager:{requestFilePart:args=>part(args.location.id,args.offset,args.limit)}};

  window.appImManager={chat:{peerId:-42,threadId:4294967617,isForum:true},managers:m};window.rootScope={myId:99,managers:m};
  window.appDownloadManager={downloadMedia:()=>Promise.resolve(new Blob([Uint8Array.from(atob(pixel),c=>c.charCodeAt(0))],{type:'image/png'}))};window.appImManager.setInnerPeer=options=>{window.__opened.push(options);return true;};
 });
 const local={},session={},downloads=new Map();let active=1,idSeq=1;const changed=[];let workerListener;const notifications=[],shown=[],openedFiles=[];
 async function exec({files,source:code,args=[]}){
  if(files){for(const file of files)await telegram.addScriptTag({path:path.join(source,file)});return [{}];}
  return [{result:await telegram.evaluate(({source,args})=>(0,eval)(`(${source})`)(...args),{source:code,args})}];
 }
 function storage(data){return {get:async(keys)=>keys==null?structuredClone(data):Object.fromEntries((typeof keys==='string'?[keys]:keys).filter(k=>k in data).map(k=>[k,structuredClone(data[k])])),set:async(o)=>{Object.assign(data,structuredClone(o));},remove:async(k)=>{for(const x of Array.isArray(k)?k:[k])delete data[x];}};}
 const api={runtime:{id:'test-extension',getURL:p=>'https://extension.test/'+p,onInstalled:{addListener:()=>{}},onStartup:{addListener:()=>{}},onMessage:{addListener:fn=>{workerListener=fn;}}},sidePanel:{setPanelBehavior:async()=>{}},notifications:{create:async(id,data)=>{notifications.push(data);return id;},onClicked:{addListener:()=>{}}},storage:{local:storage(local),session:storage(session)},tabs:{get:async()=>({id:1,url:'https://web.telegram.org/k/'}),query:async()=>[{id:active,url:active===1?'https://web.telegram.org/k/':'https://example.test/'}]},scripting:{executeScript:async p=>exec({...p,source:p.func?.toString()})},downloads:{show:id=>shown.push(id),open:async id=>openedFiles.push(id),resume:async()=>{throw new Error('Not resumable in fixture');},search:async({id})=>downloads.has(id)?[structuredClone(downloads.get(id))]:[],onChanged:{addListener:fn=>changed.push(fn)},download:async o=>{
  const id=idSeq++;downloads.set(id,{id,state:'in_progress',bytesReceived:0,totalBytes:0,filename:o.filename});
  const downloadEvent=currentPanel.waitForEvent('download');await currentPanel.evaluate(({url,filename})=>{const a=document.createElement('a');a.href=url;a.download=filename.split('/').at(-1);a.click();},o);
  const d=await downloadEvent;const output=path.join(root,'research','saved-'+id+'-'+d.suggestedFilename());await d.saveAs(output);
  assert.equal(await d.failure(),null);const bytes=fs.readFileSync(output);assert.ok(bytes.length>0);if(!o.filename.endsWith('.zip')){assert.equal(bytes[0],97);assert.equal(bytes.at(-1),97);}
  downloads.get(id).state='complete';downloads.get(id).bytesReceived=bytes.length;downloads.get(id).totalBytes=bytes.length;
  for(const fn of changed)fn({id,state:{current:'complete'}});return id;
 }}};
 const bg={chrome:api,console};vm.createContext(bg);bg.importScripts=file=>vm.runInContext(fs.readFileSync(path.join(source,file),'utf8'),bg);vm.runInContext(fs.readFileSync(path.join(source,'background.js'),'utf8'),bg);
 const runtimeMessage=message=>new Promise((resolve,reject)=>{try{const result=workerListener(message,{id:api.runtime.id,url:api.runtime.getURL('panel.html')},resolve);if(result!==true)reject(new Error('Rejected worker message'));}catch(e){reject(e);}});
 async function panelPage(){
  const p=await context.newPage();
  await p.exposeFunction('harness',async(kind,payload)=>{
   if(kind==='exec')return exec(payload);
   if(kind==='tabs')return api.tabs.query();
   if(kind==='getStorage')return api.storage[payload.area].get(payload.keys);
   if(kind==='setStorage')return api.storage[payload.area].set(payload.value);
   if(kind==='message')return runtimeMessage(payload);
   if(kind==='open'){openedFiles.push(payload);return;}if(kind==='show'){shown.push(payload);return;}
   if(kind==='downloadStatus')return api.downloads.search(payload);
  });
  await p.addInitScript(()=>{
   const st=area=>({get:keys=>window.harness('getStorage',{area,keys}),set:value=>window.harness('setStorage',{area,value})});
   window.chrome={storage:{local:st('local'),session:st('session')},tabs:{query:()=>window.harness('tabs')},scripting:{executeScript:p=>window.harness('exec',{files:p.files,source:p.func?.toString(),args:p.args})},runtime:{sendMessage:m=>window.harness('message',m)},downloads:{show:id=>window.harness('show',id),open:id=>window.harness('open',id),resume:()=>Promise.reject(new Error('No resume in fixture')),search:p=>window.harness('downloadStatus',p)}};
  });
const errors=[];p.on('pageerror',e=>errors.push(e.message));currentPanel=p;runningPanel=p;await p.goto('https://extension.test/panel.html');await p.waitForFunction(()=>document.getElementById('connectionLabel').textContent.includes('CONECTADO'));
  // Simulated download metadata: skip the real Chrome verification delay here; Node tests exercise it.
  await p.evaluate(()=>{const check=engine.checkArchive.bind(engine);engine.checkArchive=async q=>{const part=q.parts[q.currentPart];if(part){part.verifyAt=0;part.confirmAt=0;}return check(q);};});
  return {p,errors};
 }

 let {p,errors}=await panelPage();
 assert.equal(await p.evaluate(()=>typeof navigator.storage.getDirectory),'function');
 await p.locator('#scan').click();await p.waitForFunction(()=>document.getElementById('scanStatus').textContent.includes('búsqueda completa'));
 assert.equal(await p.locator('.file-row').count(),6);assert.equal(await p.locator('text=NO_DEBE_APARECER.pdf').count(),0);
 assert.ok(await telegram.evaluate(()=>window.__requests.filter(r=>r.method==='messages.search').every(r=>r.top_msg_id===321)));
 await p.waitForFunction(()=>document.querySelectorAll('.thumbnail').length===2);await p.locator('.file-actions button').first().click();assert.ok(await telegram.evaluate(()=>window.__opened.length>0));
 const normalHeight=await p.locator('.file-row').first().evaluate(el=>el.getBoundingClientRect().height);
 await p.locator('#listDensity').selectOption('compact');const compactHeight=await p.locator('.file-row').first().evaluate(el=>el.getBoundingClientRect().height);assert.ok(compactHeight<normalHeight);
 await p.locator('#listDensity').selectOption('minimal');const minimalHeight=await p.locator('.file-row').first().evaluate(el=>el.getBoundingClientRect().height);assert.ok(minimalHeight<compactHeight);assert.ok(minimalHeight<=32);assert.equal(await p.locator('#selectedCount').textContent(),'6 seleccionados');assert.equal(await p.locator('.thumbnail').count(),0);assert.equal(await p.locator('.file-actions button').first().getAttribute('aria-label'),'Abrir mensaje en Telegram');assert.equal(local.preferences.listDensity,'minimal');
 await p.setViewportSize({width:320,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.setViewportSize({width:420,height:1180});
 await p.locator('#listDensity').selectOption('normal');
 await p.locator('#favoriteName').fill('Solo PDF');await p.locator('#saveFavorite').click();assert.ok(local['favorites:99:-42:4294967617']['Solo PDF']);
 await p.locator('#advanced summary').click();await p.locator('#parallel').selectOption('2');await p.locator('#advanced summary').click();
 await p.setViewportSize({width:420,height:1490});await p.screenshot({path:path.join(root,'artifacts','Vista_Telegram_Lote_v2.png')});await p.setViewportSize({width:420,height:1180});
 await p.locator('#download').click();await p.waitForFunction(()=>document.getElementById('queueFiles').textContent.includes('KB'));
 await telegram.evaluate(()=>window.appImManager.chat.threadId=4294967740);await p.waitForFunction(()=>document.getElementById('queueStatus').textContent==='PAUSADO');const n=downloads.size;await p.waitForTimeout(1000);assert.equal(downloads.size,n);
 await telegram.evaluate(()=>window.appImManager.chat.threadId=4294967617);await p.waitForFunction(()=>!document.getElementById('pause').disabled);await p.locator('#pause').click();
 await p.waitForFunction(()=>document.getElementById('queueStatus').textContent==='FINALIZADO');assert.equal(downloads.size,6);assert.equal(Object.keys(local).filter(k=>k.startsWith('history:')).length,6);assert.ok(notifications.length>0);assert.ok(local['lastDownload:99:-42:4294967617']);
 assert.ok(await telegram.evaluate(()=>window.__chunkLog.every(x=>x.limit===512*1024)));assert.ok([...downloads.values()].every(x=>x.filename.includes('/Documentación/')));
 await p.locator('#openFolder').click();await p.locator('.job-actions button').first().click();await p.waitForTimeout(50);assert.ok(shown.length&&openedFiles.length);
 await p.locator('#scan').click();await p.waitForFunction(()=>document.getElementById('scanStatus').textContent.includes('búsqueda completa'));assert.equal(await p.locator('#selectedCount').textContent(),'0 seleccionados');
 // Automatic retry resumes the same file, with no duplicate successful download.
 await p.locator('#advanced summary').click();await p.locator('#skipDone').uncheck();await p.locator('#parallel').selectOption('1');await p.locator('#advanced summary').click();await p.locator('#selectAll').check();
 await telegram.evaluate(()=>{window.__failId='900';window.__failCount=1;});await p.locator('#download').click();await p.waitForFunction(()=>document.getElementById('queueFiles').textContent.includes('Reintento en'));await p.waitForFunction(()=>document.getElementById('queueStatus').textContent==='FINALIZADO');assert.equal(downloads.size,12);
 // ZIP is assembled on OPFS and only one Chrome download is created.
 await p.locator('#advanced summary').click();await p.locator('#outputMode').selectOption('zip');await p.locator('#zipSaveMode').selectOption('downloads');await p.locator('#advanced summary').click();await p.locator('#selectAll').check();await p.locator('#download').click();await p.waitForFunction(()=>document.getElementById('queueStatus').textContent==='FINALIZADO');assert.equal(downloads.size,13);
 const zipFile=fs.readdirSync(path.join(root,'research')).find(n=>n.startsWith('saved-13-')&&n.endsWith('.zip'));assert.ok(zipFile);
 const zipCheck=require('node:child_process').spawnSync('python3',['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert len(z.namelist())==6;assert all("/" not in n for n in z.namelist());assert z.testzip() is None;assert all(z.read(n)[0]==97 for n in z.namelist())',path.join(root,'research',zipFile)],{encoding:'utf8'});assert.equal(zipCheck.status,0,zipCheck.stderr);
 // Pending work survives closing the panel, and reads stored partial bytes on reopen.
 await p.locator('#advanced summary').click();await p.locator('#outputMode').selectOption('files');await p.locator('#advanced summary').click();await p.locator('#selectAll').check();await p.locator('#download').click();
 await p.waitForFunction(()=>document.getElementById('queueFiles').textContent.includes('KB'));await p.locator('#pause').click();await p.waitForTimeout(350);const before=structuredClone(local.queueV2);assert.ok(before.jobs.some(j=>j.bytes>0));assert.deepEqual(errors,[]);await p.close();({p,errors}=await panelPage());
 await p.waitForFunction(()=>document.getElementById('queueStatus').textContent==='PAUSADO');const logs=await telegram.evaluate(()=>window.__chunkLog.length);await p.locator('#pause').click();await p.waitForFunction(()=>document.getElementById('queueStatus').textContent==='FINALIZADO');
 const resumed=await telegram.evaluate(n=>window.__chunkLog.slice(n),logs);assert.ok(resumed.some(x=>x.offset>0),'partial OPFS data resumed instead of starting at zero');

 // Multi-part archives use real OPFS while a small reported quota forces splitting.
 await p.evaluate(()=>{window.__originalDiskCall=engine.disk.call.bind(engine.disk);engine.disk.call=(command,args,progress)=>command==='estimate'?Promise.resolve({quota:12*1048576,usage:0}):window.__originalDiskCall(command,args,progress);});
 await p.locator('#advanced summary').click();await p.locator('#outputMode').selectOption('zip');await p.locator('#zipSaveMode').selectOption('downloads');await p.locator('#advanced summary').click();await p.locator('#selectAll').check();const beforeParts=downloads.size;await p.locator('#download').click();
 await p.waitForFunction(()=>document.getElementById('queueStatus').textContent==='FINALIZADO');const qParts=structuredClone(local.queueV2);assert.ok(qParts.parts.length>1);assert.equal(downloads.size-beforeParts,qParts.parts.length);assert.ok(qParts.parts.every(x=>x.status==='done'));
 const archivePaths=qParts.parts.map(part=>path.join(root,'research',fs.readdirSync(path.join(root,'research')).find(n=>n.startsWith('saved-'+part.downloadId+'-')&&n.endsWith('.zip'))));
 const allZipCheck=require('node:child_process').spawnSync('python3',['-c','import zipfile,sys; names=[]\nfor f in sys.argv[1:]:\n z=zipfile.ZipFile(f); assert z.testzip() is None; names.extend(z.namelist()); assert all(z.read(n)[0]==97 for n in z.namelist())\nassert len(names)==6 and len(set(names))==6 and all("/" not in n for n in names)',...archivePaths],{encoding:'utf8'});assert.equal(allZipCheck.status,0,allZipCheck.stderr);
 assert.equal(await p.evaluate(async()=>{const root=await (await navigator.storage.getDirectory()).getDirectoryHandle('telegram-lote');let n=0;for await(const [name] of root.entries())n++;return n;}),0);
 await p.evaluate(()=>engine.disk.call=window.__originalDiskCall);

 // The default direct ZIP flow writes to a real directory handle; only the picker is simulated.
 await p.evaluate(async()=>{const root=await navigator.storage.getDirectory();try{await root.removeEntry('ui-final-zip',{recursive:true});}catch{}const dir=await root.getDirectoryHandle('ui-final-zip',{create:true});window.showDirectoryPicker=async()=>dir;document.querySelector('#zipSaveMode [value=folder]').disabled=false;});
 await p.locator('#advanced summary').click();await p.locator('#zipSaveMode').selectOption('folder');await p.locator('#advanced summary').click();await p.locator('#selectAll').check();const beforeDirect=downloads.size;await p.locator('#download').click();
 await p.waitForFunction(()=>document.getElementById('queueStatus').textContent==='FINALIZADO');assert.equal(downloads.size,beforeDirect);assert.equal(local.queueV2.parts[0].status,'done');assert.equal(local.queueV2.destinationName,'ui-final-zip');assert.ok(Object.values(local).some(x=>x?.localName?.endsWith('.zip')));
 const directBytes=await p.evaluate(async()=>{const part=engine.q.parts[0],file=await destination.verify(part.savedName,part.expectedSize);return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});});
 const directPath=path.join(root,'research','ui-direct.zip');fs.writeFileSync(directPath,Buffer.from(directBytes,'base64'));const directCheck=require('node:child_process').spawnSync('python3',['-c','import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert len(z.namelist())==6;assert all("/" not in n for n in z.namelist());assert z.testzip() is None;assert all(z.read(n)[0]==97 for n in z.namelist())',directPath],{encoding:'utf8'});assert.equal(directCheck.status,0,directCheck.stderr);
 assert.ok(await p.locator('#openArchive').isHidden());await p.evaluate(async()=>{await (await navigator.storage.getDirectory()).removeEntry('ui-final-zip',{recursive:true});});

 // Protected-content mode is explicit; preview/parts still use the same topic.
 await telegram.evaluate(()=>{window.__protected=true;for(const row of window.__rows)row.pFlags={noforwards:true};});
 await p.locator('#scan').click();await p.waitForFunction(()=>document.getElementById('notice').textContent.includes('restringido'));
 await p.locator('#advanced summary').click();await p.locator('#allowRestricted').check();await p.locator('#advanced summary').click();await p.waitForFunction(()=>document.getElementById('scopeNote').textContent.includes('intento habilitado'));
 await p.locator('#scan').click();await p.waitForFunction(()=>document.getElementById('scanStatus').textContent.includes('búsqueda completa'));assert.equal(await p.locator('.file-row').count(),6);assert.equal(await p.locator('text=NO_DEBE_APARECER.pdf').count(),0);
 await p.locator('#filterResults').fill('Planos');assert.equal(await p.locator('.file-row').count(),1);await p.locator('#filterResults').fill('');
 // Last-20 mode sorts across categories, rather than keeping the first filter's results.
 await telegram.evaluate(()=>{for(let i=0;i<30;i++){const row=structuredClone(window.__rows[0]);row.id=1000+i;row.date=2000000000+i;row.media.document.id=String(1000+i);row.media.document.file_name=`nuevo_${i}.pdf`;window.__rows.push(row);}});
 await p.locator('#quickMode').selectOption('20');await p.locator('#scan').click();await p.waitForFunction(()=>document.getElementById('scanStatus').textContent.includes('búsqueda completa'));assert.equal(await p.locator('.file-row').count(),20);assert.ok((await p.locator('.file-name').first().textContent()).includes('nuevo_29'));
 await p.setViewportSize({width:320,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('#help').click();assert.ok(await p.locator('#helpDialog').isVisible());await p.locator('#closeHelp').click();
 await p.locator('#listDensity').selectOption('minimal');await p.locator('#fileList').scrollIntoViewIfNeeded();const listMetrics=await p.locator('#fileList').evaluate(el=>({visible:el.clientHeight,content:el.scrollHeight}));assert.ok(listMetrics.content>listMetrics.visible);assert.ok(listMetrics.visible<=620);await p.screenshot({path:path.join(root,'research','v24-minimal-list.png')});await p.reload();await p.waitForFunction(()=>document.getElementById('listDensity').value==='minimal'&&document.getElementById('fileList').classList.contains('minimal-list'));assert.ok(await p.locator('#fileList').evaluate(el=>el.classList.contains('minimal-list')));
 assert.deepEqual(errors,[]);console.log('V2 browser: real OPFS writes, 512 KB transfer, bytes/CRC, topic isolation, favorites, thumbnails, message links, retries, ZIP and independent parts, notifications, folder/file controls and panel recovery passed.');
 await browser.close();
})().catch(async e=>{console.error(e);try{console.error(await runningPanel?.evaluate(()=>JSON.stringify({notice:document.getElementById('notice').textContent,status:document.getElementById('queueStatus').textContent,archiveError:engine.q?.archiveError,archive:engine.q?.archiveStatus,jobs:engine.q?.jobs.map(j=>({name:j.item.name,status:j.status,bytes:j.bytes,total:j.total,error:j.error})),running:engine.running.size})));}catch{}await runningBrowser?.close();process.exitCode=1;});
