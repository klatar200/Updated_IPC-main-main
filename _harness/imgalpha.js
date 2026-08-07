/** One-shot: do the product PNGs actually USE their alpha channel? */
const sharp=require('sharp'),fs=require('fs'),path=require('path');
(async()=>{
 for(const dir of ['products','site']){
  const d=path.join('public','images',dir);
  for(const f of fs.readdirSync(d).filter(x=>x.endsWith('.png')||x.endsWith('.webp'))){
   const p=path.join(d,f);
   const m=await sharp(p).metadata();
   if(!m.hasAlpha){console.log('no-alpha  ',p);continue;}
   const {data,info}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let min=255,trans=0;
   for(let i=info.channels-1;i<data.length;i+=info.channels){const a=data[i]; if(a<min)min=a; if(a<250)trans++;}
   const pct=(100*trans/(info.width*info.height)).toFixed(1);
   console.log((min===255?'opaque   ':'ALPHA    '), `min=${String(min).padStart(3)} translucent=${pct.padStart(5)}%`, p);
  }
 }
})();
