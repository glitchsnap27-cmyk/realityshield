import crypto from "crypto";
import { z } from "zod";
import {
  persistRunStateAws,
  publishExceptionAws,
  uploadProofPackAws,
} from "@/lib/integrations/aws";

export type Stage =
  | "detect"
  | "assess"
  | "remediate"
  | "verify"
  | "simulate"
  | "finalize"
  | "exception";

export type AgentName =
  | "Intake Agent"
  | "Dependency Graph Agent"
  | "Risk Intelligence Agent"
  | "Policy Compiler Agent"
  | "Remediation Planner Agent"
  | "Patch Executor Agent"
  | "Verification Agent"
  | "Blast-Radius Simulation Agent"
  | "PR Ops Agent"
  | "Evidence and Proof Agent"
  | "Exception Router Agent"
  | "Learning Memory Agent";

export type Decision = "merge-ready" | "blocked" | "exception";

const stageTransitions: Record<Stage, Stage[]> = {
  detect: ["assess"],
  assess: ["remediate", "exception"],
  remediate: ["verify", "exception"],
  verify: ["simulate"],
  simulate: ["finalize", "remediate"],
  finalize: [],
  exception: [],
};

const allAgents: AgentName[] = [
  "Intake Agent",
  "Dependency Graph Agent",
  "Risk Intelligence Agent",
  "Policy Compiler Agent",
  "Remediation Planner Agent",
  "Patch Executor Agent",
  "Verification Agent",
  "Blast-Radius Simulation Agent",
  "PR Ops Agent",
  "Evidence and Proof Agent",
  "Exception Router Agent",
  "Learning Memory Agent",
];

export interface StageEvent {
  id: string;
  runId: string;
  stage: Stage;
  timestamp: string;
  agent: AgentName;
  confidence: number;
  severity: "low" | "medium" | "high" | "critical";
  action: string;
  toolBadges: string[];
  evidenceRef?: string;
}

export interface DependencyFinding {
  packageName: string;
  version: string;
  riskScore: number;
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  safeReplacement?: string;
  compatibilityScore?: number;
  malicious: boolean;
}

export interface PolicyActionPlan {
  policyId: string;
  title: string;
  violation: string;
  playbook: string[];
  confidence: number;
}

export interface RemediationAttempt {
  attempt: number;
  strategy: "A" | "B" | "C";
  patchSummary: string;
  lockfileUpdated: boolean;
  success: boolean;
  reason: string;
}

export interface VerificationResult {
  passed: boolean;
  tests: Array<{ name: string; passed: boolean; durationMs: number }>;
  coverage: number;
}

export interface SimulationResult {
  passed: boolean;
  journeys: Array<{ journey: string; beforeImpact: number; afterImpact: number }>;
  blastRadiusScoreBefore: number;
  blastRadiusScoreAfter: number;
  businessImpactDelta: number;
}

export interface FinalDecision {
  status: Decision;
  confidence: number;
  rationale: string;
  topOptions?: Array<{ option: string; predictedSuccess: number }>;
}

export interface ProofPack {
  runId: string;
  createdAt: string;
  riskSummary: string;
  patchSummary: string;
  verificationSummary: string;
  simulationSummary: string;
  rollbackCommand: string;
  traceDigest: string;
  signature: string;
}

export interface ExceptionTicket {
  id: string;
  runId: string;
  reason: string;
  topOptions: Array<{ option: string; predictedSuccess: number }>;
  createdAt: string;
  provider: "jira" | "linear" | "none";
}

export interface LearningMemoryRecord {
  id: string;
  packagePattern: string;
  strategy: "A" | "B" | "C";
  successRate: number;
  sampleSize: number;
  lastUsedAt: string;
}

export interface Run {
  id: string;
  prNumber: number;
  repo: string;
  branch: string;
  mode: "mock" | "real";
  scenario: "malicious-retry" | "clean-pass" | "low-confidence";
  stage: Stage;
  createdAt: string;
  updatedAt: string;
  status: "running" | "completed";
  dependencyFindings: DependencyFinding[];
  policyActionPlans: PolicyActionPlan[];
  remediationAttempts: RemediationAttempt[];
  verificationResult?: VerificationResult;
  simulationResult?: SimulationResult;
  finalDecision?: FinalDecision;
  proofPack?: ProofPack;
  exceptionTicket?: ExceptionTicket;
  trace: StageEvent[];
  telemetry: {
    meanRemediationMs: number;
    autoResolved: boolean;
    retries: number;
  };
}

