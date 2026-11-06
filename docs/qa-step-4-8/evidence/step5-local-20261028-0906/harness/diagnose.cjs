const path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../../../../..');
const {PrismaClient}=require(path.join(root,'backend/node_modules/@prisma/client'));
const rt=JSON.parse(fs.readFileSync(path.join(root,'.cache/step5-local-20261028-0906/runtime.json'),'utf8'));
const db=new PrismaClient({datasources:{db:{url:rt.url}}});
(async()=>{try{console.log(JSON.stringify(await db.$queryRawUnsafe("SELECT pid,datname,state,wait_event_type,wait_event,backend_type FROM pg_stat_activity WHERE datname=current_database()")));}finally{await db.$disconnect();}})();
