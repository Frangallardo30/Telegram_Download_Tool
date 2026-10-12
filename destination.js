/* Writes final ZIPs to the user's chosen folder, without download Blob URLs. */
'use strict';
class TGLDestination {
  constructor(){this.handle=null;this.controller=null;}
  async store(key,value){
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('telegram-lote-destinations',1);r.onupgradeneeded=()=>r.result.createObjectStore('handles');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    try{return await new Promise((resolve,reject)=>{const t=db.transaction('handles',value===undefined?'readonly':'readwrite'),s=t.objectStore('handles'),r=value===undefined?s.get(key):s.put(value,key);let result;r.onsuccess=()=>result=r.result;t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('No se pudo guardar la carpeta elegida.'));});}finally{db.close();}
  }
  async choose(){
    if(typeof showDirectoryPicker!=='function')throw new Error('Este navegador no ofrece el selector de carpetas. Elegí el guardado con Descargas del navegador.');
    const handle=await showDirectoryPicker({id:'telegram-lote-zip',mode:'readwrite',startIn:'downloads'});this.handle=handle;return handle;
  }
  async authorize(){
    if(!this.handle)return this.choose();
    const permission=await this.handle.requestPermission({mode:'readwrite'});
    if(permission!=='granted')throw new Error('Necesito permiso para escribir en la carpeta ZIP. Volvé a elegirla.');return this.handle;
  }
  async attach(queueId){if(!this.handle)throw new Error('Elegí una carpeta para guardar los ZIP.');await this.store(queueId,this.handle);}
  async restore(queueId){this.handle=await this.store(queueId)||null;return this.handle;}
  async allowed(){return !!this.handle&&(await this.handle.queryPermission({mode:'readwrite'}))==='granted';}
  async verify(name,size){
    if(!await this.allowed())throw new Error('Volvé a dar permiso a la carpeta ZIP para continuar.');
    const f=await (await this.handle.getFileHandle(name)).getFile();
    if(f.size!==size||f.size<22)throw new Error('El ZIP guardado está incompleto. Se conservan los temporales para reintentar.');
    const tail=new DataView(await f.slice(-22).arrayBuffer());if(tail.getUint32(0,true)!==0x06054b50)throw new Error('El ZIP guardado no tiene un cierre válido.');return f;
  }
  async save(file,suggested,part,checkpoint,progress=()=>{}){
    if(!await this.allowed())throw new Error('Volvé a dar permiso a la carpeta ZIP para continuar.');
    if(!part.savedName){
      const stem=suggested.replace(/\.zip$/i,'');let suffix=0;
      while(true){const name=suffix?`${stem} (${suffix+1}).zip`:suggested;try{await this.handle.getFileHandle(name);suffix++;}catch(e){if(e.name!=='NotFoundError')throw e;part.savedName=name;break;}}
      part.expectedSize=file.size;part.status='writing';await checkpoint();
    }
    const target=await this.handle.getFileHandle(part.savedName,{create:true}),writable=await target.createWritable();
    this.controller=new AbortController();let bytes=0;
    try{
      const counted=new TransformStream({transform(chunk,c){bytes+=chunk.byteLength;progress(bytes,file.size);c.enqueue(chunk);}});
      await file.stream().pipeThrough(counted).pipeTo(writable,{signal:this.controller.signal});
      await this.verify(part.savedName,file.size);part.status='written';await checkpoint();return {name:part.savedName,size:file.size,folder:this.handle.name};
    }finally{this.controller=null;}
  }
  abort(){this.controller?.abort(new DOMException('Guardado cancelado.','AbortError'));}
}
globalThis.TGLDestination=TGLDestination;
if(typeof module!=='undefined')module.exports=TGLDestination;
