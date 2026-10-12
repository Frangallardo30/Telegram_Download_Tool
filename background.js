'use strict';
importScripts('core.js');
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});
chrome.runtime.onInstalled.addListener(()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}));
chrome.runtime.onStartup.addListener(async()=>{const {queueV2:q}=await chrome.storage.local.get('queueV2');if(q){q.paused=true;await chrome.storage.local.set({queueV2:q});}});
let chain=Promise.resolve();
function serialized(fn){chain=chain.catch(()=>{}).then(fn);return chain;}
async function batchFinished(queueId,notify=true){
  const stored=await chrome.storage.local.get(['queueV2',`notified:${queueId}`]),q=stored.queueV2;if(!q||q.id!==queueId)return;
  const history=await chrome.storage.local.get(q.jobs.map(j=>`history:${q.context.key}:${j.item.id}`));
  const done=q.jobs.filter(j=>history[`history:${q.context.key}:${j.item.id}`]?.date>=q.createdAt).length;
  const errors=q.jobs.filter(j=>j.status==='error').length;
  if(done<q.jobs.length&&!q.jobs.every(j=>['done','error','cancelled'].includes(j.status)))return;
  if(done===q.jobs.length)await chrome.storage.local.set({[`lastDownload:${q.context.key}`]:Math.floor(q.createdAt/1000)});
  if(notify&&q.notify&&!stored[`notified:${queueId}`]){
    await chrome.notifications.create(`batch:${queueId}`,{type:'basic',iconUrl:'icons/icon128.png',title:errors?'Telegram Lote · revisar errores':'Telegram Lote · lote terminado',message:`${done} archivos guardados${errors?` · ${errors} con error`:''}.`,silent:true});
    await chrome.storage.local.set({[`notified:${queueId}`]:true});
  }
}
async function finish(id,confirm=false){
  const key=`active:${id}`,stored=await chrome.storage.local.get(key),entry=stored[key];if(!entry)return;
  const [d]=await chrome.downloads.search({id});if(d&&!['complete','interrupted'].includes(d.state))return;
  await chrome.storage.local.set({[`delivery:${entry.queueId}:${entry.index}`]:{id,state:d?.state||'interrupted'}});
  const archive=typeof entry.index==='string'&&entry.index.startsWith('zip');
  if(archive&&d?.state==='complete'){
    if(!confirm)return;
    if(d.exists===false)throw new Error('El navegador indica que el ZIP fue eliminado. Se conservan los temporales.');
    if(d.fileSize>=0&&entry.expectedSize!=null&&d.fileSize!==entry.expectedSize)throw new Error('El tamaño final del ZIP no coincide. Se conservan los temporales.');
  }
  if(d?.state==='complete'&&d.exists!==false&&!(d.fileSize>=0&&entry.expectedSize!=null&&d.fileSize!==entry.expectedSize)){
    const records={};for(const item of entry.items)records[`history:${entry.contextKey}:${item.id}`]={date:Date.now(),name:item.name,downloadId:id};await chrome.storage.local.set(records);
    const {queueV2:q}=await chrome.storage.local.get('queueV2');if(q?.id===entry.queueId&&q.jobs.every(j=>['saving','done','staged','delivering'].includes(j.status)))await batchFinished(q.id,q.notify);
  }
  await chrome.storage.local.remove(key);
}
chrome.downloads.onChanged.addListener(d=>{if(['complete','interrupted'].includes(d.state?.current))void serialized(()=>finish(d.id)).catch(()=>{});});
chrome.notifications.onClicked.addListener(async notificationId=>{if(!notificationId.startsWith('batch:'))return;const {queueV2:q}=await chrome.storage.local.get('queueV2');const id=q?.archiveId||q?.jobs.find(j=>j.downloadId)?.downloadId;if(id!=null)chrome.downloads.show(id);});
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('panel.html'))return;
  const run=async()=>{
    if(message.type==='saveFile'){
      const p=message.payload,origin=chrome.runtime.getURL('').replace(/\/$/,'');
      if(!p?.url?.startsWith('blob:'+origin+'/')||!Number.isInteger(p.tabId)||!p.queueId)throw new Error('Origen de descarga inválido.');
      const tab=await chrome.tabs.get(p.tabId);if(!tab.url?.startsWith('https://web.telegram.org/k/'))throw new Error('La pestaña ya no está en Telegram Web K.');
      const [scope]=await chrome.scripting.executeScript({target:{tabId:p.tabId},world:'MAIN',func:()=>window.__telegramLote?.dispatch('snapshot',{from:10000})});
      if(scope.result?.liveKey!==p.context.key)throw new Error('Cambiaste de tema antes de guardar.');
      const filename=TGLCore.downloadPath(p.item,p.context,p.options);
      const id=await chrome.downloads.download({url:p.url,filename,saveAs:false,conflictAction:'uniquify'});
      await chrome.storage.local.set({[`active:${id}`]:{queueId:p.queueId,index:p.index,contextKey:p.context.key,items:p.items||[p.item],expectedSize:p.item.size},[`delivery:${p.queueId}:${p.index}`]:{id,state:'in_progress'}});
      await serialized(()=>finish(id));return {id,filename};
    }
    if(message.type==='confirmSaved'){await serialized(()=>finish(message.payload.id,true));return true;}
    if(message.type==='localSaved'){
      const p=message.payload,{queueV2:q}=await chrome.storage.local.get('queueV2');
      if(!q||q.id!==p.queueId||q.mode!=='zip'||q.options.zipSaveMode!=='folder'||!Number.isInteger(p.part)||p.part!==q.currentPart||!q.parts[p.part])throw new Error('El ZIP no pertenece a la cola actual.');
      const records={};for(const index of q.parts[p.part].indexes){const item=q.jobs[index].item;records[`history:${q.context.key}:${item.id}`]={date:Date.now(),name:item.name,localName:p.name,folder:p.folder};}
      await chrome.storage.local.set(records);return true;
    }
    if(message.type==='reconcile'){
      const all=await chrome.storage.local.get(null);for(const key of Object.keys(all).filter(k=>k.startsWith('active:')))await serialized(()=>finish(Number(key.slice(7))));return true;
    }
    if(message.type==='batchFinished'){await serialized(()=>batchFinished(message.payload.queueId,message.payload.notify));return true;}
    throw new Error('Acción desconocida.');
  };
  run().then(value=>sendResponse({ok:true,value}),error=>sendResponse({ok:false,error:error.message}));return true;
});
