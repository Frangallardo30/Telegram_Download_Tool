'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const source=fs.existsSync(path.resolve(__dirname,'../telegram-lote-v2/manifest.json'))?path.resolve(__dirname,'../telegram-lote-v2'):path.resolve(__dirname,'..');
const Destination=require(path.join(source,'destination.js')),zip=require(path.join(source,'zip.js'));
async function zipBlob(){const out=[];await zip.writeZip([{name:'Tema/archivo.txt',file:new Blob(['datos completos'])}],async b=>out.push(b));return new Blob(out);}
function target(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tgl-final-')),events=[];let bad=false;
 const d=new Destination();d.handle={name:'ZIP elegidos',async queryPermission(){return 'granted';},async getFileHandle(name,{create=false}={}){
  const file=path.join(dir,name);if(!fs.existsSync(file)&&!create)throw new DOMException('No existe','NotFoundError');if(create&&!fs.existsSync(file))fs.writeFileSync(file,'');
  return {async getFile(){events.push(['read',name]);let b=fs.readFileSync(file);if(bad)b=b.subarray(0,Math.max(0,b.length-1));return new Blob([b]);},async createWritable(){events.push(['open',name]);const tmp=file+'.tmp',fd=fs.openSync(tmp,'w');return new WritableStream({write(chunk){events.push(['write',name]);fs.writeSync(fd,chunk);},close(){fs.closeSync(fd);fs.renameSync(tmp,file);events.push(['closed',name]);},abort(){fs.closeSync(fd);fs.unlinkSync(tmp);events.push(['aborted',name]);}});}};
 }};
 return {d,dir,events,corrupt:()=>bad=true,clean(){for(const n of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,n));fs.rmdirSync(dir);}};
}
test('direct ZIP writes close before verification and never overwrite an existing user file',async()=>{
 const f=target();try{fs.writeFileSync(path.join(f.dir,'Tema.zip'),'archivo anterior');const b=await zipBlob(),part={};let checkpoint=0;
 await f.d.save(b,'Tema.zip',part,async()=>checkpoint++);assert.equal(part.savedName,'Tema (2).zip');assert.equal(part.status,'written');assert.equal(checkpoint,2);assert.equal(fs.readFileSync(path.join(f.dir,'Tema.zip'),'utf8'),'archivo anterior');assert.equal(fs.statSync(path.join(f.dir,part.savedName)).size,b.size);
 assert.ok(f.events.findIndex(e=>e[0]==='read'&&e[1]===part.savedName)>f.events.findIndex(e=>e[0]==='closed'));
 const r=require('node:child_process').spawnSync('python3',['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert z.read("Tema/archivo.txt")==b"datos completos"',path.join(f.dir,part.savedName)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 }finally{f.clean();}
});
test('verification rejects a truncated final ZIP after the write closes',async()=>{
 const f=target();try{f.corrupt();const part={};await assert.rejects(f.d.save(await zipBlob(),'Tema.zip',part,async()=>{}),/incompleto/);assert.equal(part.status,'writing');assert.ok(f.events.some(e=>e[0]==='closed'));}finally{f.clean();}
});
test('cancellation aborts the final writable stream without marking the ZIP saved',async()=>{
 const f=target();try{let release;const waiting=new Promise(r=>release=r);const file={size:100,stream(){return new ReadableStream({async pull(c){await waiting;c.enqueue(new Uint8Array(100));c.close();}});}};const part={};const result=f.d.save(file,'cancelado.zip',part,async()=>{});
 for(let i=0;i<50&&!f.d.controller;i++)await new Promise(r=>setImmediate(r));f.d.abort();release();await assert.rejects(result,e=>e.name==='AbortError');assert.ok(f.events.some(e=>e[0]==='aborted'));assert.equal(part.status,'writing');
 }finally{f.clean();}
});
