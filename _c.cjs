const p=require('@babel/parser'),fs=require('fs');const s=fs.readFileSync('src/App.jsx','utf8');
try{p.parse(s,{sourceType:'module',plugins:['jsx']});console.log('FULL PARSE OK');}catch(e){console.log('clean to',e.loc?e.loc.line:'?','(trunc)');}
