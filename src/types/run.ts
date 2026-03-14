export type Stage =
  | "detect"
  | "assess"
  | "remediate"
  | "verify"
  | "simulate"
  | "finalize"
  | "exception";

export type Decision = "merge-ready" | "blocked" | "exception";

export interface StageEvent {
  id: string;
  runId: string;
  stage: Stage;
  timestamp: string;
  agent: string;
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