const startRunSchema = z.object({
  repo: z.string().default("demo/realityshield"),
  branch: z.string().default("feature/autopilot"),
  prNumber: z.number().int().positive().default(101),
  scenario: z
    .enum(["malicious-retry", "clean-pass", "low-confidence"])
    .default("malicious-retry"),
  mode: z.enum(["mock", "real"]).default("mock"),
});

const webhookSchema = z.object({
  eventId: z.string().min(1),
  repo: z.string(),
  branch: z.string(),
  prNumber: z.number().int().positive(),
  scenario: z
    .enum(["malicious-retry", "clean-pass", "low-confidence"])
    .optional(),
  mode: z.enum(["mock", "real"]).optional(),
});

const handoffPayloadSchemas = {
  "Intake Agent->Dependency Graph Agent": z.object({
    runId: z.string(),
    repo: z.string(),
    branch: z.string(),
    prNumber: z.number().int().positive(),
  }),
  "Dependency Graph Agent->Risk Intelligence Agent": z.object({
    lockfileDiff: z.string(),
    changedDependencies: z.array(z.string()),
  }),
  "Risk Intelligence Agent->Policy Compiler Agent": z.object({
    findingCount: z.number().int().nonnegative(),
    containsCritical: z.boolean(),
  }),
  "Policy Compiler Agent->Remediation Planner Agent": z.object({
    actionPlanCount: z.number().int().nonnegative(),
  }),
  "Remediation Planner Agent->Patch Executor Agent": z.object({
    strategy: z.enum(["A", "B", "C"]),
    attempt: z.number().int().positive(),
  }),
  "Patch Executor Agent->Verification Agent": z.object({
    attempt: z.number().int().positive(),
    patchSummary: z.string(),
  }),
  "Verification Agent->Blast-Radius Simulation Agent": z.object({
    passed: z.boolean(),
    attempt: z.number().int().positive(),
  }),
  "Blast-Radius Simulation Agent->PR Ops Agent": z.object({
    passed: z.boolean(),
    blastRadiusScoreAfter: z.number(),
  }),
  "PR Ops Agent->Evidence and Proof Agent": z.object({
    decision: z.enum(["merge-ready", "blocked", "exception"]),
    confidence: z.number().min(0).max(1),
  }),
  "Evidence and Proof Agent->Learning Memory Agent": z.object({
    proofPackId: z.string(),
    signature: z.string(),
  }),
  "PR Ops Agent->Exception Router Agent": z.object({
    reason: z.string(),
    confidence: z.number().min(0).max(1),
  }),
} as const;

type HandoffKey = keyof typeof handoffPayloadSchemas;

type StartRunInput = z.input<typeof startRunSchema>;

type GlobalState = {
  runs: Map<string, Run>;
  webhookEvents: Set<string>;
  learningMemory: LearningMemoryRecord[];
};

function getState(): GlobalState {
  const g = globalThis as unknown as { __realityShieldState?: GlobalState };
  if (!g.__realityShieldState) {
    g.__realityShieldState = {
      runs: new Map<string, Run>(),
      webhookEvents: new Set<string>(),
      learningMemory: [
        {
          id: crypto.randomUUID(),
          packagePattern: "event-stream",
          strategy: "B",
          successRate: 0.83,
          sampleSize: 12,
          lastUsedAt: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          packagePattern: "left-pad",
          strategy: "A",
          successRate: 0.67,
          sampleSize: 9,
          lastUsedAt: new Date().toISOString(),
        },
      ],
    };
  }

  return g.__realityShieldState;
}

function now() {
  return new Date().toISOString();
}

function traceDigest(trace: StageEvent[]) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(trace))
    .digest("hex")
    .slice(0, 24);
}

function signPayload(payload: unknown) {
  const key = process.env.PROOF_SIGNING_KEY || "dev-proof-signing-key";
  return crypto
    .createHmac("sha256", key)
    .update(JSON.stringify(payload))
    .digest("hex");
}

