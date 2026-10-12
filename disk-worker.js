'use strict';
importScripts('zip.js');
const handles=new Map();let chain=Promise.resolve();
const valid=name=>{if(!/^[a-zA-Z0-9_-]{1,120}$/.test(name))throw new Error('Nombre temporal inválido.');return name;};
async function root(){const r=await navigator.storage.getDirectory();return r.getDirectoryHandle('telegram-lote',{create:true});}
async function open(name){valid(name);if(handles.has(name))return handles.get(name);const file=await (await root()).getFileHandle(name,{create:true});const access=await file.createSyncAccessHandle();const x={file,access,dirty:0,lastFlush:performance.now()};handles.set(name,x);return x;}
function flush(h){if(h.dirty){h.access.flush();h.dirty=0;h.lastFlush=performance.now();}}
setInterval(()=>{for(const h of handles.values())if(h.dirty&&performance.now()-h.lastFlush>=1000){try{flush(h);}catch{/* The next write or close reports disk errors to the queue. */}}},1000);
function close(name){const h=handles.get(name);if(h){try{h.access.flush();}finally{try{h.access.close();}finally{handles.delete(name);}}}}
async function run(command,args,id){
  const name=args.name;
  if(command==='open'){const h=await open(name);return {size:h.access.getSize()};}
  if(command==='write'){const h=await open(name),bytes=new Uint8Array(args.data);if(!Number.isSafeInteger(args.offset)||args.offset<0||args.offset>h.access.getSize())throw new Error('Posición de escritura inválida.');const written=h.access.write(bytes,{at:args.offset});if(written!==bytes.length)throw new Error('No se pudo escribir todo el bloque.');h.dirty+=written;if(h.dirty>=8*1048576||performance.now()-h.lastFlush>=1000)flush(h);return {size:h.access.getSize()};}
  if(command==='read'){const h=await open(name);if(!Number.isSafeInteger(args.offset)||args.offset<0)throw new Error('Posición de lectura inválida.');const bytes=new Uint8Array(Math.min(524288,Math.max(0,h.access.getSize()-args.offset)));const n=h.access.read(bytes,{at:args.offset});return bytes.slice(0,n).buffer;}
  if(command==='truncate'){const h=await open(name);h.access.truncate(args.size);h.access.flush();return true;}
  if(command==='close'){close(name);return true;}
  if(command==='file'){close(name);return await (await (await root()).getFileHandle(valid(name))).getFile();}
  if(command==='remove'){close(name);try{await (await root()).removeEntry(valid(name));}catch(e){if(e.name!=='NotFoundError')throw e;}return true;}
  if(command==='clean'){const r=await root();const keep=new Set(args.keep||[]);for await(const [n] of r.entries())if(!keep.has(n)){close(n);await r.removeEntry(n);}return true;}
  if(command==='estimate')return navigator.storage.estimate();
  if(command==='zip'){
    const entries=[];let total=0;
    for(const x of args.entries){
      const source=await open(x.diskName),size=source.access.getSize();close(x.diskName);
      if(x.expectedSize!=null&&size!==x.expectedSize)throw new Error('INCOMPLETE_TEMPORARY:'+x.diskName);
      total+=size;
      entries.push({name:x.name,file:{size,stream(){let offset=0;return new ReadableStream({async pull(c){
        try{if(offset>=size){close(x.diskName);c.close();return;}const h=await open(x.diskName),bytes=new Uint8Array(Math.min(524288,size-offset)),n=h.access.read(bytes,{at:offset});if(n!==bytes.length)throw new Error('INCOMPLETE_TEMPORARY:'+x.diskName);offset+=n;c.enqueue(bytes);}catch(e){close(x.diskName);c.error(e);}
      },cancel(){close(x.diskName);}});}}});
    }
    const h=await open(name);h.access.truncate(0);try{await TGLZip.writeZip(entries,(bytes,offset)=>{const n=h.access.write(bytes,{at:offset});if(n!==bytes.length)throw new Error('Escritura ZIP incompleta.');},done=>self.postMessage({id,progress:done,total}));h.access.flush();}catch(e){try{close(name);}catch{}await (await root()).removeEntry(name).catch(()=>{});throw e;}finally{close(name);for(const x of args.entries)close(x.diskName);}if(args.metadataOnly){const h=await open(name),size=h.access.getSize();close(name);return {size};}return await (await (await root()).getFileHandle(name)).getFile();
  }
  throw new Error('Operación de disco desconocida.');
}
self.onmessage=e=>{const {id,command,args={}}=e.data;chain=chain.catch(()=>{}).then(()=>run(command,args,id)).then(value=>self.postMessage({id,ok:true,value}),error=>self.postMessage({id,ok:false,error:error.message,name:error.name}));};
