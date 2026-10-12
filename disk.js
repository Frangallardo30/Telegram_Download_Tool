'use strict';
class TGLDisk {
  constructor(){this.worker=new Worker('disk-worker.js');this.seq=0;this.requests=new Map();this.worker.onmessage=e=>{const r=this.requests.get(e.data.id);if(!r)return;if(e.data.progress!=null){r.progress?.(e.data.progress,e.data.total);return;}this.requests.delete(e.data.id);if(e.data.ok)r.resolve(e.data.value);else{const err=new Error(e.data.error);err.name=e.data.name||'Error';r.reject(err);}};this.worker.onerror=()=>{for(const r of this.requests.values())r.reject(new Error('No se pudo iniciar el almacenamiento temporal.'));this.requests.clear();};}
  call(command,args={},progress){return new Promise((resolve,reject)=>{const id=++this.seq;this.requests.set(id,{resolve,reject,progress});const transfers=args.data instanceof ArrayBuffer?[args.data]:[];this.worker.postMessage({id,command,args},transfers);});}
  close(){this.worker.terminate();}
}
globalThis.TGLDisk=TGLDisk;