function redactSecrets(input: string) {
  return input
    .replace(/(AKIA[0-9A-Z]{16})/g, "[REDACTED_AWS_ACCESS_KEY]")
    .replace(/(sfd_[A-Za-z0-9_\-]+)/g, "[REDACTED_SAFEDEP_KEY]")
    .replace(/(AIza[0-9A-Za-z\-_]{20,})/g, "[REDACTED_GOOGLE_KEY]")
    .replace(/(unsiloed_[A-Za-z0-9]{20,})/g, "[REDACTED_UNSILOED_KEY]");
}

function createEvent(
  run: Run,
  stage: Stage,
  agent: AgentName,
  action: string,
  confidence = 0.9,
  severity: StageEvent["severity"] = "medium",
  toolBadges: string[] = ["concierge", "policy-compiler"],
  evidenceRef?: string,
): StageEvent {
  return {
    id: crypto.randomUUID(),
    runId: run.id,
    stage,
    timestamp: now(),
    agent,
    confidence,
    severity,
    action: redactSecrets(action),
    toolBadges,
    evidenceRef,
  };
}

function nextStrategy(): Array<"A" | "B" | "C"> {
  const memory = getState().learningMemory;
  const best = [...memory].sort((a, b) => b.successRate - a.successRate)[0]?.strategy;
  const order: Array<"A" | "B" | "C"> = ["A", "B", "C"];

  if (best) {
    return [best, ...order.filter((s) => s !== best)] as Array<"A" | "B" | "C">;
  }

  return order;
}

async function safeDepRiskScan(run: Run): Promise<DependencyFinding[]> {
  if (run.mode === "real" && process.env.SAFEDEP_CLOUD_API_KEY && process.env.SAFEDEP_CLOUD_TENANT_DOMAIN) {
    const findings = await callSafeDepCloud(run);
    if (findings.length > 0) return findings;
  }

  if (run.scenario === "clean-pass") {
    return [
      {
        packageName: "zod",
        version: "4.3.6",
        riskScore: 5,
        severity: "low",
        reason: "No critical advisories in dependency graph.",
        safeReplacement: "zod",
        compatibilityScore: 99,
        malicious: false,
      },
    ];
  }

  return [
    {
      packageName: "event-stream",
      version: "3.3.6",
      riskScore: 92,
      severity: "critical",
      reason: "Suspicious post-install behavior and known malicious maintainer takeover pattern.",
      safeReplacement: "event-stream-safe",
      compatibilityScore: 88,
      malicious: true,
    },
  ];
}

async function callSafeDepCloud(run: Run): Promise<DependencyFinding[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://api.safedep.io/v1/risk/mock-compat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SAFEDEP_CLOUD_API_KEY}`,
        "X-Tenant-Domain": process.env.SAFEDEP_CLOUD_TENANT_DOMAIN as string,
      },
      body: JSON.stringify({ repo: run.repo, prNumber: run.prNumber }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const body = (await res.json()) as { findings?: DependencyFinding[] };
    return body.findings ?? [];
  } catch {
    return [];
  }
}

function compilePolicyPlans(findings: DependencyFinding[]): PolicyActionPlan[] {
  return findings
    .filter((f) => f.riskScore >= 60)
    .map((f, idx) => ({
      policyId: `POL-${idx + 1}`,
      title: `Block high-risk package ${f.packageName}`,
      violation: `${f.packageName}@${f.version} exceeds risk threshold with score ${f.riskScore}.`,
      playbook: [
        "Pin safe replacement package",
        "Regenerate lockfile deterministically",
        "Run targeted + full verification suite",
        "Run blast-radius simulation before merge",
      ],
      confidence: 0.78,
    }));
}

function executeStrategy(run: Run, strategy: "A" | "B" | "C", attempt: number): RemediationAttempt {
  if (run.scenario === "clean-pass") {
    return {
      attempt,
      strategy,
      patchSummary: "No patch needed; dependency graph already compliant.",
      lockfileUpdated: false,
      success: true,
      reason: "No violating dependencies detected.",
    };
  }

  if (run.scenario === "low-confidence") {
    return {
      attempt,
      strategy,
      patchSummary: `Applied strategy ${strategy} with partial lockfile substitution and quarantined transitive subtree.`,
      lockfileUpdated: true,
      success: false,
      reason: "Conflicting peer dependency constraints reduced confidence below policy threshold.",
    };
  }

  if (run.scenario === "malicious-retry") {
    if (attempt === 1) {
      return {
        attempt,
        strategy,
        patchSummary: "Strategy A: version pin and lockfile refresh.",
        lockfileUpdated: true,
        success: false,
        reason: "Targeted tests fail due to API mismatch in replacement package.",
      };
    }

    return {
      attempt,
      strategy,
      patchSummary: "Strategy B: safe fork substitution plus compatibility shim.",
      lockfileUpdated: true,
      success: true,
      reason: "All policy checks and tests pass.",
    };
  }

  return {
    attempt,
    strategy,
    patchSummary: `Strategy ${strategy} executed with standard remediation pipeline.`,
    lockfileUpdated: true,
    success: true,
    reason: "Remediation path passed.",
  };
}

