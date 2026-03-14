import fs from "fs";
import path from "path";
import { startRun } from "../src/lib/system";

async function main() {
  const scenario =
    (process.argv[2] as "malicious-retry" | "clean-pass" | "low-confidence" | undefined) ||
    "malicious-retry";

  const run = await startRun({
    scenario,
    mode: "mock",
    repo: "demo/realityshield-autopilot",
    branch: "demo/no-webhook",
    prNumber: 9001,
  });

  const outDir = path.join(process.cwd(), "seed-output");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `one-case-${scenario}.json`);
  fs.writeFileSync(outPath, JSON.stringify(run, null, 2), "utf8");

  console.log("One-case run completed (no webhook required).");
  console.log(JSON.stringify({
    runId: run.id,
    scenario: run.scenario,
    stage: run.stage,
    decision: run.finalDecision?.status,
    confidence: run.finalDecision?.confidence,
    output: outPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
