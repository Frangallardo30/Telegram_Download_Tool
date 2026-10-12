const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.existsSync(path.resolve(__dirname,'../telegram-lote-v2/manifest.json'))?path.resolve(__dirname,'../telegram-lote-v2'):path.resolve(__dirname,'..');
const C=require(path.join(source,'core.js')),Z=require(path.join(source,'zip.js'));
test('exponential retries distinguish transient failures from permissions and disk errors',()=>{assert.equal(C.retryDelay('NETWORK_FAIL',1),2000);assert.equal(C.retryDelay('NETWORK_FAIL',3),8000);assert.equal(C.retryDelay('FLOOD_PREMIUM_WAIT_15',1),15000);assert.equal(C.retryDelay('CHANNEL_PRIVATE',1),null);assert.equal(C.retryDelay('QuotaExceededError',1),null);});
test('latest selection merges types and uses message ID to resolve ties',()=>{assert.deepEqual(C.latest([{id:'a',date:1,messageId:8},{id:'b',date:9,messageId:2},{id:'c',date:9,messageId:3}],2).map(x=>x.id),['c','b']);});
test('ZIP admission allows multi-GB batches and rejects unsafe or unknown sizes',()=>{assert.equal(C.zipEligible([{size:1024}]),true);assert.equal(C.zipEligible([{size:null}]),false);assert.equal(C.zipEligible([{size:81*1048576}]),true);assert.equal(C.zipEligible([{size:12*1073741824}]),true);assert.equal(C.zipEligible(Array.from({length:10000},()=>({size:1}))),true);assert.equal(C.zipEligible([{size:Number.MAX_SAFE_INTEGER+1}]),false);});
test('restricted-message opt-in preserves default restrictions and topic isolation',()=>{const m={_:'message',id:9,date:1,pFlags:{noforwards:true},reply_to:{reply_to_top_id:7},media:{document:{_:'document',id:'x',size:1,mime_type:'application/pdf'}}};const ctx={isForum:true,serverThreadId:7};assert.equal(C.normalizeMessage(m,ctx),null);assert.ok(C.normalizeMessage(m,{...ctx,allowRestricted:true}));assert.equal(C.normalizeMessage(m,{...ctx,serverThreadId:8,allowRestricted:true}),null);});
test('a message from another channel cannot enter a topic with the same numeric ID',()=>{const m={_:'message',id:9,date:1,peer_id:{_:'peerChannel',channel_id:99},reply_to:{reply_to_top_id:7},media:{document:{_:'document',id:'x',size:1}}};assert.equal(C.normalizeMessage(m,{isForum:true,serverThreadId:7,peerId:-42,allowRestricted:true}),null);});
test('streaming ZIP is accepted by Python with exact UTF-8 names and payload CRC',async()=>{const entries=[{name:'Tema/Planos_ñ.pdf',file:new Blob(['abc'])},{name:'Tema/vacío.txt',file:new Blob([])},{name:'Tema/datos.bin',file:new Blob([new Uint8Array(700000).fill(113)])}];const out=[];await Z.writeZip(entries,async bytes=>out.push(Buffer.from(bytes)));const buffer=Buffer.concat(out);const tmp=path.join(require('node:os').tmpdir(),'tg-v2-test.zip');fs.writeFileSync(tmp,buffer);const result=require('node:child_process').spawnSync('python3',['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert z.read("Tema/Planos_ñ.pdf")==b"abc";assert z.read("Tema/vacío.txt")==b"";assert z.read("Tema/datos.bin")==b"q"*700000;print("ok")',tmp],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);});
test('part grouping keeps each file whole and allows oversized single-file ZIP64',()=>{
 const items=[{size:1048576},{size:1048576},{size:7*1073741824},{size:1048576}];
 const parts=C.zipParts(items,2*1048576+16384);assert.deepEqual(parts.map(p=>p.indexes),[[0,1],[2],[3]]);
 assert.ok(parts[1].total>7*1073741824);
});
function pythonZip(filename,code){const r=require('node:child_process').spawnSync('python3',['-c',code,filename],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
async function diskZip(entries,options,check){const tmp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'tgl-zip64-')),filename=path.join(tmp,'archive.zip'),fd=fs.openSync(filename,'w');let maxChunk=0;
 try{await Z.writeZip(entries,async(bytes,offset)=>{maxChunk=Math.max(maxChunk,bytes.length);assert.equal(fs.writeSync(fd,bytes,0,bytes.length,offset),bytes.length);},()=>{},options);fs.closeSync(fd);check(filename);return maxChunk;}
 finally{try{fs.closeSync(fd);}catch{}fs.unlinkSync(filename);fs.rmdirSync(tmp);}
}
test('forced ZIP64 local extras, descriptors and footer extract with Python',async()=>{
 await diskZip([{name:'Tema/ñ.txt',file:new Blob(['zip64 funciona'])}],{forceZip64:true},f=>pythonZip(f,'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert z.read("Tema/ñ.txt")==b"zip64 funciona"'));
});
test('ZIP64 headers encode sizes above 4GB without allocating their payload',()=>{
 const size=5*1073741824+123,start=6*1073741824+456,h=Z.entryHeaders('large.bin',size,start,0x12345678),cv=new DataView(h.central.buffer),x=new DataView(h.centralExtra.buffer),d=new DataView(h.descriptor.buffer);
 assert.equal(cv.getUint32(20,true),0xffffffff);assert.equal(cv.getUint32(42,true),0xffffffff);assert.equal(cv.getUint16(6,true),45);
 assert.equal(x.getBigUint64(4,true),BigInt(size));assert.equal(x.getBigUint64(12,true),BigInt(size));assert.equal(x.getBigUint64(20,true),BigInt(start));assert.equal(d.getBigUint64(8,true),BigInt(size));assert.equal(h.descriptor.length,24);
});
test('real sparse ZIP beyond 4GB extracts using 64-bit directory offsets',async()=>{
 await diskZip([{name:'beyond4gb.txt',file:new Blob(['correct offsets'])}],{startOffset:5*1073741824},f=>{assert.ok(fs.statSync(f).size>5*1073741824);pythonZip(f,'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert z.read("beyond4gb.txt")==b"correct offsets"');});
});
test('90MiB ZIP is written in 512KiB blocks and passes CRC extraction',async()=>{
 const size=90*1048576,block=new Uint8Array(524288).fill(97);let bytes=0;
 const file={size,stream:()=>new ReadableStream({pull(c){if(bytes===size){c.close();return;}c.enqueue(block);bytes+=block.length;}})};
 const max=await diskZip([{name:'large.bin',file}],{},f=>pythonZip(f,'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.getinfo("large.bin").file_size==90*1048576;assert z.testzip() is None'));assert.ok(max<=524288);
});