function verifyRun(run: Run, attempt: RemediationAttempt): VerificationResult {
  if (!attempt.success) {
    return {
      passed: false,
      tests: [
        { name: "unit:dependency-resolution", passed: false, durationMs: 913 },
        { name: "integration:checkout", passed: true, durationMs: 1202 },
      ],
      coverage: 86,
    };
  }

  return {
    passed: true,
    tests: [
      { name: "unit:dependency-resolution", passed: true, durationMs: 711 },
      { name: "integration:checkout", passed: true, durationMs: 1180 },
      { name: "e2e:payment-flow", passed: true, durationMs: 1865 },
    ],
    coverage: 90,
  };
}

function simulateBlastRadius(run: Run, attempt: RemediationAttempt): SimulationResult {
  if (run.scenario === "low-confidence") {
    return {
      passed: false,
      journeys: [
        { journey: "Signup -> Trial -> Upgrade", beforeImpact: 45, afterImpact: 62 },
        { journey: "Checkout -> Receipt", beforeImpact: 38, afterImpact: 54 },
      ],
      blastRadiusScoreBefore: 41,
      blastRadiusScoreAfter: 58,
      businessImpactDelta: 17,
    };
  }

  const after = attempt.success ? 17 : 64;
  return {
    passed: after < 30,
    journeys: [
      { journey: "Checkout -> Payment", beforeImpact: 66, afterImpact: after },
      { journey: "Login -> Dashboard", beforeImpact: 22, afterImpact: 18 },
      { journey: "API ingest -> Analytics", beforeImpact: 40, afterImpact: 24 },
    ],
    blastRadiusScoreBefore: 56,
    blastRadiusScoreAfter: Math.round((after + 18 + 24) / 3),
    businessImpactDelta: Math.round(((after + 18 + 24) / 3) - 56),
  };
}

function finalizeDecision(run: Run): FinalDecision {
  if (run.scenario === "low-confidence") {
    return {
      status: "exception",
      confidence: 0.44,
      rationale: "Ambiguous runtime behavior after remediation; human escalation required.",
      topOptions: [
        { option: "Use curated private mirror replacement", predictedSuccess: 0.76 },
        { option: "Revert dependency and isolate feature flag", predictedSuccess: 0.59 },
      ],
    };
  }

  const passed =
    run.verificationResult?.passed &&
    run.simulationResult?.passed &&
    run.policyActionPlans.length >= 0;

  return {
    status: passed ? "merge-ready" : "blocked",
    confidence: passed ? 0.93 : 0.62,
    rationale: passed
      ? "All policy, verification, and simulation gates satisfied."
      : "One or more gates failed.",
  };
}

function buildProofPack(run: Run): ProofPack {
  const payload = {
    runId: run.id,
    decision: run.finalDecision,
    retryCount: run.remediationAttempts.length,
    traceDigest: traceDigest(run.trace),
  };

  return {
    runId: run.id,
    createdAt: now(),
    riskSummary:
      run.dependencyFindings.length > 0
        ? `${run.dependencyFindings[0].packageName} risk reduced from ${run.dependencyFindings[0].riskScore} to 18.`
        : "No dependency risk findings.",
    patchSummary: run.remediationAttempts.map((a) => `${a.strategy}:${a.patchSummary}`).join(" | "),
    verificationSummary: run.verificationResult?.passed
      ? "Verification suite passed."
      : "Verification failures detected.",
    simulationSummary: run.simulationResult?.passed
      ? "Blast-radius simulation is below regression threshold."
      : "Simulation indicates elevated business impact.",
    rollbackCommand: `POST /api/runs/${run.id}/rollback`,
    traceDigest: payload.traceDigest,
    signature: signPayload(payload),
  };
}

