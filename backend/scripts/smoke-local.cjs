'use strict';
// Boot all existing modules against an explicit isolated database; no seed/DDL.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { testTarget } = require('./rehearse-pr2b.cjs');
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL);
  Object.assign(process.env, { DATABASE_URL:url.toString(), DIRECT_URL:url.toString(), NODE_ENV:'test', JWT_SECRET:crypto.randomBytes(32).toString('hex'), JWT_REFRESH_SECRET:crypto.randomBytes(32).toString('hex') });
  const { NestFactory } = require('@nestjs/core');
  const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require('../dist/app.module');
  const app = await NestFactory.create(AppModule, { logger:false, abortOnError:false });
  try {
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist:true, transform:true }));
    await app.listen(0,'127.0.0.1');
    const port = app.getHttpServer().address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/students`);
    assert.equal(response.status,401,'Unauthenticated academic request must be denied');
    fs.writeFileSync(path.join(__dirname,'../prisma/review/pr2b/smoke-results.json'),JSON.stringify({result:'PASS',allNestModulesBooted:true,unauthenticatedStudentsStatus:401,sharedDatabaseDDL:false},null,2)+'\n');
    console.log('PASS all Nest modules boot with isolated database; unauthenticated request is denied');
  } finally { await app.close(); }
}
main().catch(e=>{console.error(`Local smoke failed: ${e.name}; ${String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[REDACTED_URL]')}`);process.exitCode=1;});
