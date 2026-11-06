const { readdirSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, join } = require('node:path');

const clientRequire = createRequire(require.resolve('@prisma/client'));
const engineDirectory = dirname(clientRequire.resolve('.prisma/client/default'));
const engines = readdirSync(engineDirectory).filter(name =>
  /^(?:lib)?query_engine-.*\.node$/.test(name),
);

if (engines.length !== 1) {
  throw new Error('Expected one native Prisma engine; run prisma generate inside the target image.');
}

require(join(engineDirectory, engines[0]));
console.log(`Prisma native engine loaded: ${engines[0]}`);