function createExceptionTicket(run: Run): ExceptionTicket {
  return {
    id: crypto.randomUUID(),
    runId: run.id,
    reason: run.finalDecision?.rationale || "Unknown exception",
    topOptions: run.finalDecision?.topOptions || [],
    createdAt: now(),
    provider: process.env.EXCEPTION_PROVIDER === "jira" ? "jira" : process.env.EXCEPTION_PROVIDER === "linear" ? "linear" : "none",
  };
}

function updateLearningMemory(run: Run) {
  const state = getState();
  const success = run.finalDecision?.status === "merge-ready";
  run.remediationAttempts.forEach((attempt) => {
    const existing = state.learningMemory.find((r) => r.strategy === attempt.strategy);
    if (!existing) {
      state.learningMemory.push({
        id: crypto.randomUUID(),
        packagePattern: run.dependencyFindings[0]?.packageName || "generic",
        strategy: attempt.strategy,
        successRate: success ? 1 : 0,
        sampleSize: 1,
        lastUsedAt: now(),
      });
      return;
    }

    const totalSuccess = existing.successRate * existing.sampleSize + (success ? 1 : 0);
    existing.sampleSize += 1;
    existing.successRate = Number((totalSuccess / existing.sampleSize).toFixed(2));
    existing.lastUsedAt = now();
  });
}

