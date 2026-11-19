"use strict";
// Operational timing only: never logs SQL text, parameters or connection strings.
const {req,safeError}=require("./context.cjs"),{environment,targetInfo}=require("./preflight.cjs");
async function main(){const target=targetInfo(environment()),db=new(req("@prisma/client").PrismaClient)({datasources:{db:{url:target.url}},log:[]});try{
 const rows=await db.$queryRawUnsafe("SELECT state, wait_event_type, wait_event, EXTRACT(epoch FROM now()-xact_start)::int AS transaction_age_seconds, cardinality(pg_blocking_pids(pid)) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND state <> 'idle' AND pid <> pg_backend_pid() ORDER BY xact_start NULLS LAST LIMIT 20");console.log(JSON.stringify(rows));
}finally{await db.$disconnect();}}
if(require.main===module)main().catch(safeError);
