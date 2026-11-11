'use strict';
const path = require('node:path');
const { testTarget } = require('../rehearse-pr2b.cjs');
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL).toString();
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await require('./deploy-test-chain.cjs').deploy(db, path.resolve(__dirname, '../..'), url);
    console.log('PASS new local PG17 migration chain; academic roles bootstrapped between B1-B8 and UC17');
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('LOCAL_TEST_CHAIN_FAILED; connection details suppressed'); process.exitCode = 1; });
