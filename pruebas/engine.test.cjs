'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.existsSync(path.resolve(__dirname,'../telegram-lote-v2/manifest.json'))?path.resolve(__dirname,'../telegram-lote-v2'):path.resolve(__dirname,'..');
const core=require(path.join(source,'core.js')),zip=require(path.join(source,'zip.js'));
function fixture({quota=10*1048576,zipQuotaFailure=false}={}){
 const storage={},files=new Map(),downloads=new Map(),deliveries=[],events=[];let id=0,maxLive=0,scope=true;
 const clone=x=>structuredClone(x),disk={async call(command,a={},progress){
  if(command==='estimate')return {quota,usage:0};
  if(command==='open'){if(!files.has(a.name))files.set(a.name,new Uint8Array());return {size:files.get(a.name).length};}
  if(command==='truncate'){files.set(a.name,files.get(a.name).slice(0,a.size));return true;}
  if(command==='write'){const prev=files.get(a.name),b=new Uint8Array(a.data),out=new Uint8Array(Math.max(prev.length,a.offset+b.length));out.set(prev);out.set(b,a.offset);files.set(a.name,out);maxLive=Math.max(maxLive,[...files.values()].reduce((n,x)=>n+x.length,0));return true;}
  if(command==='read')return files.get(a.name).slice(a.offset,a.offset+524288).buffer;
  if(command==='close')return true;
  if(command==='remove'){events.push(['remove',a.name]);files.delete(a.name);return true;}
  if(command==='zip'){
   for(const entry of a.entries)if(entry.expectedSize!=null&&files.get(entry.diskName)?.length!==entry.expectedSize)throw new Error('INCOMPLETE_TEMPORARY:'+entry.diskName);
   events.push(['zip',a.entries.length]);if(zipQuotaFailure&&a.entries.length>1){const e=new Error('quota');e.name='QuotaExceededError';throw e;}
   const chunks=[];await zip.writeZip(a.entries.map(e=>({name:e.name,file:new Blob([files.get(e.diskName)])})),async b=>chunks.push(b),progress);const b=new Blob(chunks);files.set(a.name,new Uint8Array(await b.arrayBuffer()));return b;
  }throw new Error('unknown disk command '+command);
 }};
 const context={key:'1:-42:7',channel:'Canal',topic:'Planos',serverThreadId:7};
 const env={TGLCore:core,TGLDisk:class{},crypto:require('node:crypto').webcrypto,performance,URL,atob,Uint8Array,console,Blob,ReadableStream,
  chrome:{storage:{local:{async get(keys){if(keys==null)return clone(storage);if(typeof keys==='string')return {[keys]:clone(storage[keys])};return Object.fromEntries(keys.map(k=>[k,clone(storage[k])]))},async set(o){Object.assign(storage,clone(o))}}},downloads:{async search({id}){return downloads.has(id)?[downloads.get(id)]:[];}}}};
 vm.createContext(env);vm.runInContext(fs.readFileSync(path.join(source,'engine.js'),'utf8'),env);
 const callbacks={disk,isScopeOK:()=>scope,async call(command,{item,offset}){assert.equal(command,'chunk');events.push(['chunk',item.id]);const n=Math.min(core.CHUNK,item.size-offset);return {data:Buffer.alloc(n,Number(item.id)).toString('base64'),bytes:n,total:item.size,eof:offset+n===item.size};},async message(type,payload){
  if(type==='saveFile'){const n=++id;downloads.set(n,{id:n,state:'in_progress'});storage[`delivery:${payload.queueId}:${payload.index}`]={id:n,state:'in_progress'};deliveries.push(payload);return {id:n,filename:payload.item.name};}return true;
 }};
 const make=()=>new env.TGLEngine(callbacks),items=[1,2,3].map(n=>({id:String(n),messageId:n,size:2*1048576,name:n+'.bin',type:'document',ext:'bin'}));
 const settle=async e=>{for(let i=0;i<300;i++){await e.tick();await new Promise(r=>setImmediate(r));if(['saving','done','error'].includes(e.q.archiveStatus))return;}throw new Error('engine did not settle');};
 function complete(e){const part=e.q.parts[e.q.currentPart];part.verifyAt=0;part.confirmAt=0;const d=downloads.get(e.q.archiveId);d.state='complete';storage[`delivery:${e.q.id}:${e.archiveKey(e.q)}`]={id:d.id,state:'complete'};}
 return {make,items,context,storage,files,downloads,deliveries,events,settle,complete,get maxLive(){return maxLive;},setScope:x=>scope=x};
}
test('ZIP parts save separately, free earlier temporaries, and resume after panel reload',async()=>{
 const f=fixture({quota:6*1048576});let e=f.make();await e.start(f.items,f.context,1,{mode:'zip',parallel:2,zipPartGiB:'auto'});assert.equal(e.q.parts.length,3);
 await f.settle(e);assert.equal(f.deliveries.length,1);assert.equal(f.deliveries[0].items.length,1);assert.match(f.deliveries[0].item.name,/_parte_001\.zip$/);assert.deepEqual(f.events.filter(x=>x[0]==='chunk').map(x=>x[1]),['1','1','1','1']);
 await e.pause();f.complete(e);await e.tick();assert.equal(e.q.currentPart,1);assert.equal(f.files.size,0);
 e=f.make();await e.load();assert.equal(e.q.currentPart,1);assert.equal(e.q.paused,true);await e.pause(false);
 await f.settle(e);assert.match(f.deliveries[1].item.name,/_parte_002\.zip$/);assert.equal(f.deliveries[1].index,'zip:2');f.complete(e);await e.tick();await f.settle(e);assert.match(f.deliveries[2].item.name,/_parte_003\.zip$/);f.complete(e);await e.tick();
 assert.equal(e.q.archiveStatus,'done');assert.equal(e.q.jobs.filter(x=>x.status==='done').length,3);assert.equal(f.files.size,0);assert.ok(f.maxLive<=2*1048576);
 const resumed=f.make();await resumed.load();assert.equal(resumed.q.archiveStatus,'done');assert.equal(resumed.q.currentPart,3);
});
test('quota exhaustion during packaging automatically splits a part and preserves files',async()=>{
 const f=fixture({quota:100*1048576,zipQuotaFailure:true}),e=f.make();await e.start(f.items,f.context,1,{mode:'zip',parallel:2});
 assert.equal(e.q.parts.length,1);await f.settle(e);assert.equal(e.q.archiveStatus,'saving');assert.ok(e.q.parts.length>1);assert.equal(f.deliveries[0].items.length,1);assert.match(e.q.zipNote,/dividió/);
 for(let i=0;i<5&&e.q.archiveStatus!=='done';i++){f.complete(e);await e.tick();await f.settle(e);}
 assert.equal(e.q.archiveStatus,'done');assert.deepEqual(f.deliveries.flatMap(d=>d.items.map(i=>i.id)).sort(),['1','2','3']);
});
test('changing topic pauses a multi-part batch before reading additional bytes',async()=>{
 const f=fixture({quota:6*1048576}),e=f.make();await e.start(f.items,f.context,1,{mode:'zip'});await f.settle(e);await e.pause();f.complete(e);await e.tick();f.setScope(false);await e.pause(false);await e.tick();assert.equal(f.deliveries.length,1);assert.equal(f.events.filter(x=>x[0]==='chunk').length,4);
});
test('a ZIP reported as deleted stays retryable and keeps all temporary bytes',async()=>{
 const f=fixture(),e=f.make();await e.start(f.items.slice(0,1),f.context,1,{mode:'zip'});await f.settle(e);const temp=[...f.files.keys()];f.complete(e);f.downloads.get(e.q.archiveId).exists=false;await e.tick();assert.equal(e.q.archiveStatus,'error');assert.match(e.q.archiveError,/eliminado/);assert.equal(e.q.jobs[0].status,'staged');assert.deepEqual([...f.files.keys()],temp);
});
test('a completed native ZIP with the wrong size cannot clear its temporaries',async()=>{
 const f=fixture(),e=f.make();await e.start(f.items.slice(0,1),f.context,1,{mode:'zip'});await f.settle(e);f.complete(e);f.downloads.get(e.q.archiveId).fileSize=42;await e.tick();assert.equal(e.q.archiveStatus,'error');assert.match(e.q.archiveError,/tamaño/);assert.equal(e.q.jobs[0].status,'staged');assert.ok(f.files.size>0);
});
test('direct ZIP finalization records history only after write verification, then clears temporaries',async()=>{
 const f=fixture(),e=f.make(),finals=[];e.destination={handle:{name:'Mis ZIP'},async attach(){},async save(file,name,part,checkpoint){assert.ok(f.files.size>0);assert.equal(e.q.jobs[0].status,'staged');part.savedName=name;part.expectedSize=file.size;part.status='written';finals.push({name,bytes:new Uint8Array(await new Response(file.stream()).arrayBuffer())});await checkpoint();}};
 await e.start(f.items.slice(0,1),f.context,1,{mode:'zip',zipSaveMode:'folder'});await f.settle(e);assert.equal(e.q.archiveStatus,'done');assert.equal(f.deliveries.length,0);assert.equal(finals.length,1);assert.equal(f.files.size,0);assert.equal(e.q.jobs[0].status,'done');assert.ok(finals[0].bytes.length>2*1048576);
});
test('failed direct ZIP writes keep the source ZIP and files for retry',async()=>{
 const f=fixture(),e=f.make();e.destination={handle:{name:'Mis ZIP'},async attach(){},async save(){throw new Error('El ZIP guardado está incompleto.');}};
 await e.start(f.items.slice(0,1),f.context,1,{mode:'zip',zipSaveMode:'folder'});await f.settle(e);assert.equal(e.q.archiveStatus,'error');assert.equal(e.q.jobs[0].status,'staged');assert.ok(f.files.size>=2);
});
test('native ZIP completion waits for a fresh existence check before deleting the source',async()=>{
 const f=fixture(),e=f.make();await e.start(f.items.slice(0,1),f.context,1,{mode:'zip'});await f.settle(e);f.complete(e);const part=e.q.parts[0];delete part.verifyAt;delete part.confirmAt;await e.tick();assert.equal(e.q.archiveStatus,'saving');assert.equal(e.q.jobs[0].status,'staged');assert.ok(f.files.size>0);assert.ok(part.verifyAt>Date.now());
 part.verifyAt=0;await e.tick();assert.ok(part.confirmAt>Date.now());assert.ok(f.files.size>0);f.downloads.get(e.q.archiveId).exists=false;await e.tick();assert.equal(e.q.archiveStatus,'error');assert.ok(f.files.size>0);
});
test('raising concurrency in a running ZIP batch starts the extra jobs immediately',async()=>{
 const f=fixture({quota:100*1048576}),e=f.make();const requests=[];let release;const gate=new Promise(r=>release=r),original=e.call;
 e.call=async(...args)=>{requests.push(args[1].item.id);await gate;return original(...args);};
 await e.start(f.items,f.context,1,{mode:'zip',parallel:1});await e.tick();await new Promise(r=>setImmediate(r));assert.equal(e.running.size,1);
 await e.setParallel(3);await new Promise(r=>setImmediate(r));assert.equal(e.running.size,3);assert.deepEqual([...new Set(requests)].sort(),['1','2','3']);release();await f.settle(e);
 assert.equal(e.q.jobs.filter(j=>j.status==='staged').length,3);assert.equal(f.deliveries.length,1);
});
test('lowering concurrency lets current jobs finish and avoids starting new ones over the limit',async()=>{
 const f=fixture({quota:100*1048576}),e=f.make();let release;const gate=new Promise(r=>release=r),original=e.call,items=[...f.items,{...f.items[0],id:'4',messageId:4,name:'4.bin'}];
 e.call=async(...args)=>{await gate;return original(...args);};await e.start(items,f.context,1,{mode:'zip',parallel:3});await e.tick();await e.setParallel(1);assert.equal(e.running.size,3);assert.equal(e.q.jobs[3].status,'pending');release();await f.settle(e);assert.equal(e.q.jobs[3].status,'staged');
});
test('generated ZIPs use root files or only type folders, with no repeated channel/topic folders',async()=>{
 for(const byType of [false,true]){
  const f=fixture({quota:100*1048576}),e=f.make(),items=[f.items[0],{...f.items[1],type:'audio'}];
  await e.start(items,f.context,1,{mode:'zip',byType});await f.settle(e);
  const tmp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'tgl-flat-zip-')),filename=path.join(tmp,'lote.zip');
  try{
   const response=await fetch(f.deliveries[0].url);fs.writeFileSync(filename,Buffer.from(await response.arrayBuffer()));
   const names=byType?['Documentos/1_m1.bin','Audio/2_m2.bin']:['1_m1.bin','2_m2.bin'];
   const result=require('node:child_process').spawnSync('python3',['-c','import sys,json,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.namelist()==json.loads(sys.argv[2]);assert z.testzip() is None;assert all(len(z.read(n))==2*1048576 for n in z.namelist())',filename,JSON.stringify(names)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  }finally{e.releaseUrl('zip');fs.unlinkSync(filename);fs.rmdirSync(tmp);}
 }
});

test('a corrupted temporary is refetched with a new name before the ZIP is delivered',async()=>{
 const f=fixture({quota:100*1048576}),e=f.make(),original=e.disk.call.bind(e.disk);let damage=true;
 e.disk.call=async(command,args,progress)=>{if(command==='zip'&&damage){damage=false;f.files.set(args.entries[0].diskName,new Uint8Array());}return original(command,args,progress);};
 await e.start(f.items.slice(0,1),f.context,1,{mode:'zip',maxRetries:2});const firstName=e.q.jobs[0].diskName;
 for(let i=0;i<100&&e.q.jobs[0].status!=='waiting';i++){await e.tick();await new Promise(r=>setImmediate(r));}
 assert.equal(e.q.jobs[0].status,'waiting');assert.notEqual(e.q.jobs[0].diskName,firstName);assert.equal(f.deliveries.length,0);e.q.jobs[0].retryAt=0;await f.settle(e);assert.equal(f.deliveries.length,1);assert.equal(e.q.jobs[0].tempRepairs,1);assert.equal(e.q.jobs[0].bytes,2*1048576);
});
