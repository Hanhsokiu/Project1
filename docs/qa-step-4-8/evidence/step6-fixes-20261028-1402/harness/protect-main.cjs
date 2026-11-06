"use strict";
// Only SELECTs inside a READ ONLY transaction on the existing UI database.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const {createRequire} = require("node:module");
const root = path.resolve(__dirname, "../../../../..");
const req = createRequire(path.join(root, "backend/package.json"));
const canonical = v => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, ".cache/integration-ui/config.json"), "utf8"));
  const url = new URL("postgresql://127.0.0.1:55451/btl_integration_ui"); url.username = "btl_ui"; url.password = cfg.password;
  const db = new (req("@prisma/client").PrismaClient)({datasources:{db:{url:url.toString()}}});
  try {
    const tables = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const [identity] = await tx.$queryRawUnsafe("SELECT current_database() AS db,current_setting('transaction_read_only') AS ro");
      assert.equal(identity.db, "btl_integration_ui"); assert.equal(identity.ro, "on");
      const names = await tx.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
      const result=[];
      for(const {tablename} of names){
        const quoted='"'+tablename.replace(/"/g,'""')+'"';
        const rows=await tx.$queryRawUnsafe("SELECT row_to_json(t) AS row FROM public."+quoted+" t");
        const sha=crypto.createHash("sha256").update(rows.map(r=>canonical(r.row)).sort().join("\n")).digest("hex");
        result.push({table:tablename,rows:rows.length,sha256:sha});
      } return result;
    }, {timeout:120000});
    const phase=process.argv[2]; assert(["before","after"].includes(phase));
    const out=path.dirname(__dirname);
    const snapshot={database:"btl_integration_ui",capturedAt:new Date().toISOString(),readOnlyTransaction:true,tables};
    if(phase==="after") {const before=JSON.parse(fs.readFileSync(path.join(out,"main-before.json"),"utf8"));snapshot.unchanged=canonical(before.tables)===canonical(tables);snapshot.changedTables=tables.filter(t=>canonical(t)!==canonical(before.tables.find(b=>b.table===t.table))).map(t=>({table:t.table,beforeRows:before.tables.find(b=>b.table===t.table)?.rows,afterRows:t.rows}));}
    fs.writeFileSync(path.join(out,"main-"+phase+".json"),JSON.stringify(snapshot,null,2));
    console.log(JSON.stringify({phase,tables:tables.length,readOnly:true,unchanged:snapshot.unchanged}));
    if(phase==='after')assert(snapshot.unchanged,'Existing UI database changed during QA interval; differing table hashes/counts preserved in main-after.json');
  } finally {await db.$disconnect();}
}
main().catch(e=>{console.error(String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g,"[REDACTED]"));process.exitCode=1;});