function transition(run: Run, to: Stage) {
  const allowed = stageTransitions[run.stage] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid transition ${run.stage} -> ${to}`);
  }
  run.stage = to;
  run.updatedAt = now();
}

function handoff(
  run: Run,
  stage: Stage,
  from: AgentName,
  to: AgentName,
  key: HandoffKey,
  payload: unknown,
) {
  handoffPayloadSchemas[key].parse(payload);
  run.trace.push(
    createEvent(
      run,
      stage,
      from,
      `Handoff contract verified -> ${to} (${key})`,
      0.95,
      "low",
      ["concierge-handoff", "contract-verified"],
    ),
  );
}

export async function startRun(input: StartRunInput): Promise<Run> {
  const state = getState();
  const parsed = startRunSchema.parse(input);
  const run: Run = {
    id: crypto.randomUUID(),
    prNumber: parsed.prNumber,
    repo: parsed.repo,
    branch: parsed.branch,
    scenario: parsed.scenario,
    mode: parsed.mode,
    stage: "detect",
    createdAt: now(),
    updatedAt: now(),
    status: "running",
    dependencyFindings: [],
    policyActionPlans: [],
    remediationAttempts: [],
    trace: [],
    telemetry: {
      meanRemediationMs: 0,
      autoResolved: false,
      retries: 0,
    },
  };

  state.runs.set(run.id, run);
  await executeRun(run);
  return run;
}

async function executeRun(run: Run) {
  const start = Date.now();

  run.trace.push(
    createEvent(run, "detect", "Intake Agent", "PR webhook normalized and idempotency key verified.", 0.97, "low", ["github-mcp", "concierge"]),
  );
  handoff(
    run,
    "detect",
    "Intake Agent",
    "Dependency Graph Agent",
    "Intake Agent->Dependency Graph Agent",
    {
      runId: run.id,
      repo: run.repo,
      branch: run.branch,
      prNumber: run.prNumber,
    },
  );

  transition(run, "assess");
  run.trace.push(
    createEvent(run, "assess", "Dependency Graph Agent", "Dependency and lockfile diff extracted.", 0.96, "medium", ["safedep", "lockfile-diff"]),
  );
  handoff(
    run,
    "assess",
    "Dependency Graph Agent",
    "Risk Intelligence Agent",
    "Dependency Graph Agent->Risk Intelligence Agent",
    {
      lockfileDiff: "package-lock.json",
      changedDependencies: ["event-stream", "zod"],
    },
  );

  run.dependencyFindings = await safeDepRiskScan(run);
  run.trace.push(
    createEvent(
      run,
      "assess",
      "Risk Intelligence Agent",
      `SafeDep scan completed with ${run.dependencyFindings.length} finding(s).`,
      0.9,
      run.dependencyFindings.some((f) => f.malicious) ? "critical" : "low",
      ["safedep-cloud", run.mode === "real" ? "real-mode" : "mock-mode"],
      `/runs/${run.id}/findings`,
    ),
  );
  handoff(
    run,
    "assess",
    "Risk Intelligence Agent",
    "Policy Compiler Agent",
    "Risk Intelligence Agent->Policy Compiler Agent",
    {
      findingCount: run.dependencyFindings.length,
      containsCritical: run.dependencyFindings.some((f) => f.severity === "critical"),
    },
  );

  run.policyActionPlans = compilePolicyPlans(run.dependencyFindings);
  run.trace.push(
    createEvent(run, "assess", "Policy Compiler Agent", "Policy violations compiled into executable playbook.", 0.84, "medium", ["policy-compiler", "unsiloed-optional"]),
  );
  handoff(
    run,
    "assess",
    "Policy Compiler Agent",
    "Remediation Planner Agent",
    "Policy Compiler Agent->Remediation Planner Agent",
    {
      actionPlanCount: run.policyActionPlans.length,
    },
  );

  transition(run, "remediate");

  const ordered = nextStrategy();
  for (let i = 0; i < ordered.length; i += 1) {
    const strategy = ordered[i];
    run.trace.push(
      createEvent(
        run,
        "remediate",
        "Remediation Planner Agent",
        `Generated strategy ${strategy} with ranking position ${i + 1}.`,
        0.81,
        "medium",
        ["learning-memory", "multi-strategy"],
      ),
    );
    handoff(
      run,
      "remediate",
      "Remediation Planner Agent",
      "Patch Executor Agent",
      "Remediation Planner Agent->Patch Executor Agent",
      {
        strategy,
        attempt: i + 1,
      },
    );

    const attempt = executeStrategy(run, strategy, i + 1);
    run.remediationAttempts.push(attempt);
    run.trace.push(
      createEvent(
        run,
        "remediate",
        "Patch Executor Agent",
        `Applied remediation strategy ${strategy}. ${attempt.reason}`,
        attempt.success ? 0.88 : 0.63,
        attempt.success ? "medium" : "high",
        ["patch-engine", "lockfile-updater"],
      ),
    );
    handoff(
      run,
      "remediate",
      "Patch Executor Agent",
      "Verification Agent",
      "Patch Executor Agent->Verification Agent",
      {
        attempt: i + 1,
        patchSummary: attempt.patchSummary,
      },
    );

    transition(run, "verify");
    run.verificationResult = verifyRun(run, attempt);
    run.trace.push(
      createEvent(
        run,
        "verify",
        "Verification Agent",
        run.verificationResult.passed
          ? "Verification suite passed."
          : "Verification failed, preparing next strategy.",
        run.verificationResult.passed ? 0.9 : 0.59,
        run.verificationResult.passed ? "low" : "high",
        ["codebuild", "test-suite"],
      ),
    );
    handoff(
      run,
      "verify",
      "Verification Agent",
      "Blast-Radius Simulation Agent",
      "Verification Agent->Blast-Radius Simulation Agent",
      {
        passed: run.verificationResult.passed,
        attempt: i + 1,
      },
    );

    if (!run.verificationResult.passed) {
      run.telemetry.retries += 1;
      transition(run, "simulate");
      if (i === ordered.length - 1) {
        transition(run, "remediate");
        transition(run, "exception");
        break;
      }
      transition(run, "remediate");
      continue;
    }

    transition(run, "simulate");
    run.simulationResult = simulateBlastRadius(run, attempt);
    run.trace.push(
      createEvent(
        run,
        "simulate",
        "Blast-Radius Simulation Agent",
        `Synthetic journeys executed. Blast radius ${run.simulationResult.blastRadiusScoreBefore} -> ${run.simulationResult.blastRadiusScoreAfter}.`,
        run.simulationResult.passed ? 0.89 : 0.52,
        run.simulationResult.passed ? "low" : "high",
        ["simulation", "business-impact"],
      ),
    );

    if (!run.simulationResult.passed) {
      run.telemetry.retries += 1;
      if (i === ordered.length - 1) {
        transition(run, "exception");
        break;
      }
      transition(run, "remediate");
      continue;
    }

    handoff(
      run,
      "simulate",
      "Blast-Radius Simulation Agent",
      "PR Ops Agent",
      "Blast-Radius Simulation Agent->PR Ops Agent",
      {
        passed: run.simulationResult.passed,
        blastRadiusScoreAfter: run.simulationResult.blastRadiusScoreAfter,
      },
    );
    transition(run, "finalize");
    break;
  }

  run.finalDecision = finalizeDecision(run);
  if (run.stage !== "exception" && run.stage !== "finalize") {
    run.stage = run.finalDecision.status === "exception" ? "exception" : "finalize";
  }

  if (run.finalDecision.status === "exception") {
    handoff(
      run,
      "exception",
      "PR Ops Agent",
      "Exception Router Agent",
      "PR Ops Agent->Exception Router Agent",
      {
        reason: run.finalDecision.rationale,
        confidence: run.finalDecision.confidence,
      },
    );
    run.trace.push(
      createEvent(
        run,
        "exception",
        "Exception Router Agent",
        "Confidence-gated escalation triggered with top two options.",
        0.91,
        "high",
        ["jira-mcp", "slack-mcp", "linear-mcp"],
      ),
    );
    run.exceptionTicket = createExceptionTicket(run);
  }

  run.trace.push(
    createEvent(
      run,
      run.stage === "exception" ? "exception" : "finalize",
      "PR Ops Agent",
      `PR decision posted: ${run.finalDecision.status}.`,
      run.finalDecision.confidence,
      run.finalDecision.status === "merge-ready" ? "low" : "medium",
      ["github-mcp", "checks-api"],
    ),
  );

  handoff(
    run,
    run.stage === "exception" ? "exception" : "finalize",
    "PR Ops Agent",
    "Evidence and Proof Agent",
    "PR Ops Agent->Evidence and Proof Agent",
    {
      decision: run.finalDecision.status,
      confidence: run.finalDecision.confidence,
    },
  );

  run.proofPack = buildProofPack(run);
  run.trace.push(
    createEvent(
      run,
      run.stage === "exception" ? "exception" : "finalize",
      "Evidence and Proof Agent",
      "Merge Readiness Proof Pack generated and signed.",
      0.99,
      "low",
      ["s3-artifacts", "proof-pack"],
      `/api/runs/${run.id}/proof-pack`,
    ),
  );

  handoff(
    run,
    run.stage === "exception" ? "exception" : "finalize",
    "Evidence and Proof Agent",
    "Learning Memory Agent",
    "Evidence and Proof Agent->Learning Memory Agent",
    {
      proofPackId: run.proofPack.runId,
      signature: run.proofPack.signature,
    },
  );

  run.trace.push(
    createEvent(
      run,
      run.stage === "exception" ? "exception" : "finalize",
      "Learning Memory Agent",
      "Outcome recorded in repository learning memory for future remediation ranking.",
      0.9,
      "low",
      ["dynamodb-memory", "ranking-model"],
    ),
  );

  updateLearningMemory(run);
  run.status = "completed";
  run.updatedAt = now();
  run.telemetry.meanRemediationMs = Date.now() - start;
  run.telemetry.autoResolved = run.finalDecision.status === "merge-ready";

  const awsStateResult = await persistRunStateAws({
    id: run.id,
    stage: run.stage,
    status: run.status,
    updatedAt: run.updatedAt,
    finalDecision: run.finalDecision,
  });

  run.trace.push(
    createEvent(
      run,
      run.stage === "exception" ? "exception" : "finalize",
      "Learning Memory Agent",
      awsStateResult.enabled
        ? awsStateResult.persisted
          ? "DynamoDB run-state persisted."
          : `DynamoDB persistence failed: ${awsStateResult.error || "unknown"}`
        : `DynamoDB not configured: ${awsStateResult.reason}`,
      awsStateResult.enabled && awsStateResult.persisted ? 0.93 : 0.7,
      awsStateResult.enabled && awsStateResult.persisted ? "low" : "medium",
      ["aws-dynamodb", "run-state"],
    ),
  );

  if (run.proofPack) {
    const uploadResult = await uploadProofPackAws(run.id, run.proofPack);
    run.trace.push(
      createEvent(
        run,
        run.stage === "exception" ? "exception" : "finalize",
        "Evidence and Proof Agent",
        uploadResult.enabled
          ? uploadResult.uploaded
            ? `Proof pack uploaded to S3 key ${uploadResult.key}.`
            : `S3 upload failed: ${uploadResult.error || "unknown"}`
          : `S3 not configured: ${uploadResult.reason}`,
        uploadResult.enabled && uploadResult.uploaded ? 0.93 : 0.7,
        uploadResult.enabled && uploadResult.uploaded ? "low" : "medium",
        ["aws-s3", "proof-pack"],
      ),
    );
  }

  if (run.finalDecision.status === "exception") {
    const snsResult = await publishExceptionAws({
      runId: run.id,
      reason: run.finalDecision.rationale,
      confidence: run.finalDecision.confidence,
    });

    run.trace.push(
      createEvent(
        run,
        "exception",
        "Exception Router Agent",
        snsResult.enabled
          ? snsResult.published
            ? "SNS exception alert published."
            : `SNS publish failed: ${snsResult.error || "unknown"}`
          : `SNS not configured: ${snsResult.reason}`,
        snsResult.enabled && snsResult.published ? 0.92 : 0.68,
        snsResult.enabled && snsResult.published ? "medium" : "high",
        ["aws-sns", "exception-alert"],
      ),
    );
  }
}

export async function processWebhook(body: unknown) {
  const parsed = webhookSchema.parse(body);
  const state = getState();

  if (state.webhookEvents.has(parsed.eventId)) {
    let existing: Run | undefined;
    state.runs.forEach((value) => {
      if (!existing && value.prNumber === parsed.prNumber && value.repo === parsed.repo) {
        existing = value;
      }
    });
    return {
      deduplicated: true,
      run: existing,
    };
  }

  state.webhookEvents.add(parsed.eventId);
  const run = await startRun({
    repo: parsed.repo,
    branch: parsed.branch,
    prNumber: parsed.prNumber,
    scenario: parsed.scenario ?? "malicious-retry",
    mode: parsed.mode ?? "mock",
  });

  return {
    deduplicated: false,
    run,
  };
}

export function getRun(id: string) {
  return getState().runs.get(id);
}

export function getTimeline(id: string) {
  return getState().runs.get(id)?.trace || [];
}

export function listRuns() {
  const runs: Run[] = [];
  getState().runs.forEach((value) => {
    runs.push(value);
  });
  return runs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function metricsSummary() {
  const runs = listRuns();
  if (runs.length === 0) {
    return {
      totalRuns: 0,
      autoResolvedRate: 0,
      meanRemediationMs: 0,
      criticalBlocked: 0,
      simulationRegressionPrevented: 0,
      activeAgents: allAgents,
    };
  }

  const autoResolved = runs.filter((r) => r.finalDecision?.status === "merge-ready").length;
  const blocked = runs.filter((r) => r.finalDecision?.status === "blocked").length;
  const mean = Math.round(runs.reduce((acc, r) => acc + r.telemetry.meanRemediationMs, 0) / runs.length);
  const prevented = runs.filter(
    (r) =>
      typeof r.simulationResult?.businessImpactDelta === "number" &&
      r.simulationResult.businessImpactDelta < 0,
  ).length;

  return {
    totalRuns: runs.length,
    autoResolvedRate: Number(((autoResolved / runs.length) * 100).toFixed(1)),
    meanRemediationMs: mean,
    criticalBlocked: blocked,
    simulationRegressionPrevented: prevented,
    activeAgents: allAgents,
  };
}

export function retryRun(id: string) {
  const run = getRun(id);
  if (!run) return null;
  return startRun({
    repo: run.repo,
    branch: run.branch,
    prNumber: run.prNumber,
    scenario: run.scenario,
    mode: run.mode,
  });
}

export function rollbackRun(id: string) {
  const run = getRun(id);
  if (!run) return null;

  const rollback = {
    rollbackRunId: crypto.randomUUID(),
    sourceRunId: run.id,
    action: "rollback-pr-opened",
    command: `git revert --no-edit ${run.id.slice(0, 7)}`,
    createdAt: now(),
    note: "Automatic rollback PR opened due to failed post-merge telemetry.",
  };

  run.trace.push(
    createEvent(
      run,
      run.stage,
      "PR Ops Agent",
      "Rollback PR drafted and posted for review.",
      0.95,
      "high",
      ["rollback", "github-mcp"],
    ),
  );

  return rollback;
}

export function getProofPack(id: string) {
  return getRun(id)?.proofPack;
}

export function seedScenarioRuns() {
  const existing = listRuns();
  if (existing.length > 0) return existing;

  return Promise.all([
    startRun({ scenario: "malicious-retry", mode: "mock", prNumber: 201 }),
    startRun({ scenario: "clean-pass", mode: "mock", prNumber: 202 }),
    startRun({ scenario: "low-confidence", mode: "mock", prNumber: 203 }),
  ]);
}
