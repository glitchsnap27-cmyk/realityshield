import fs from "fs";
import path from "path";

const backendBase = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

async function startRun(input: {
  scenario: "malicious-retry" | "clean-pass" | "low-confidence";
  mode: "mock" | "real";
  repo: string;
  branch: string;
  prNumber: number;
}) {
  const res = await fetch(`${backendBase}/api/runs/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FastAPI backend returned ${res.status}: ${body}`);
  }

  return res.json() as Promise<{
    id: string;
    scenario: string;
    stage: string;
    finalDecision?: { status?: string; confidence?: number };
  }>;
}

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
