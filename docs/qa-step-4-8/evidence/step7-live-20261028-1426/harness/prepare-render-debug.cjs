const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'pdf-visual.cjs'),source=fs.readFileSync(file,'utf8');
let debug=source.replace("e=>events.push({kind:'pageerror',message:clean(e.message)})","e=>{events.push({kind:'pageerror',message:clean(e.message)});save('pdf-render-debug-events.json',events);console.log('PAGEERROR '+clean(e.message))}")
 .replace("page.on('requestfailed',","page.on('console',m=>{if(m.type()==='error'){events.push({kind:'console-error',message:clean(m.text())});save('pdf-render-debug-events.json',events);console.log('CONSOLE '+clean(m.text()))}});page.on('requestfailed',")
 .replace('Object.entries(files)','Object.entries(files).slice(0,1)')
 .replace('timeout:90000','timeout:20000');
fs.writeFileSync(path.join(__dirname,'pdf-render-debug.cjs'),debug);
