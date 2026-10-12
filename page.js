/* Runs only in Telegram's MAIN world, invoked directly through chrome.scripting. */
(() => {
  'use strict';
  if(window.__telegramLote?.version === 2) return;
  const C = window.TGLCore;
  const state = {context:null,scan:{status:'idle',found:0,checked:0,phase:'',error:'',truncated:false},scanId:0,items:new Map(),media:new Map(),preparations:new Map(),generation:0,allowRestricted:false};
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const managers = () => window.appImManager?.managers || window.rootScope?.managers;
  function identity() {
    const chat = window.appImManager?.chat;
    if(!chat?.peerId) throw new Error('Abrí un canal o un tema en Telegram Web K.');
    const account = String(window.rootScope?.myId || window.appImManager?.myId || '');
    if(!account) throw new Error('Iniciá sesión en Telegram Web K y abrí un canal.');
    return {account,peerId:Number(chat.peerId),threadId:Number(chat.threadId)||0,key:`${account}:${Number(chat.peerId)}:${Number(chat.threadId)||0}`};
  }
  async function context() {
    if(!location.pathname.startsWith('/k/')) throw new Error('Esta versión funciona en Telegram Web K. Abrí web.telegram.org/k/.');
    const m = managers();
    if(!m?.apiManager || !m?.appMessagesManager || !window.appDownloadManager?.downloadMedia) throw new Error('Telegram todavía está cargando o cambió su integración. Esperá unos segundos y volvé a conectar.');
    const id = identity(), chat = window.appImManager.chat;
    const peer = await m.appPeersManager.getPeer(id.peerId);
    const isForum = !!(peer?.pFlags?.forum || peer?.forum || chat.isForum || await m.appPeersManager.isForum?.(id.peerId));
    if(isForum && !id.threadId) throw new Error('Este grupo tiene temas. Abrí el tema que querés descargar; no se permite buscar en todos los temas.');
    const restricted=!!(peer?.pFlags?.noforwards || peer?.noforwards || await m.appPeersManager.noForwards?.(id.peerId));
    if(restricted && !state.allowRestricted) throw new Error('Este canal tiene el guardado de contenido restringido. Activá la opción de contenido con guardado restringido para intentar descargarlo.');
    if(chat.isMonoforum || chat.isBotforum || chat.monoforumThreadId) throw new Error('Este tipo de conversación todavía no es compatible. Abrí un canal o un tema de un grupo estándar.');
    let serverThreadId = 0;
    if(id.threadId) {
      if(m.appMessagesIdsManager?.getMessageIdInfo) serverThreadId = Number((await m.appMessagesIdsManager.getMessageIdInfo(id.threadId)).messageId);
      else serverThreadId = id.threadId % 4294967296;
      if(!Number.isInteger(serverThreadId) || serverThreadId < 1) throw new Error('No se pudo identificar el tema abierto. Volvé a abrirlo y conectá de nuevo.');
    }
    let topic = '';
    if(id.threadId) {
      try { topic = (await m.dialogsStorage?.getForumTopic?.(id.peerId,id.threadId))?.title || ''; } catch {}
      // Header text is a label only; the scope ALWAYS comes from Telegram's thread ID.
      if(!topic) topic = document.querySelector('.chat.active .chat-info .title, .chat .chat-info .title')?.textContent?.trim() || (serverThreadId===1?'General':`Tema ${serverThreadId}`);
    }
    const result = {...id,serverThreadId,isForum,restricted,allowRestricted:state.allowRestricted,channel:peer?.title || [peer?.first_name,peer?.last_name].filter(Boolean).join(' ') || 'Canal abierto',topic};
    if(identity().key !== id.key) throw new Error('Cambiaste de tema durante la conexión. Volvé a conectar.');
    return result;
  }
  function assertScope(expected) {
    if(identity().key !== expected.key) throw new Error('Cambiaste de canal, tema o cuenta. Conectá y buscá de nuevo.');
  }
  function stopScan() {state.generation++;if(state.scan.status === 'running') state.scan.status='stopped';}
  async function scan(filters, ctx, generation) {
    const m = managers();
    const seen = new Set(), searchFilters=C.filtersFor(filters.types);
    const finishScan=()=>{if(filters.latestN){const chosen=[...state.items.values()].sort((a,b)=>b.date-a.date||b.messageId-a.messageId).slice(0,filters.latestN);state.items=new Map(chosen.map(x=>[x.id,x]));state.scan.found=chosen.length;}state.scan.status="done";state.scan.phase="Búsqueda completa";};
    try {
      const inputPeer = await m.appPeersManager.getInputPeerById(ctx.peerId);
      for(let f=0;f<searchFilters.length;f++) {
        let offset=0;const filterFound=new Set();
        state.scan.phase=`Buscando ${f+1} de ${searchFilters.length}`;
        while(generation===state.generation) {
          assertScope(ctx);
          let result;
          try {
            result = await m.apiManager.invokeApi('messages.search',{peer:inputPeer,q:'',filter:{_:searchFilters[f]},min_date:filters.minDate ? filters.minDate-1 : 0,max_date:filters.maxDate||0,offset_id:offset,add_offset:0,limit:Math.min(100,filters.latestN||100),max_id:0,min_id:0,hash:'0',...(ctx.serverThreadId?{top_msg_id:ctx.serverThreadId}:{})});
          } catch(err) {
            const message=String(err?.type||err?.message||err), wait=message.match(/FLOOD(?:_PREMIUM)?_WAIT_(\d+)/);
            if(wait) {
              state.scan.phase=`Telegram pide esperar ${wait[1]} s`;
              for(let sec=Number(wait[1]);sec>0;sec--){if(generation!==state.generation)return;assertScope(ctx);await sleep(1000);}
              continue;
            }
            if(message.includes('INPUT_FILTER_INVALID') && /RoundVideo|Gif/.test(searchFilters[f])) break;
            throw err;
          }
          if(generation!==state.generation)return;
          assertScope(ctx);
          const raw=result?.messages;
          if(!Array.isArray(raw))throw new Error('Telegram devolvió una respuesta de búsqueda no compatible.');
          if(!raw.length)break;
          const rawIds = raw.map(x=>Number(x.id)).filter(x=>x>0);
          const next=Math.min(...rawIds);
          // Validate raw server IDs before Web K converts reply IDs to its local representation.
          const records=raw.map(message=>C.normalizeMessage(message,ctx)).filter(Boolean);
          const saved=await m.appMessagesManager.saveMessages(raw);
          const savedMedia=new Map((saved||raw).map(message=>{const media=message?.media?.document||message?.media?.photo;return [media?`${media._}:${media.id}`:'',message];}));
          if(generation!==state.generation)return;
          assertScope(ctx);
          for(const record of records) {
            const enriched=savedMedia.get(record.item.id);record.media=enriched?.media?.document||enriched?.media?.photo||record.media;record.item.mid=enriched?.mid||record.item.mid;
            const messageKey=String(record.item.messageId);
            if(!seen.has(messageKey)){seen.add(messageKey);state.scan.checked++;}
            if(C.matches(record.item,filters))filterFound.add(record.item.id);
            if(C.matches(record.item,filters) && !state.items.has(record.item.id)) {
              state.items.set(record.item.id,record.item);state.media.set(record.item.id,record);state.scan.found++;
              
              if(!filters.latestN && state.items.size>=filters.limit){state.scan.truncated=true;finishScan();return;}
            }
          }
          if(filters.latestN && filterFound.size>=filters.latestN)break;
          if(!Number.isFinite(next) || next<=0 || (offset && next>=offset))break;
          offset=next;
          await sleep(450);
        }
        if(generation!==state.generation)return;
      }
      if(generation===state.generation)finishScan();
    } catch(err) {
      if(generation===state.generation){state.scan.status='error';state.scan.error=String(err?.type||err?.message||err);}
    }
  }
  function release(token) {
    const p=state.preparations.get(token);
    if(p?.url)URL.revokeObjectURL(p.url);
    if(p){clearTimeout(p.cleanupTimer);p.promise?.cancel?.();state.preparations.delete(token);}
  }
  async function prepare(id, token, ctx) {
    const p={token,id,status:'loading',done:0,total:0,error:'',url:''};state.preparations.set(token,p);
    p.cleanupTimer=setTimeout(()=>release(token),30*60*1000);
    try {
      assertScope(ctx);
      const fresh=await context();if(fresh.key!==ctx.key)throw new Error('Cambió el tema.');
      const record=state.media.get(id);if(!record)throw new Error('El archivo ya no está disponible. Volvé a buscar.');
      if(record.item.size>16*1024*1024)throw new Error('Usá la descarga por bloques para este archivo grande.');
      const options={media:record.media};if(record.media._==='photo' && record.thumb)options.thumb=record.thumb;
      p.total=record.item.size||0;
      p.promise=window.appDownloadManager.downloadMedia(options);
      p.promise.addNotifyListener?.(progress=>{p.done=Number(progress.done||progress.offset||0);p.total=Number(progress.total||p.total);});
      const blob=await p.promise;
      if(!state.preparations.has(token))return;
      assertScope(ctx);
      if(!(blob instanceof Blob))throw new Error('Telegram no devolvió un archivo válido.');
      if(record.item.size && blob.size!==record.item.size)throw new Error('La descarga está incompleta. Reintentá el archivo.');
      p.url=URL.createObjectURL(blob);p.done=blob.size;p.total=blob.size;p.status='ready';p.promise=null;
    } catch(err) {if(state.preparations.has(token)){p.status='error';p.error=String(err?.type||err?.message||err);p.promise=null;}}
  }

  function base64(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
  async function recordFor(item,key){
    const ctx=await context();if(ctx.key!==key)throw new Error('Cambiaste de canal, tema o cuenta.');
    const cached=state.context?.key===key && state.media.get(item.id);if(cached)return {record:cached,ctx};
    const m=managers(),peer=await m.appPeersManager.getInputPeerById(ctx.peerId),ids=[{_:'inputMessageID',id:Number(item.messageId)}];
    const response=peer._==='inputPeerChannel'?await m.apiManager.invokeApi('channels.getMessages',{channel:{_:'inputChannel',channel_id:peer.channel_id,access_hash:peer.access_hash},id:ids}):await m.apiManager.invokeApi('messages.getMessages',{id:ids});
    assertScope(ctx);const raw=response?.messages?.find(x=>Number(x.id)===Number(item.messageId));const record=C.normalizeMessage(raw,ctx);
    if(!record || record.item.id!==item.id)throw new Error('El archivo ya no pertenece a este tema, cambió o no está disponible.');
    const saved=(await m.appMessagesManager.saveMessages([raw]))?.[0];assertScope(ctx);record.media=saved?.media?.document||saved?.media?.photo||record.media;record.item.mid=saved?.mid||record.item.mid;
    state.context=ctx;state.media.set(item.id,record);return {record,ctx};
  }
  async function chunk(args){
    const limit=512*1024,offset=Number(args.offset);if(!Number.isSafeInteger(offset)||offset<0||offset%limit)throw new Error('Bloque de descarga inválido.');
    const {record,ctx}=await recordFor(args.item,args.contextKey),m=managers(),media=record.media,total=record.item.size;
    if(total!=null&&offset>=total)return {data:'',bytes:0,total,eof:true};
    let result;
    if(media._==='document'){
      if(!m.appDocsManager?.requestDocPart)throw new Error('Telegram no ofrece la descarga por bloques en esta versión.');
      result=await m.appDocsManager.requestDocPart(media.id,media.dc_id,offset,limit);
    }else{
      if(!record.thumb?.type||!m.apiFileManager?.requestFilePart)throw new Error('La foto no ofrece un original descargable por bloques.');
      result=await m.apiFileManager.requestFilePart({dcId:media.dc_id,location:{_:'inputPhotoFileLocation',id:media.id,access_hash:media.access_hash,file_reference:media.file_reference,thumb_size:record.thumb.type},offset,limit});
    }
    assertScope(ctx);let bytes=result?.bytes;if(bytes instanceof ArrayBuffer)bytes=new Uint8Array(bytes);else if(!(bytes instanceof Uint8Array))bytes=Uint8Array.from(bytes||[]);
    const wanted=total==null?limit:Math.min(limit,total-offset);
    if(total!=null&&bytes.length<wanted)throw new Error('NETWORK_INCOMPLETE_BLOCK: Telegram devolvió un bloque incompleto.');
    if(bytes.length>limit)throw new Error('Bloque de Telegram fuera de tamaño.');
    if(total!=null)bytes=bytes.subarray(0,wanted);
    return {data:base64(bytes),bytes:bytes.length,total,eof:total!=null?offset+bytes.length>=total:bytes.length<limit};
  }
  async function preview(args){
    const {record,ctx}=await recordFor(args.item,args.contextKey),media=record.media;
    const thumbs=(media.thumbs||media.sizes||[]).filter(x=>['photoSize','photoSizeProgressive'].includes(x._)).sort((a,b)=>a.w*a.h-b.w*b.h);
    const thumb=thumbs.find(x=>(x.size||x.sizes?.at(-1)||0)<=256*1024);if(!thumb)return null;
    const blob=await window.appDownloadManager.downloadMedia({media,thumb});assertScope(ctx);
    if(!(blob instanceof Blob)||blob.size>256*1024)return null;
    return 'data:image/jpeg;base64,'+base64(new Uint8Array(await blob.arrayBuffer()));
  }

  async function dispatch(command,args={}) {
    if(command==='configure'){state.allowRestricted=args.allowRestricted===true;return true;}
    if(command==='hello')return await context();
    if(command==='chunk')return await chunk(args);
    if(command==='preview')return await preview(args);
    if(command==='openMessage'){const {record,ctx}=await recordFor(args.item,args.contextKey);await window.appImManager.setInnerPeer({peerId:ctx.peerId,threadId:ctx.threadId||undefined,lastMsgId:record.item.mid});return true;}
    if(command==='startScan') {
      if([...state.preparations.values()].some(p=>p.status==='loading'||p.status==='ready'))throw new Error('Terminá o cancelá la cola antes de volver a buscar.');
      const ctx=await context();stopScan();state.scanId=state.generation;state.context=ctx;state.items.clear();state.media.clear();
      state.scan={status:'running',found:0,checked:0,phase:'Iniciando búsqueda',error:'',truncated:false};
      const filters=args.filters;
      if(!Array.isArray(filters?.types)||!filters.types.length)throw new Error('Elegí al menos un tipo de archivo.');
      filters.limit=Math.max(1,Math.min(10000,Number(filters.limit)||1000));
      void scan(filters,ctx,state.generation);return {...ctx,scanId:state.scanId};
    }
    if(command==='stopScan'){stopScan();return true;}
    if(command==='snapshot') {
      let liveKey='',liveError='';try{liveKey=identity().key;}catch(e){liveError=e.message;}
      if(state.scan.status==='running' && liveKey!==state.context?.key){stopScan();state.scan.error='Cambiaste de tema. La búsqueda se detuvo.';}
      return {context:state.context,scanId:state.scanId,liveKey,liveError,scan:{...state.scan},items:[...state.items.values()].slice(Number(args.from)||0),preparations:[...state.preparations.values()].map(({token,id,status,done,total,error,url})=>({token,id,status,done,total,error,url}))};
    }
    if(command==='prepare') {assertScope(state.context);if(state.preparations.has(args.token))throw new Error('Preparación duplicada.');void prepare(args.id,args.token,state.context);return true;}
    if(command==='release'){release(args.token);return true;}
    throw new Error('Comando no reconocido.');
  }
  Object.defineProperty(window,'__telegramLote',{value:Object.freeze({version:2,dispatch}),configurable:true});
})();
