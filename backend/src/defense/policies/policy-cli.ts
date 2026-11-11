import { readFileSync, writeFileSync } from "fs";
import { officialPolicyDraftSummary } from "./policy-draft";
import { preparePolicyRelease, PolicyReleaseFacts } from "./policy-release";

/** Offline only. Facts must later be independently re-read under a DB transaction. */
export function policyCommand(args: string[]) {
  const [command, first, second, third] = args;
  if (command === "draft" && first && args.length === 2) {
    const result = officialPolicyDraftSummary();
    writeFileSync(first, JSON.stringify(result.draft, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    return { action: "DRAFT_ONLY", policies: result.policyKeys.length, unresolved: result.unresolved.length, runtimeValid: result.runtimeValid };
  }
  if (command === "preflight" && first && second && third && args.length === 4) {
    const policies: unknown = JSON.parse(readFileSync(first, "utf8"));
    const facts = JSON.parse(readFileSync(second, "utf8")) as PolicyReleaseFacts;
    const plan = preparePolicyRelease(policies, facts);
    writeFileSync(third, JSON.stringify({ kind: "OFFLINE_PREFLIGHT_NOT_APPLIED", ...plan }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    return { action: plan.action, ready: plan.ready, blockers: plan.blockers, databaseWrites: 0 };
  }
  throw Error("Usage: policy-cli draft <new-file> | preflight <policies-json> <verified-facts-json> <new-plan-file>");
}

if (require.main === module) {
  try { console.log(JSON.stringify(policyCommand(process.argv.slice(2)))); }
  catch { console.error("POLICY_COMMAND_FAILED: invalid input, missing facts or output already exists; no database was accessed"); process.exitCode = 1; }
}
