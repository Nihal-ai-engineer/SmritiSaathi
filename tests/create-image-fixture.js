// A plain test pixel, never a seeded user photo or application asset.
import {deflateSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const body=Buffer.concat([Buffer.from(type),data]),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE(crc(body),out.length-4);return out;}
const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
writeFileSync(new URL('./pixel.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.from([0,60,110,90,255]))),chunk('IEND',Buffer.alloc(0))]));
