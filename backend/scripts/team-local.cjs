'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const configFile = path.join(root, '.env.team.local');
function parse(text) {
  const env = {};
  for (const line of text.trim().split(/\r?\n/)) {
    const match = /^(TEAM_DB_PASSWORD|TEAM_DB_TOKEN)=([a-f0-9]{48})$/.exec(line);
    if (!match || env[match[1]]) throw Error('Invalid local DB config');
    env[match[1]] = match[2];
  }
  if (Object.keys(env).length !== 2) throw Error('Incomplete local DB config');
  return env;
}
function localUrl(config) {
  parse(`TEAM_DB_PASSWORD=${config.TEAM_DB_PASSWORD}\nTEAM_DB_TOKEN=${config.TEAM_DB_TOKEN}`);
  return `postgresql://btl_local:${config.TEAM_DB_PASSWORD}@127.0.0.1:55440/btl_pr2b_dev`;
}
function assertContainer(info, config) {
  const labels = info.Config?.Labels || {};
  const port = info.HostConfig?.PortBindings?.['5432/tcp'] || [];
  if (info.Config?.Image !== 'postgres:17-alpine' || labels['com.docker.compose.project'] !== 'btl-team-local' ||
    labels['btl.team.instance'] !== config.TEAM_DB_TOKEN || info.State?.Health?.Status !== 'healthy' ||
    port.length !== 1 || port[0].HostIp !== '127.0.0.1' || port[0].HostPort !== '55440') {
    throw Error('Local database identity, health or loopback binding mismatch');
  }
}
function main(action) {
  if (action === 'init') {
    if (fs.existsSync(configFile)) { parse(fs.readFileSync(configFile, 'utf8')); console.log('Keep existing ignored local DB config'); return; }
    const text = ['TEAM_DB_PASSWORD','TEAM_DB_TOKEN'].map(k => `${k}=${crypto.randomBytes(24).toString('hex')}`).join('\n')+'\n';
    fs.writeFileSync(configFile, text, { flag: 'wx', mode: 0o600 });
    console.log('Created ignored .env.team.local; credentials not printed'); return;
  }
  if (!['up','stop','status','migrate','dev'].includes(action)) throw Error('Unknown local action');
  const config = parse(fs.readFileSync(configFile, 'utf8'));
  const env = { ...process.env, ...config, DATABASE_URL: localUrl(config), DIRECT_URL: localUrl(config) };
  function run(command, args, inherit = false) {
    const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe', windowsHide: true });
    if (result.error || result.status !== 0) throw Error('Local command failed; check Docker Desktop and local port 55440. No shared database command was run.');
    return result.stdout;
  }
  const compose = ['compose', '--project-name','btl-team-local','--env-file',configFile,'-f',path.join(root,'compose.team-local.yml')];
  if (action === 'up') { run('docker', [...compose, 'up','-d','--wait']); console.log('Local PostgreSQL started at 127.0.0.1:55440'); return; }
  const info = JSON.parse(run('docker', ['inspect','btl-team-local-postgres']))[0];
  assertContainer(info, config);
  if (action === 'status') { console.log('Verified healthy PostgreSQL17 local instance; no shared connection'); return; }
  if (action === 'stop') { run('docker', [...compose,'stop']); console.log('Stopped local instance; volume retained'); return; }
  if (action === 'migrate') {
    run(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate','deploy','--schema',path.join(root,'backend/prisma/schema.prisma')]);
    console.log('Local migrations completed; no seed or shared database change'); return;
  }
  // Let pnpm retain interactive dev/watch output, with an explicit local URL.
  const child = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['dev'], { cwd: root, env: { ...env, NODE_ENV:'development' }, stdio:'inherit', shell:process.platform === 'win32', windowsHide:true });
  process.exitCode = child.status || (child.error ? 1 : 0);
}
module.exports = { parse, localUrl, assertContainer };
if (require.main === module) {
  try { main(process.argv[2]); } catch { console.error('Local environment operation failed. Check config, Docker ownership/health and migration history locally; secrets suppressed.'); process.exitCode=1; }
}
