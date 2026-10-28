"use strict";
// Reuse the reviewed fresh-database launcher. Change only QA evidence/cache
// destinations and complete synthetic UI permissions from the canonical seed.
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../../../..");
const filename = path.join(root, "docs/qa-step-4-8/evidence/step5-mcp-20261027-2153/harness/isolated.cjs");
let source = fs.readFileSync(filename, "utf8");
source = source.replaceAll(".cache/step5-mcp-20261027-2153", ".cache/step5-local-20261028-0906");
source = source.replace('const out = path.dirname(__dirname);', 'const out = path.join(root, "docs/qa-step-4-8/evidence/step5-local-20261028-0906");');
const anchor = "    const coreHash = hash(await coreSnapshot(db));";
assert(source.includes(anchor));
source = source.replace(anchor, `
    // Canonical backend/prisma/seed.cjs grants notification:own and catalog:read
    // to these roles. This fixes incomplete synthetic fixtures only, not app RBAC.
    for (const [resource, action] of [["notification", "own"], ["catalog", "read"]]) {
      const permission = await db.permission.upsert({where:{resource_action:{resource,action}},create:{resource,action},update:{}});
      for (const roleId of ["FACULTY", "LECTURER", "STUDENT"])
        await db.rolePermission.upsert({where:{roleId_permissionId:{roleId,permissionId:permission.id}},create:{roleId,permissionId:permission.id},update:{}});
    }
${anchor}`);
const runner = new Module(filename, module); runner.filename = filename;
runner.paths = Module._nodeModulePaths(path.dirname(filename)); runner._compile(source, filename);
