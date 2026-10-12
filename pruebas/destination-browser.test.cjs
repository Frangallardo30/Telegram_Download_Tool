/* Real FileSystemWritableFileStream, OPFS source, final verification and persisted handle.
   The native folder picker is simulated; a separate OPFS directory acts as the final folder. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..'),source=fs.existsSync(path.join(root,'telegram-lote-v2/manifest.json'))?path.join(root,'telegram-lote-v2'):root;
let context;
async function launch(){context=await chromium.launchPersistentContext(path.join(root,'research','destination-profile'),{executablePath:process.env.TG_TEST_BROWSER||chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});await context.route('https://destination.test/**',r=>{const name=new URL(r.request().url()).pathname.slice(1);if(name==='index.html')return r.fulfill({contentType:'text/html',body:'<!doctype html><script src="disk.js"></script><script src="destination.js"></script>'});return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(source,name))});});const p=await context.newPage();await p.goto('https://destination.test/index.html');return p;}
(async()=>{
 let p=await launch();const result=await p.evaluate(async()=>{
  const disk=new TGLDisk(),root=await navigator.storage.getDirectory();try{await root.removeEntry('final-zip-test',{recursive:true});}catch{}
  const final=await root.getDirectoryHandle('final-zip-test',{create:true});const original=await final.getFileHandle('Lote.zip',{create:true}),w=await original.createWritable();await w.write('respetar archivo previo');await w.close();
  for(const name of ['sourceA','sourceB']){await disk.call('open',{name});await disk.call('truncate',{name,size:0});await disk.call('write',{name,offset:0,data:new Uint8Array(524288).fill(97).buffer});await disk.call('close',{name});}
  const zip=await disk.call('zip',{name:'archive_test',entries:[{diskName:'sourceA',name:'Tema/archivoA.pdf'},{diskName:'sourceB',name:'Tema/archivoB.txt'}]});
  window.showDirectoryPicker=async()=>final;const dest=new TGLDestination();await dest.choose();await dest.attach('fixture_queue');const part={};await dest.save(zip,'Lote.zip',part,async()=>{});
  for(const name of ['sourceA','sourceB','archive_test'])await disk.call('remove',{name});
  const complete=await dest.verify(part.savedName,zip.size);return {name:part.savedName,size:complete.size,previous:await (await original.getFile()).text()};
 });assert.equal(result.name,'Lote (2).zip');assert.equal(result.previous,'respetar archivo previo');assert.ok(result.size>1048576);await context.close();
 p=await launch();const r=await p.evaluate(async({name,size})=>{const dest=new TGLDestination();await dest.restore('fixture_queue');const f=await dest.verify(name,size);return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(f);});},result);
 const output=path.join(root,'research','direct-final-test.zip');fs.writeFileSync(output,Buffer.from(r,'base64'));const check=require('node:child_process').spawnSync('python3',['-c','import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert len(z.namelist())==2;assert all(z.read(n)==b"a"*524288 for n in z.namelist())',output],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);
 await p.evaluate(async()=>{await (await navigator.storage.getDirectory()).removeEntry('final-zip-test',{recursive:true});});await context.close();console.log('Direct ZIP: actual writable stream closed and verified, source deleted, final ZIP survives browser restart, exact payload/CRC and collisions passed. Native picker simulated.');
})().catch(async e=>{console.error(e);await context?.close();process.exitCode=1;});
