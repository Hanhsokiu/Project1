const fs=require('node:fs'),path=require('node:path'),p=path.join(__dirname,'pdf-visual.cjs');
let s=fs.readFileSync(p,'utf8').replace('api/generated/step7-long-sample.pdf','dossiers-api/generated/step7-long-sample.pdf').replace("mcp:'mcp-student2-official.pdf'","mcp:'mcp-student2-official.pdf',preview:'mcp-preview.pdf'");
s=s.replace('assert.deepEqual(overflow,[]);',"assert.deepEqual(overflow,[]);assert(all.includes('Email'));assert(all.includes('Khóa'));if(name==='preview')assert(all.includes('BẢN XEM TRƯỚC — CHƯA CHỐT'));else assert(!all.includes('BẢN XEM TRƯỚC'));");
fs.writeFileSync(p,s);
