/* Original implementation. No dependencies or remote code. */
(() => {
  'use strict';
  const TYPES = {image:'Imágenes', video:'Videos', document:'Documentos', audio:'Audio'};
  const MIME_EXT = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','video/mp4':'mp4','video/webm':'webm','audio/ogg':'ogg','audio/mpeg':'mp3','audio/mp4':'m4a','audio/flac':'flac','application/pdf':'pdf','application/zip':'zip'};
  const extension = name => (String(name).match(/\.([a-z0-9]{1,16})$/i)?.[1] || '').toLowerCase();
  function classify(media) {
    if(media?._ === 'photo') return 'image';
    const attrs = media?.attributes || [];
    if(attrs.some(a => a._ === 'documentAttributeAudio') || /^audio\//.test(media?.mime_type || '')) return 'audio';
    if(attrs.some(a => a._ === 'documentAttributeVideo' || a._ === 'documentAttributeAnimated') || /^video\//.test(media?.mime_type || '')) return 'video';
    if(/^image\//.test(media?.mime_type || '') || /^(jpg|jpeg|png|webp|heic|heif|bmp|tif|tiff)$/.test(extension(media?.file_name))) return 'image';
    return 'document';
  }
  function safeSegment(value, fallback = 'Sin nombre') {
    let s = String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>:"/\\|?*]/g,'_').trim().replace(/^[.\s]+|[.\s]+$/g,'');
    if(!s || /^\.+$/.test(s)) s = fallback;
    if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)) s = '_' + s;
    return Array.from(s).slice(0,110).join('');
  }
  function safeFileName(value) {
    const ext = extension(value), clean = safeSegment(value,'archivo');
    if(ext && !clean.toLowerCase().endsWith('.'+ext)) return clean.slice(0,95)+'.'+ext;
    return clean;
  }
  function namedFile(item, options = {}) {
    let name = safeFileName(item.name);
    if(options.addId !== false) {
      const ext = extension(name), stem = ext ? name.slice(0,-ext.length-1) : name;
      name = `${stem}_m${String(item.messageId).replace(/\D/g,'')}${ext ? '.'+ext : ''}`;
    }
    return name;
  }
  function downloadPath(item, context, options = {}) {
    const dirs = [safeSegment(options.folder || 'Telegram Lote'),safeSegment(context.channel)];
    if(context.threadId) dirs.push(safeSegment(context.topic || 'Tema '+context.serverThreadId));
    if(options.byType) dirs.push(TYPES[item.type] || 'Otros');
    return [...dirs,namedFile(item,options)].join('/');
  }
  function archivePath(item, options = {}) {
    const name = namedFile(item,options);
    return options.byType ? `${TYPES[item.type] || 'Otros'}/${name}` : name;
  }
  function formatBytes(n) {
    if(!Number.isFinite(n) || n < 0) return 'Tamaño desconocido';
    if(n === 0) return '0 B';
    const i = Math.min(5, Math.floor(Math.log(n)/Math.log(1024)));
    return `${(n/1024**i).toLocaleString('es-AR',{maximumFractionDigits:i ? 1 : 0})} ${['B','KB','MB','GB','TB','PB'][i]}`;
  }
  function topicOf(message) {
    const r = message?.reply_to;
    return (Number(r?.reply_to_top_id || (r?.pFlags?.forum_topic || r?.forum_topic ? r.reply_to_msg_id : 0)) || 0) % 4294967296;
  }
  function belongsToTopic(message, context) {
    if(!context.serverThreadId) return !context.isForum;
    const id = Number(message.id || message.mid) % 4294967296;
    const r = message.reply_to || {};
    if(context.isForum) {
      const topic = topicOf(message);
      return id === context.serverThreadId || (context.serverThreadId === 1 ? topic === 0 || topic === 1 : topic === context.serverThreadId);
    }
    return id === context.serverThreadId || Number(r.reply_to_top_id || r.reply_to_msg_id) % 4294967296 === context.serverThreadId;
  }
  function normalizeMessage(message, context) {
    if(message?._ !== 'message' || !belongsToTopic(message,context) || (!context.allowRestricted && (message.pFlags?.noforwards || message.noforwards)) || message.media?.ttl_seconds) return null;
    if(context.peerId<0&&message.peer_id){const channel=Number(message.peer_id.channel_id||message.peer_id.chat_id);if(channel!==Math.abs(context.peerId))return null;}
    const media = message.media?.document || message.media?.photo;
    if(!media || !['document','photo'].includes(media._)) return null;
    if(media.attributes?.some(a=>a._ === 'documentAttributeSticker' || a._ === 'documentAttributeCustomEmoji')) return null;
    const type = classify(media), mid = Number(message.id || message.mid) % 4294967296;
    const photoSizes = (media.sizes || []).filter(s => s._ === 'photoSize' || s._ === 'photoSizeProgressive');
    const photo = photoSizes.slice().sort((a,b)=>(b.w*b.h)-(a.w*a.h))[0];
    const size = Number(media.size ?? photo?.size ?? photo?.sizes?.at(-1) ?? NaN);
    const attributeName = media.attributes?.find(a=>a._==='documentAttributeFilename')?.file_name;
    const ext = media._ === 'photo' ? 'jpg' : (MIME_EXT[media.mime_type] || 'bin');
    const name = media.file_name || attributeName || `${type === 'image' ? 'Foto' : type === 'video' ? 'Video' : type === 'audio' ? 'Audio' : 'Archivo'}_${mid}.${ext}`;
    return {item:{id:`${media._}:${media.id}`,messageId:mid,mid:message.mid || message.id,name,type,size:Number.isFinite(size)?size:null,date:Number(message.date)||0,ext:extension(name),caption:String(message.message||'').slice(0,500)},media,thumb:photo};
  }
  function matches(item, filters) {
    if(!filters.types.includes(item.type)) return false;
    if(filters.extensions?.length && !filters.extensions.includes(item.ext)) return false;
    if(filters.query && !`${item.name} ${item.caption}`.toLocaleLowerCase('es').includes(filters.query.toLocaleLowerCase('es'))) return false;
    if(filters.minDate && item.date < filters.minDate) return false;
    if(filters.maxDate && item.date >= filters.maxDate) return false;
    if(filters.minSize && (item.size == null || item.size < filters.minSize)) return false;
    if(filters.maxSize && (item.size == null || item.size > filters.maxSize)) return false;
    return true;
  }
  function filtersFor(types) {
    const out = new Set();
    if(types.includes('image')) out.add('inputMessagesFilterPhotos');
    if(types.includes('video')) {out.add('inputMessagesFilterVideo');out.add('inputMessagesFilterRoundVideo');out.add('inputMessagesFilterGif');}
    if(types.includes('audio')) {out.add('inputMessagesFilterMusic');out.add('inputMessagesFilterVoice');}
    // Uncompressed images, audio and videos can also be sent as documents.
    out.add('inputMessagesFilterDocument');
    return [...out];
  }
  const CHUNK=512*1024;
  function formatDuration(seconds){if(!Number.isFinite(seconds)||seconds<0)return 'Calculando…';seconds=Math.ceil(seconds);if(seconds<60)return `${seconds} s`;if(seconds<3600)return `${Math.floor(seconds/60)} min ${seconds%60} s`;return `${Math.floor(seconds/3600)} h ${Math.floor(seconds%3600/60)} min`;}
  function retryDelay(error,attempt){const text=String(error?.message||error),flood=text.match(/FLOOD(?:_PREMIUM)?_WAIT_(\d+)/);if(flood)return Number(flood[1])*1000;if(/NETWORK|TIMEOUT|CONNECTION|INCOMPLETE_BLOCK|FILE_REFERENCE|temporar|SERVER_ERROR|RPC_CALL_FAIL/i.test(text))return Math.min(60000,2000*2**Math.max(0,attempt-1));return null;}
  function latest(items,n){return items.slice().sort((a,b)=>b.date-a.date||b.messageId-a.messageId).slice(0,n);}
  function zipEligible(items){return items.length>0&&items.every(x=>Number.isSafeInteger(x.size)&&x.size>=0)&&Number.isSafeInteger(items.reduce((s,x)=>s+x.size,0));}
  function zipParts(items,cap){
    if(!zipEligible(items)||!Number.isSafeInteger(cap)||cap<1)throw new Error('Tamaños ZIP inválidos.');
    const parts=[];let indexes=[],bytes=98;
    items.forEach((item,index)=>{const size=item.size+4096;if(indexes.length&&bytes+size>cap){parts.push({indexes,total:bytes});indexes=[];bytes=98;}indexes.push(index);bytes+=size;});
    if(indexes.length)parts.push({indexes,total:bytes});return parts;
  }
  globalThis.TGLCore = Object.freeze({TYPES,CHUNK,formatDuration,retryDelay,latest,zipEligible,zipParts,extension,classify,safeSegment,safeFileName,downloadPath,archivePath,formatBytes,belongsToTopic,normalizeMessage,matches,filtersFor});
  if(typeof module !== 'undefined') module.exports = globalThis.TGLCore;
})();
