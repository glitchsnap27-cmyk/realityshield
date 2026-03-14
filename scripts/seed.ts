import fs from "fs";
import path from "path";

const backendBase = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

async function startRun(input: {
  scenario: "malicious-retry" | "clean-pass" | "low-confidence";
  mode: "mock" | "real";
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

  return res.json() as Promise<{ id: string }>;
}

async function main() {
  const runs = await Promise.all([
    startRun({ scenario: "malicious-retry", mode: "mock", prNumber: 5001 }),
    startRun({ scenario: "clean-pass", mode: "mock", prNumber: 5002 }),
    startRun({ scenario: "low-confidence", mode: "mock", prNumber: 5003 }),
  ]);

  const outDir = path.join(process.cwd(), "seed-output");
  fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    total: runs.length,
    ids: runs.map((run) => run.id),
  };

  fs.writeFileSync(
    path.join(outDir, "seed-summary.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );

  console.log("Seeded demo scenarios.");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
