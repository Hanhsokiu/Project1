'use strict';
// Report only file/line/category, never a matched secret value.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function list(args){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Git file inventory failed');return r.stdout.split('\0').filter(Boolean);}
const generatedArtifact=file=>/^(?:docs\/implementation\/(?:evidence|step[1-3]-evidence)\/|backend\/prisma\/review\/.*results.*\.json$)/.test(file)||/\.(?:pdf|zip|png)$/.test(file);
function check(files){const findings=[];let scanned=0;
 const patterns=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['supabase-secret',/\b(?:sb_secret_[A-Za-z0-9_-]{20,}|sbp_[a-f0-9]{32,})\b/],
  ['literal-jwt',/\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/],
  ['persisted-acceptance-account',/\bacpt_\d{8,}_(?:manual|auto)_[a-z0-9]+\b/],
  ['literal-password-hash',/\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}/]];
 for(const file of files){
  if(/(^|\/)\.env(?:$|\.)/.test(file)&&!/\.example$/.test(file)||/\.(?:dpapi|aes|dump|pem|key)$/.test(file)||/(?:^|\/)(?:vault|backups?|storage-manual|storage-auto|node_modules|\.cache)\//i.test(file)){
   findings.push({file,category:'private-artifact-path'});continue;
  }
  const absolute=path.resolve(root,file);if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile())continue;
  if(!/\.(?:ts|tsx|js|cjs|json|sql|md|ya?ml|prisma|toml|example)$/.test(file)&&!['.gitignore','.dockerignore'].includes(file))continue;
  const lines=fs.readFileSync(absolute,'utf8').split(/\r?\n/);scanned++;
  lines.forEach((line,i)=>{for(const [category,regex] of patterns)if(regex.test(line))findings.push({file,line:i+1,category});});
 }
 return {status:findings.length?'FAIL':'PASS',filesScanned:scanned,findings};
}
if(require.main===module){
 const inventory=[...new Set([...list(['diff','--name-only','--diff-filter=ACMR','origin/main','-z']),...list(['ls-files','--others','--exclude-standard','-z'])])].sort();
 const files=inventory.filter(file=>!generatedArtifact(file));
 const result=check(files),out=path.join(root,'.cache/release');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'source-scan.json'),JSON.stringify(result,null,2));
 fs.writeFileSync(path.join(out,'commit-files.json'),JSON.stringify(files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')})),null,2));
 fs.writeFileSync(path.join(out,'excluded-generated-files.json'),JSON.stringify(inventory.filter(generatedArtifact),null,2));
 console.log(JSON.stringify(result));if(result.findings.length)process.exitCode=1;
}
module.exports={check};
