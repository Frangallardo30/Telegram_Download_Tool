'use strict';
class TGLEngine {
  constructor({call,message,isScopeOK,onUpdate=()=>{},disk=new TGLDisk(),destination=null}){Object.assign(this,{call,message,isScopeOK,onUpdate,disk,destination});this.q=null;this.running=new Map();this.urls=new Map();this.persistChain=Promise.resolve();this.lastCheckpoint=0;this.speed=0;this.sampleBytes=0;this.sampleTime=performance.now();this.packaging=false;}
  save(){const data=this.q?JSON.parse(JSON.stringify(this.q)):null;this.persistChain=this.persistChain.catch(()=>{}).then(()=>chrome.storage.local.set({queueV2:data}));this.lastCheckpoint=Date.now();return this.persistChain;}
  async load(){const {queueV2}=await chrome.storage.local.get('queueV2');if(!queueV2)return null;this.q=queueV2;this.q.paused=true;
    for(const j of this.q.jobs){if(['transfer','delivering'].includes(j.status))j.status='pending';const key=`delivery:${this.q.id}:${j.index}`,r=await chrome.storage.local.get(key);if(r[key]&&!['cancelled','error'].includes(j.status)){j.downloadId=r[key].id;j.status=r[key].state==='complete'?'done':'saving';}}
    this.ensureParts(this.q);
    if(this.q.mode==='zip'&&this.q.options.zipSaveMode==='folder'){
      await this.destination?.restore(this.q.id);
      const part=this.q.parts[this.q.currentPart];
      if(this.q.archiveStatus!=='cancelled'&&part&&['writing','written','done'].includes(part.status)&&part.savedName){
        try{await this.destination.verify(part.savedName,part.expectedSize);await this.finishLocal(this.q,part);}catch{}
      }
    }
    const key=`delivery:${this.q.id}:${this.archiveKey(this.q)}`,r=await chrome.storage.local.get(key);if(r[key]&&this.q.archiveStatus!=='cancelled'&&this.q.archiveStatus!=='done'){this.q.archiveId=r[key].id;this.q.archiveStatus=r[key].state==='complete'?'done':'saving';if(this.q.archiveStatus==='done')this.q.archiveStatus='saving';}else if(['packing','delivering','saving'].includes(this.q.archiveStatus))this.q.archiveStatus='idle';
    for(const j of this.q.jobs)if(j.status==='done')await this.disk.call('remove',{name:j.diskName}).catch(()=>{});
    await this.save();return this.q;
  }
  ensureParts(q){if(q.mode==='zip'&&!q.parts){q.currentPart=0;q.parts=[{indexes:q.jobs.map(j=>j.index),status:'pending'}];}}
  archiveKey(q){return (q.currentPart||0)===0?'zip':`zip:${q.currentPart+1}`;}
  partJobs(q){this.ensureParts(q);return q.parts?.[q.currentPart||0]?.indexes.map(i=>q.jobs[i])||[];}
  async start(items,context,tabId,options){
    if(this.running.size)throw new Error('Esperá a que termine el bloque actual antes de iniciar otro lote.');
    if(this.q?.jobs.some(j=>['pending','waiting','transfer','delivering','saving','staged'].includes(j.status))&&this.q.archiveStatus!=='done')throw new Error('Terminá o cancelá la cola anterior.');
    if(options.mode==='zip'&&!TGLCore.zipEligible(items))throw new Error('El ZIP necesita tamaños conocidos y válidos. Usá archivos separados para los que no tienen tamaño.');
    let parts=null,partLimit=null,zipNote='';
    if(options.mode==='zip'){
      const estimate=await this.disk.call('estimate').catch(()=>null),available=estimate?.quota!=null?Math.max(0,estimate.quota-(estimate.usage||0)):null;
      const requested=Number(options.zipPartGiB)>0?Math.floor(Number(options.zipPartGiB)*1073741824):Number.MAX_SAFE_INTEGER-10000000;
      const budget=available!=null?Math.floor(available*.4):8*1073741824;
      partLimit=Math.min(requested,budget);
      if(partLimit<1)throw new Error('Chrome no tiene espacio temporal disponible. Liberá espacio y volvé a intentar.');
      if(available!=null&&items.some(x=>(x.size+4096)*2>available*.9))throw new Error('Un archivo necesita más espacio temporal del disponible. Liberá espacio para guardar ese archivo y su ZIP.');
      parts=TGLCore.zipParts(items,partLimit).map(part=>({...part,status:'pending'}));
      zipNote=available==null?'Chrome no informó su cuota: división preventiva en partes de 8 GB.':requested>budget?'Tamaño de partes ajustado al espacio temporal que informa Chrome.':'';
    }
    const next={id:crypto.randomUUID(),version:2,context,tabId,createdAt:Date.now(),paused:false,mode:options.mode||'files',parallel:options.parallel||1,maxRetries:Number(options.maxRetries)||0,notify:options.notify!==false,options,archiveStatus:'idle',archiveBytes:0,notified:false,jobs:items.map((item,index)=>({item,index,diskName:'part_'+crypto.randomUUID(),status:'pending',bytes:0,total:item.size,retries:0,retryAt:0,error:''}))};
    if(parts)Object.assign(next,{parts,currentPart:0,partLimit,zipNote});
    if(parts&&options.zipSaveMode==='folder'){if(!this.destination)throw new Error('Elegí una carpeta para guardar el ZIP.');await this.destination.attach(next.id);next.destinationName=this.destination.handle.name;}
    this.q=next;
    this.speed=0;this.sampleTime=performance.now();this.sampleBytes=0;await this.save();this.onUpdate();return this.q;
  }
  sample(bytes){this.sampleBytes+=bytes;const elapsed=(performance.now()-this.sampleTime)/1000;if(elapsed>=.4){const fresh=this.sampleBytes/elapsed;this.speed=this.speed?this.speed*.65+fresh*.35:fresh;this.sampleBytes=0;this.sampleTime=performance.now();}}
  async failed(q,j,error){
    if(this.q!==q||j.status==='cancelled')return;
    if(!this.isScopeOK(q)||/SCOPE_CHANGED|Cambiaste|Cambió el tema/.test(error.message)){q.paused=true;j.status='pending';j.error='Volvé al tema original para continuar.';}
    else {const delay=TGLCore.retryDelay(error,j.retries+1);if(delay!=null&&j.retries<q.maxRetries){j.retries++;j.retryAt=Date.now()+delay;j.status='waiting';j.error=error.message;}else{j.status='error';j.error=error.name==='QuotaExceededError'?'No hay espacio suficiente para el archivo temporal. Liberá espacio y reintentá.':error.message;}}
    await this.disk.call('close',{name:j.diskName}).catch(()=>{});await this.save();this.onUpdate();
  }
  async download(q,j){
    try{
      const opened=await this.disk.call('open',{name:j.diskName});if(j.total!=null&&opened.size>j.total)throw new Error('El temporal supera el tamaño del archivo. Cancelalo y volvé a buscar.');
      j.bytes=opened.size;const aligned=j.total!=null&&j.bytes===j.total?j.bytes:Math.floor(j.bytes/TGLCore.CHUNK)*TGLCore.CHUNK;
      if(aligned!==j.bytes){await this.disk.call('truncate',{name:j.diskName,size:aligned});j.bytes=aligned;}
      while(j.total==null||j.bytes<j.total){
        if(this.q!==q||j.status==='cancelled')return;
        if(q.paused){j.status='pending';await this.save();return;}
        if(!this.isScopeOK(q))throw new Error('SCOPE_CHANGED');
        const part=await this.call('chunk',{item:j.item,contextKey:q.context.key,offset:j.bytes},q.tabId);
        if(this.q!==q||j.status==='cancelled')return;
        if(!this.isScopeOK(q))throw new Error('SCOPE_CHANGED');
        const raw=atob(part.data),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);if(bytes.length!==part.bytes||bytes.length>TGLCore.CHUNK)throw new Error('NETWORK_INCOMPLETE_BLOCK');
        if(bytes.length){await this.disk.call('write',{name:j.diskName,offset:j.bytes,data:bytes.buffer});j.bytes+=part.bytes;this.sample(part.bytes);}
        if(part.total!=null){if(j.total!=null&&part.total!==j.total)throw new Error('NETWORK_INCOMPLETE_BLOCK: cambió el tamaño informado del archivo.');j.total=part.total;}
        this.onUpdate();if(Date.now()-this.lastCheckpoint>5000)await this.save();
        if(part.eof){if(j.total==null)j.total=j.bytes;break;}if(!part.bytes)throw new Error('NETWORK_INCOMPLETE_BLOCK');
      }
      if(j.total!=null&&j.bytes!==j.total)throw new Error('NETWORK_INCOMPLETE_BLOCK');
      if(q.mode==='zip'){await this.disk.call('close',{name:j.diskName});j.status='staged';await this.save();return;}
      if(q.paused){j.status='pending';await this.save();return;}
      await this.deliver(q,j);
    }catch(e){await this.failed(q,j,e);}
    finally{await this.disk.call('close',{name:j.diskName}).catch(()=>{});this.running.delete(j.index);this.onUpdate();if(this.q===q)this.pump(q);}
  }
  async deliver(q,j){
    if(!this.isScopeOK(q))throw new Error('SCOPE_CHANGED');
    const file=await this.disk.call('file',{name:j.diskName});const url=URL.createObjectURL(file);this.urls.set(j.index,url);j.status='delivering';await this.save();
    const r=await this.message('saveFile',{url,queueId:q.id,index:j.index,tabId:q.tabId,item:j.item,context:q.context,options:q.options});j.downloadId=r.id;j.savedPath=r.filename;j.status='saving';await this.save();
  }
  async checkDownload(q,j){
    const [d]=await chrome.downloads.search({id:j.downloadId});
    if(d?.state==='complete'&&d.exists===false){this.releaseUrl(j.index);await this.failed(q,j,new Error('El navegador indica que el archivo fue eliminado. Se conserva el temporal para reintentar.'));return;}
    if(d?.state==='complete'){j.status='done';j.bytes=j.total;await this.message('reconcile').catch(()=>{});await this.disk.call('remove',{name:j.diskName}).catch(()=>{});this.releaseUrl(j.index);await this.save();}
    else if(!d||d.state==='interrupted'){
      if(d?.canResume&&j.chromeResumes!==true&&this.isScopeOK(q)&&!q.paused){try{await chrome.downloads.resume(d.id);j.chromeResumes=true;return;}catch{}}
      this.releaseUrl(j.index);await this.failed(q,j,new Error(d?.error||'NETWORK_DOWNLOAD_INTERRUPTED'));
    }
  }
  releaseUrl(index){const u=this.urls.get(index);if(u){URL.revokeObjectURL(u);this.urls.delete(index);}}
  async archive(q){
    if(this.packaging||!this.isScopeOK(q)||q.paused)return;this.packaging=true;
    const part=q.parts[q.currentPart],jobs=this.partJobs(q),key=this.archiveKey(q);
    try{
      q.archiveStatus='packing';q.archiveBytes=0;q.archiveName='zip_'+q.id+'_'+q.currentPart;part.diskName=q.archiveName;await this.save();
      const file=await this.disk.call('zip',{name:q.archiveName,metadataOnly:q.options.zipSaveMode==='folder',entries:jobs.map(j=>({diskName:j.diskName,expectedSize:j.total,name:TGLCore.archivePath(j.item,{...q.options,addId:true})}))},(done,total)=>{q.archiveBytes=done;q.archiveTotal=total;this.onUpdate();});
      if(this.q!==q||q.archiveStatus==='cancelled')return;
      if(!this.isScopeOK(q)||q.paused){q.archiveStatus='idle';await this.save();return;}
      q.archiveStatus='delivering';await this.save();
      const suffix=q.parts.length>1?`_parte_${String(q.currentPart+1).padStart(3,'0')}`:'';
      const item={id:'archive:'+q.id+':'+q.currentPart,messageId:0,name:`Telegram_Lote_${TGLCore.safeSegment(q.context.topic||q.context.channel)}${suffix}.zip`,type:'document',size:file.size};
      if(q.options.zipSaveMode==='folder'){
        const disk=this.disk,name=q.archiveName;const source={size:file.size,stream(){let offset=0;return new ReadableStream({async pull(c){try{if(offset>=file.size){c.close();return;}const data=await disk.call('read',{name,offset}),bytes=new Uint8Array(data);if(!bytes.length||offset+bytes.length>file.size)throw new Error('El ZIP temporal está incompleto.');offset+=bytes.length;c.enqueue(bytes);}catch(e){c.error(e);}}});}};
        await this.destination.save(source,item.name,part,()=>this.save(),(done,total)=>{q.archiveBytes=done;q.archiveTotal=total;this.onUpdate();});
        if(q.archiveStatus!=='cancelled')await this.finishLocal(q,part);return;
      }
      const url=URL.createObjectURL(new Blob([file],{type:'application/zip'}));this.urls.set(key,url);part.expectedSize=file.size;
      const r=await this.message('saveFile',{url,queueId:q.id,index:key,tabId:q.tabId,item,items:jobs.map(j=>j.item),context:q.context,options:{...q.options,addId:false,byType:false}});
      q.archiveId=r.id;part.downloadId=r.id;part.verifyAt=null;part.confirmAt=null;part.chromeResumes=false;part.status='saving';q.archiveStatus='saving';await this.save();
    }catch(e){
      if(q.archiveStatus==='cancelled')return;
      if(e.message.startsWith('INCOMPLETE_TEMPORARY:')){
        const damaged=jobs.find(j=>j.diskName===e.message.split(':')[1]);
        if(damaged){
          await this.disk.call('remove',{name:damaged.diskName}).catch(()=>{});damaged.bytes=0;damaged.diskName='part_'+crypto.randomUUID();damaged.tempRepairs=(damaged.tempRepairs||0)+1;
          if(damaged.tempRepairs<=q.maxRetries){damaged.status='waiting';damaged.retryAt=Date.now()+1000;damaged.error='El temporal quedó incompleto. Se volverá a descargar antes de armar el ZIP.';}
          else{damaged.status='error';damaged.error='El temporal está incompleto. Reintentá para volver a descargar este archivo.';}
        }
        q.archiveStatus='idle';
      }else if(e.name==='QuotaExceededError'&&q.archiveStatus==='packing'&&part.indexes.length>1){
        const halfway=Math.ceil(part.indexes.length/2);q.parts.splice(q.currentPart,1,{indexes:part.indexes.slice(0,halfway),status:'pending'},{indexes:part.indexes.slice(halfway),status:'pending'});
        q.archiveStatus='idle';q.zipNote='Chrome alcanzó su cuota: esta parte se dividió en dos ZIP más pequeños.';
      }else{q.archiveStatus='error';q.archiveError=e.name==='QuotaExceededError'?'No hay espacio para este archivo y su ZIP. Liberá espacio y reintentá; las partes anteriores ya están guardadas.':e.message;}
      await this.save();
    }finally{this.packaging=false;this.onUpdate();}
  }
  async finishLocal(q,part){
    await this.message('localSaved',{queueId:q.id,part:q.currentPart,name:part.savedName,folder:q.destinationName});
    part.status='done';for(const j of this.partJobs(q)){j.status='done';j.savedPath=part.savedName;}
    await this.save();
    for(const j of this.partJobs(q))await this.disk.call('remove',{name:j.diskName}).catch(()=>{});
    if(q.archiveName)await this.disk.call('remove',{name:q.archiveName}).catch(()=>{});
    q.currentPart++;q.archiveName=null;q.archiveBytes=0;q.archiveStatus=q.currentPart>=q.parts.length?'done':'idle';await this.save();
  }
  async checkArchive(q){
    const [d]=await chrome.downloads.search({id:q.archiveId}),part=q.parts[q.currentPart],key=this.archiveKey(q);
    if(d?.state==='complete'&&(d.exists===false||(d.fileSize>=0&&part.expectedSize!=null&&d.fileSize!==part.expectedSize))){
      this.releaseUrl(key);q.archiveStatus='error';q.archiveError=d.exists===false?'El navegador indica que el ZIP fue eliminado. Los temporales se conservan: reintentá con Guardar en carpeta.':'El tamaño guardado no coincide con el ZIP. Los temporales se conservan para reintentar.';await this.save();return;
    }
    if(d?.state==='complete'){
      // search() schedules, rather than awaits, the existence check (10 s throttle).
      if(part.verifyAt==null){part.verifyAt=Date.now()+12000;await this.save();return;}
      if(Date.now()<part.verifyAt)return;
      if(part.confirmAt==null){part.confirmAt=Date.now()+1000;await this.save();return;}
      if(Date.now()<part.confirmAt)return;
      try{await this.message('confirmSaved',{id:q.archiveId});}catch(e){q.archiveStatus='error';q.archiveError=e.message;await this.save();return;}
      part.status='done';part.downloadId=q.archiveId;
      for(const j of this.partJobs(q)){j.status='done';j.downloadId=q.archiveId;await this.disk.call('remove',{name:j.diskName}).catch(()=>{});}
      if(q.archiveName)await this.disk.call('remove',{name:q.archiveName}).catch(()=>{});
      this.releaseUrl(key);await this.message('reconcile').catch(()=>{});q.currentPart++;q.archiveName=null;q.archiveBytes=0;q.archiveStatus=q.currentPart>=q.parts.length?'done':q.jobs.every(j=>['done','cancelled'].includes(j.status))?'cancelled':'idle';await this.save();
    }else if(!d||d.state==='interrupted'){
      if(d?.canResume&&!part.chromeResumes&&!q.paused&&this.isScopeOK(q)){try{await chrome.downloads.resume(d.id);part.chromeResumes=true;return;}catch{}}
      this.releaseUrl(key);q.archiveStatus='error';q.archiveError=d?.error||'El guardado del ZIP se interrumpió.';await this.save();
    }
  }
  pump(q){
    if(this.q!==q||q.paused||!this.isScopeOK(q))return;
    const jobs=q.mode==='zip'?(q.archiveStatus==='idle'?this.partJobs(q):[]):q.jobs;
    let occupied=this.running.size+q.jobs.filter(x=>x.status==='saving').length;
    for(const j of jobs){
      if(j.status==='waiting'&&j.retryAt<=Date.now()){j.status='pending';j.error='';}
      if(occupied>=q.parallel)break;
      if(j.status==='pending'){j.status='transfer';j.error='';this.running.set(j.index,true);occupied++;void this.download(q,j);}
    }
    if(q.mode==='zip'&&!this.running.size&&jobs.length&&jobs.every(j=>j.status==='staged')&&q.archiveStatus==='idle')void this.archive(q);
  }
  async setParallel(value){
    if(!this.q)return;this.q.parallel=Math.min(3,Math.max(1,Math.floor(Number(value)||1)));this.q.options.parallel=this.q.parallel;
    await this.save();this.pump(this.q);this.onUpdate();
  }
  async tick(){
    const q=this.q;if(!q)return;
    for(const j of q.jobs)if(j.status==='saving')await this.checkDownload(q,j);
    this.ensureParts(q);
    if(q.archiveStatus==='saving')await this.checkArchive(q);
    this.pump(q);
    const terminal=q.jobs.every(j=>['done','error','cancelled'].includes(j.status));
    if(terminal&&!q.notified){q.notified=true;await this.save();await this.message('batchFinished',{queueId:q.id,done:q.jobs.filter(j=>j.status==='done').length,errors:q.jobs.filter(j=>j.status==='error').length,notify:q.notify}).catch(()=>{});}
    this.onUpdate();
  }
  async pause(value=true){if(!this.q)return;this.q.paused=value;await this.save();this.onUpdate();}
  async cancel(){if(!this.q)return;await this.pause();this.destination?.abort();for(const j of this.q.jobs){if(['pending','waiting','transfer','staged','error'].includes(j.status)&&!(this.q.archiveStatus==='saving'&&this.partJobs(this.q).includes(j))){j.status='cancelled';await this.disk.call('remove',{name:j.diskName}).catch(()=>{});}}if(!['saving','done'].includes(this.q.archiveStatus)){this.q.archiveStatus='cancelled';if(this.q.archiveName)await this.disk.call('remove',{name:this.q.archiveName}).catch(()=>{});}await this.save();this.onUpdate();}
  async retry(){if(!this.q)return;for(const j of this.q.jobs)if(j.status==='error'){j.status='pending';j.retries=0;j.tempRepairs=0;j.error='';}if(this.q.archiveStatus==='error'){this.q.archiveStatus='idle';this.q.archiveError='';}this.q.paused=false;this.q.notified=false;await this.save();this.onUpdate();}
  async cleanup(){if(this.running.size||this.q?.jobs.some(j=>['transfer','saving','pending','waiting','staged','delivering'].includes(j.status)))throw new Error('Terminá o cancelá los pendientes antes de limpiar temporales.');await this.disk.call('clean',{keep:[]});}
}
globalThis.TGLEngine=TGLEngine;
