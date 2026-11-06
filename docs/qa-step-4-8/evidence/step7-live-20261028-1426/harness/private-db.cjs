const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../../..'),out=path.dirname(__dirname);
const rt=JSON.parse(fs.readFileSync(path.join(root,'.cache/step7-live-20261028-1426/runtime.json'),'utf8'));
const {PrismaClient}=require(path.join(root,'backend/node_modules/@prisma/client'));
async function connect(){const url=new URL(rt.url);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/'+rt.database);assert(/^btl_pr2b_step7_.*_live$/.test(rt.database));const db=new PrismaClient({datasources:{db:{url:rt.url}}});const [r]=await db.$queryRawUnsafe('SELECT current_database() AS db');assert.equal(r.db,rt.database);return db;}
module.exports={connect,root,out};
