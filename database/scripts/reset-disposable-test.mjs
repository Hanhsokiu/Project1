import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { connectDisposableTestClient, verifyDisposableTestIdentity } from "./disposable-test-target.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function resetDisposableTestDatabase({ env = process.env, clientFactory, spawnCommand = spawnSync } = {}) {
  const { client, target } = await connectDisposableTestClient(env, clientFactory);
  try {
    await verifyDisposableTestIdentity(client, target);
    const require = createRequire(resolve(root, "backend/package.json"));
    const cli = require.resolve("prisma/build/index.js");
    const result = spawnCommand(process.execPath, [cli, "migrate", "reset", "--force", "--schema", resolve(root, "backend/prisma/schema.prisma")], {
      cwd: resolve(root, "backend"), windowsHide: true, encoding: "utf8", stdio: "pipe",
      env: { ...env, DATABASE_URL: target.connectionString, DIRECT_URL: target.connectionString },
    });
    if (result.error || result.status !== 0) throw new Error("Reset failed on the verified disposable test target; command output suppressed.");
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await resetDisposableTestDatabase(); console.log("Verified disposable-test reset completed."); }
  catch { console.error("Reset refused or failed. A verified disposable-test database is required; credentials/output suppressed."); process.exitCode = 1; }
}
