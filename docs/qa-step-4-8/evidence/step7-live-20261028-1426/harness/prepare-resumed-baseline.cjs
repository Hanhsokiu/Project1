const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'protect-main.cjs');
fs.writeFileSync(path.join(__dirname,'protect-main-resumed.cjs'),fs.readFileSync(file,'utf8').replaceAll('main-before.json','main-before-resumed.json').replace('"main-"+phase+".json"','"main-"+phase+"-resumed.json"'));
