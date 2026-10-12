/* Real OPFS persistence across closing and relaunching the browser process. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..'),source=fs.existsSync(path.join(root,'telegram-lote-v2/manifest.json'))?path.join(root,'telegram-lote-v2'):root;
const profile=path.join(root,'research','opfs-persistence-profile');fs.mkdirSync(path.dirname(profile),{recursive:true});
let context;
async function launch(){
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.TG_TEST_BROWSER||chromium.executablePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 await context.route('https://disk.test/**',r=>{const n=new URL(r.request().url()).pathname.slice(1);if(n==='index.html')return r.fulfill({contentType:'text/html',body:'<!doctype html><script src="disk.js"></script>'});return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(source,n))});});
 const p=await context.newPage();await p.goto('https://disk.test/index.html');return p;
}
(async()=>{
 let p=await launch();await p.evaluate(async()=>{window.disk=new TGLDisk();await disk.call('open',{name:'persistent_test'});await disk.call('truncate',{name:'persistent_test',size:0});await disk.call('write',{name:'persistent_test',offset:0,data:new Uint8Array(512*1024).fill(101).buffer});await disk.call('close',{name:'persistent_test'});});await context.close();
 p=await launch();const r=await p.evaluate(async()=>{const disk=new TGLDisk(),opened=await disk.call('open',{name:'persistent_test'});await disk.call('write',{name:'persistent_test',offset:opened.size,data:new Uint8Array(123).fill(102).buffer});const f=await disk.call('file',{name:'persistent_test'}),bytes=new Uint8Array(await f.arrayBuffer());await disk.call('remove',{name:'persistent_test'});return {size:opened.size,final:bytes.length,first:bytes[0],last:bytes.at(-1)};});assert.deepEqual(r,{size:512*1024,final:512*1024+123,first:101,last:102});console.log('OPFS persistence: browser closed/restarted, preserved 512 KB, appended without rereading or losing bytes.');await context.close();
})().catch(async e=>{console.error(e);await context?.close();process.exitCode=1;});
