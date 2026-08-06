/**
 * 4.32 evidence: PSNR between the before and after full-page screenshots.
 * Same code, same layout, only the image bytes differ — so this scores what a
 * visitor would actually see, not what the encoder did to a file in isolation.
 */
const sharp=require('sharp'),fs=require('fs'),path=require('path');
const D=path.join(__dirname,'out','plan5-images');
(async()=>{
 const names=fs.readdirSync(path.join(D,'after')).filter(f=>f.endsWith('.png')).sort();
 let worst={p:Infinity};
 for(const n of names){
  const a=path.join(D,'before',n), b=path.join(D,'after',n);
  if(!fs.existsSync(a)) continue;
  const ma=await sharp(a).metadata(), mb=await sharp(b).metadata();
  const w=Math.min(ma.width,mb.width), h=Math.min(ma.height,mb.height);
  const norm=s=>sharp(s).extract({left:0,top:0,width:w,height:h}).removeAlpha().raw().toBuffer();
  const [x,y]=[await norm(a),await norm(b)];
  let sum=0; for(let i=0;i<x.length;i++){const d=x[i]-y[i];sum+=d*d;}
  const mse=sum/x.length, p=mse===0?Infinity:10*Math.log10(65025/mse);
  const diffPx=(()=>{let c=0;for(let i=0;i<x.length;i+=3){if(Math.abs(x[i]-y[i])>8||Math.abs(x[i+1]-y[i+1])>8||Math.abs(x[i+2]-y[i+2])>8)c++;}return c;})();
  console.log(`${(p===Infinity?'  inf':p.toFixed(1)).padStart(6)} dB  ${String((100*diffPx/(w*h)).toFixed(2)).padStart(6)}% px differ by >8/255   ${n}${ma.height!==mb.height?`  (page height ${ma.height} -> ${mb.height})`:''}`);
  if(p<worst.p) worst={p,n};
 }
 console.log(`\nworst page: ${worst.n} at ${worst.p.toFixed(1)} dB`);
})();
