const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.existsSync(path.resolve(__dirname,'../telegram-lote-v2/manifest.json'))?path.resolve(__dirname,'../telegram-lote-v2'):path.resolve(__dirname,'..');
const C=require(path.join(source,'core.js'));
const ctx={key:'99:-42:4294967617',channel:'Materiales / 2026',topic:'Tema: Planos',isForum:true,threadId:4294967617,serverThreadId:321};
function msg(topic=321,extra={}){return {_: 'message',id:900,date:1700000000,reply_to:{reply_to_top_id:topic,pFlags:{forum_topic:true}},media:{document:{_: 'document',id:'77',size:123,mime_type:'application/pdf',attributes:[{_: 'documentAttributeFilename',file_name:'Plano.pdf'}]}},...extra};}
test('scope: topic, sibling, General and forum root are distinct',()=>{
 assert.equal(C.belongsToTopic(msg(),ctx),true);assert.equal(C.belongsToTopic(msg(444),ctx),false);
 assert.equal(C.belongsToTopic(msg(4294967617),ctx),true);
 const general={...ctx,serverThreadId:1,threadId:4294967297};
 assert.equal(C.belongsToTopic(msg(0),general),true);assert.equal(C.belongsToTopic(msg(321),general),false);
 assert.equal(C.belongsToTopic(msg(),{...ctx,threadId:0,serverThreadId:0}),false);
});
test('topic starter and direct reply both belong to topic',()=>{
 assert.equal(C.belongsToTopic(msg(0,{id:321}),ctx),true);
 assert.equal(C.belongsToTopic(msg(0,{reply_to:{reply_to_msg_id:321,pFlags:{forum_topic:true}}}),ctx),true);
 assert.equal(C.belongsToTopic(msg(0,{reply_to:{reply_to_msg_id:321,pFlags:{}}}),ctx),false);
});
test('documents sent without file_name recover Telegram filename attribute',()=>{
 const r=C.normalizeMessage(msg(),ctx);assert.equal(r.item.name,'Plano.pdf');assert.equal(r.item.type,'document');assert.equal(r.item.size,123);
});
test('protected, expiring and sticker content is excluded',()=>{
 assert.equal(C.normalizeMessage(msg(321,{pFlags:{noforwards:true}}),ctx),null);
 const m=msg();m.media.ttl_seconds=30;assert.equal(C.normalizeMessage(m,ctx),null);
 const s=msg();s.media.document.attributes.push({_: 'documentAttributeSticker'});assert.equal(C.normalizeMessage(s,ctx),null);
});
test('audio, voice, video, images and archives classify correctly',()=>{
 assert.equal(C.classify({mime_type:'audio/ogg'}),'audio');
 assert.equal(C.classify({mime_type:'application/octet-stream',attributes:[{_: 'documentAttributeVideo'}]}),'video');
 assert.equal(C.classify({mime_type:'image/png'}),'image');assert.equal(C.classify({_:'photo'}),'image');
 assert.equal(C.classify({mime_type:'application/zip'}),'document');
});
test('full-resolution photo size is used rather than a thumbnail',()=>{
 const m=msg();m.media={photo:{_:'photo',id:'12',sizes:[{_:'photoStrippedSize',bytes:[]},{_:'photoSize',w:100,h:100,size:10,type:'s'},{_:'photoSizeProgressive',w:1200,h:1000,sizes:[50,100,400],type:'y'}]}};
 const r=C.normalizeMessage(m,ctx);assert.equal(r.item.size,400);assert.equal(r.thumb.type,'y');assert.equal(r.item.name,'Foto_900.jpg');
});
test('filters include day bounds, sizes, extension and filename search',()=>{
 const item=C.normalizeMessage(msg(),ctx).item;
 const f={types:['document'],extensions:['pdf'],query:'PLANO',minDate:item.date,maxDate:item.date+1,minSize:120,maxSize:150};
 assert.equal(C.matches(item,f),true);assert.equal(C.matches(item,{...f,maxDate:item.date}),false);assert.equal(C.matches(item,{...f,extensions:['zip']}),false);
 assert.equal(C.matches({...item,size:null},f),false);
});
test('path sanitization preserves extension and prevents traversal/reserved names',()=>{
 const p=C.downloadPath({name:'../../CON.pdf',messageId:900,type:'document'},ctx,{byType:true});
 assert.ok(p.startsWith('Telegram Lote/Materiales _ 2026/Tema_ Planos/Documentos/'));assert.ok(!p.split('/').includes('..'));assert.ok(p.endsWith('_m900.pdf'));
 assert.equal(C.safeSegment('CON'),'_CON');assert.equal(C.safeSegment('..'),'Sin nombre');assert.equal(C.safeSegment('a\u202eb'),'a_b');
 const long=C.safeFileName('x'.repeat(300)+'.pdf');assert.ok(long.endsWith('.pdf'));assert.ok(long.length<120);
});
test('search includes documents for uncompressed media, and only relevant categories',()=>{
 assert.deepEqual(C.filtersFor(['document']),['inputMessagesFilterDocument']);assert.ok(C.filtersFor(['image']).includes('inputMessagesFilterDocument'));assert.ok(C.filtersFor(['audio']).includes('inputMessagesFilterVoice'));
});
