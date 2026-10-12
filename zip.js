/* ZIP STORE / ZIP64: streamed payloads, UTF-8, CRC32 and bounded memory. */
(()=>{'use strict';
const MAX32=0xffffffff,MAX16=0xffff;
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes,crc=0xffffffff){for(let i=0;i<bytes.length;i++)crc=table[(crc^bytes[i])&255]^(crc>>>8);return crc>>>0;}
const u16=(v,p,n)=>v.setUint16(p,n,true),u32=(v,p,n)=>v.setUint32(p,n>>>0,true);
function u64(v,p,n){if(!Number.isSafeInteger(n)||n<0)throw new Error('Tamaño ZIP fuera del rango seguro.');v.setBigUint64(p,BigInt(n),true);}
function header(sig,size){const a=new Uint8Array(size);u32(new DataView(a.buffer),0,sig);return a;}
function extra64(values){const a=new Uint8Array(values.length?4+values.length*8:0);if(a.length){const v=new DataView(a.buffer);u16(v,0,1);u16(v,2,values.length*8);values.forEach((n,i)=>u64(v,4+i*8,n));}return a;}
function entryHeaders(name,size,start,crc=0,{forceZip64=false,date=new Date()}={}){
 if(!Number.isSafeInteger(size)||size<0||!Number.isSafeInteger(start)||start<0)throw new Error('Metadatos ZIP inválidos.');
 const encoded=new TextEncoder().encode(name);if(!encoded.length||encoded.length>MAX16)throw new Error('Nombre ZIP demasiado largo o vacío.');
 const largeSize=forceZip64||size>=MAX32,largeOffset=start>=MAX32,version=largeSize||largeOffset?45:20;
 const time=(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1),day=((Math.min(2107,Math.max(1980,date.getFullYear()))-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate();
 const localExtra=largeSize?extra64([0,0]):new Uint8Array(),local=header(0x04034b50,30),lv=new DataView(local.buffer);
 u16(lv,4,largeSize?45:20);u16(lv,6,0x0808);u16(lv,10,time);u16(lv,12,day);if(largeSize){u32(lv,18,MAX32);u32(lv,22,MAX32);}u16(lv,26,encoded.length);u16(lv,28,localExtra.length);
 const values=[];if(largeSize)values.push(size,size);if(largeOffset)values.push(start);const centralExtra=extra64(values),central=header(0x02014b50,46),cv=new DataView(central.buffer);
 u16(cv,4,version);u16(cv,6,version);u16(cv,8,0x0808);u16(cv,12,time);u16(cv,14,day);u32(cv,16,crc);u32(cv,20,largeSize?MAX32:size);u32(cv,24,largeSize?MAX32:size);u16(cv,28,encoded.length);u16(cv,30,centralExtra.length);u32(cv,42,largeOffset?MAX32:start);
 const descriptor=header(0x08074b50,largeSize?24:16),dv=new DataView(descriptor.buffer);u32(dv,4,crc);if(largeSize){u64(dv,8,size);u64(dv,16,size);}else{u32(dv,8,size);u32(dv,12,size);}
 return {encoded,local,localExtra,central,centralExtra,descriptor,zip64:largeSize||largeOffset};
}
async function writeZip(entries,write,onProgress=()=>{},{forceZip64=false,startOffset=0}={}){
 let offset=startOffset,done=0,usedZip64=forceZip64;const central=[];
 if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Posición ZIP inválida.');
 const emit=async a=>{if(!Number.isSafeInteger(offset+a.byteLength))throw new Error('El ZIP supera el rango seguro del navegador.');await write(a,offset);offset+=a.byteLength;};
 for(const entry of entries){
  const start=offset,size=entry.file.size,date=new Date(),initial=entryHeaders(entry.name,size,start,0,{forceZip64,date});await emit(initial.local);await emit(initial.encoded);await emit(initial.localExtra);
  let crc=0xffffffff,read=0;const reader=entry.file.stream().getReader();
  try{while(true){const r=await reader.read();if(r.done)break;if(read+r.value.byteLength>size)throw new Error('El temporal cambió de tamaño.');crc=crc32(r.value,crc);await emit(r.value);read+=r.value.byteLength;done+=r.value.byteLength;onProgress(done);}}finally{reader.releaseLock();}
  if(read!==size)throw new Error('El temporal está incompleto.');
  const final=entryHeaders(entry.name,size,start,(crc^0xffffffff)>>>0,{forceZip64,date});await emit(final.descriptor);central.push(final.central,final.encoded,final.centralExtra);usedZip64 ||= final.zip64;
 }
 const centralStart=offset;for(const c of central)await emit(c);const centralSize=offset-centralStart;usedZip64 ||= entries.length>=MAX16||centralStart>=MAX32||centralSize>=MAX32;
 if(usedZip64){const zip64Start=offset,end64=header(0x06064b50,56),v=new DataView(end64.buffer);u64(v,4,44);u16(v,12,45);u16(v,14,45);u64(v,24,entries.length);u64(v,32,entries.length);u64(v,40,centralSize);u64(v,48,centralStart);await emit(end64);const locator=header(0x07064b50,20),lv=new DataView(locator.buffer);u64(lv,8,zip64Start);u32(lv,16,1);await emit(locator);}
 const end=header(0x06054b50,22),ev=new DataView(end.buffer);u16(ev,8,Math.min(MAX16,entries.length));u16(ev,10,Math.min(MAX16,entries.length));u32(ev,12,Math.min(MAX32,centralSize));u32(ev,16,Math.min(MAX32,centralStart));await emit(end);return offset;
}
globalThis.TGLZip={crc32,entryHeaders,writeZip};if(typeof module!=='undefined')module.exports=globalThis.TGLZip;
})();
