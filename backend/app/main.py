import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Set

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .agents import (
    BlastRadiusSimulationAgent,
    DependencyGraphAgent,
    EvidenceProofAgent,
    ExceptionRouterAgent,
    IntakeAgent,
    LearningMemoryAgent,
    PatchExecutorAgent,
    PolicyCompilerAgent,
    RemediationPlannerAgent,
    RiskIntelligenceAgent,
    VerificationAgent,
)
from .langgraph_flow import run_ai_cycle_graph

try:
    import boto3
except Exception:  # pragma: no cover
    boto3 = None

Stage = Literal["detect", "assess", "remediate", "verify", "simulate", "finalize", "exception"]
Decision = Literal["merge-ready", "blocked", "exception"]
Scenario = Literal["malicious-retry", "clean-pass", "low-confidence"]
Mode = Literal["mock", "real"]
AgentName = Literal[
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
]


class StageEvent(BaseModel):
    id: str
    runId: str
    stage: Stage
    timestamp: str
    agent: AgentName
    confidence: float
    severity: Literal["low", "medium", "high", "critical"]
    action: str
    toolBadges: List[str]
    evidenceRef: Optional[str] = None


class DependencyFinding(BaseModel):
    packageName: str
    version: str
    riskScore: float
    severity: Literal["low", "medium", "high", "critical"]
    reason: str
    safeReplacement: Optional[str] = None
    compatibilityScore: Optional[float] = None
    malicious: bool


class PolicyActionPlan(BaseModel):
    policyId: str
    title: str
    violation: str
    playbook: List[str]
    confidence: float


class RemediationAttempt(BaseModel):
    attempt: int
    strategy: Literal["A", "B", "C"]
    patchSummary: str
    lockfileUpdated: bool
    success: bool
    reason: str


class VerificationTest(BaseModel):
    name: str
    passed: bool
    durationMs: int


class VerificationResult(BaseModel):
    passed: bool
    tests: List[VerificationTest]
    coverage: int


class SimulationJourney(BaseModel):
    journey: str
    beforeImpact: int
    afterImpact: int


class SimulationResult(BaseModel):
    passed: bool
    journeys: List[SimulationJourney]
    blastRadiusScoreBefore: int
    blastRadiusScoreAfter: int
    businessImpactDelta: int


class DecisionOption(BaseModel):
    option: str
    predictedSuccess: float


class FinalDecision(BaseModel):
    status: Decision
    confidence: float
    rationale: str
    topOptions: List[DecisionOption] = Field(default_factory=list)


class ProofPack(BaseModel):
    runId: str
    createdAt: str
    riskSummary: str
    patchSummary: str
    verificationSummary: str
    simulationSummary: str
    rollbackCommand: str
    traceDigest: str
    signature: str


class ExceptionTicket(BaseModel):
    id: str
    runId: str
    reason: str
    topOptions: List[DecisionOption]
    createdAt: str
    provider: Literal["jira", "linear", "none"]


class LearningMemoryRecord(BaseModel):
    id: str
    packagePattern: str
    strategy: Literal["A", "B", "C"]
    successRate: float
    sampleSize: int
    lastUsedAt: str


class Telemetry(BaseModel):
    meanRemediationMs: int
    autoResolved: bool
    retries: int


class Run(BaseModel):
    id: str
    prNumber: int
    repo: str
    branch: str
    mode: Mode
    scenario: Scenario
    stage: Stage
    createdAt: str
    updatedAt: str
    status: Literal["running", "completed"]
    dependencyFindings: List[DependencyFinding]
    policyActionPlans: List[PolicyActionPlan]
    remediationAttempts: List[RemediationAttempt]
    verificationResult: Optional[VerificationResult] = None
    simulationResult: Optional[SimulationResult] = None
    finalDecision: Optional[FinalDecision] = None
    proofPack: Optional[ProofPack] = None
    exceptionTicket: Optional[ExceptionTicket] = None
    trace: List[StageEvent]
    telemetry: Telemetry


class StartRunInput(BaseModel):
    repo: str = "demo/realityshield"
    branch: str = "feature/autopilot"
    prNumber: int = 101
    scenario: Scenario = "malicious-retry"
    mode: Mode = "mock"


class WebhookPayload(BaseModel):
    eventId: str
    repo: str
    branch: str
    prNumber: int
    scenario: Optional[Scenario] = None
    mode: Optional[Mode] = None


class GlobalState:
    def __init__(self) -> None:
        self.runs: Dict[str, Run] = {}
        self.webhook_events: Set[str] = set()
        self.learning_memory: List[LearningMemoryRecord] = [
            LearningMemoryRecord(
                id=str(uuid.uuid4()),
                packagePattern="event-stream",
                strategy="B",
                successRate=0.83,
                sampleSize=12,
                lastUsedAt=self.now(),
            ),
            LearningMemoryRecord(
                id=str(uuid.uuid4()),
                packagePattern="left-pad",
                strategy="A",
                successRate=0.67,
                sampleSize=9,
                lastUsedAt=self.now(),
            ),
        ]

    @staticmethod
    def now() -> str:
        return datetime.now(timezone.utc).isoformat()


state = GlobalState()

intake_agent = IntakeAgent()
dependency_graph_agent = DependencyGraphAgent()
risk_intelligence_agent = RiskIntelligenceAgent()
policy_compiler_agent = PolicyCompilerAgent()
remediation_planner_agent = RemediationPlannerAgent()
patch_executor_agent = PatchExecutorAgent()
verification_agent = VerificationAgent()
simulation_agent = BlastRadiusSimulationAgent()
proof_agent = EvidenceProofAgent()
exception_router_agent = ExceptionRouterAgent()
learning_memory_agent = LearningMemoryAgent()


stage_transitions: Dict[Stage, List[Stage]] = {
    "detect": ["assess"],
    "assess": ["remediate", "exception"],
    "remediate": ["verify", "exception"],
    "verify": ["simulate"],
    "simulate": ["finalize", "remediate"],
    "finalize": [],
    "exception": [],
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def redact_secrets(text: str) -> str:
    return (
        text.replace("AKIA", "[REDACTED_AWS_KEY_PREFIX]")
        .replace("sfd_", "[REDACTED_SAFEDEP_PREFIX]")
        .replace("unsiloed_", "[REDACTED_UNSILOED_PREFIX]")
    )


def trace_digest(trace: List[StageEvent]) -> str:
    return hashlib.sha256(json.dumps([e.model_dump() for e in trace]).encode("utf-8")).hexdigest()[:24]


def sign_payload(payload: Dict[str, Any]) -> str:
    key = os.getenv("PROOF_SIGNING_KEY", "dev-proof-signing-key")
    return hmac.new(key.encode("utf-8"), json.dumps(payload).encode("utf-8"), hashlib.sha256).hexdigest()


def create_event(
    run: Run,
    stage: Stage,
    agent: AgentName,
    action: str,
    confidence: float = 0.9,
    severity: Literal["low", "medium", "high", "critical"] = "medium",
    tool_badges: Optional[List[str]] = None,
    evidence_ref: Optional[str] = None,
) -> StageEvent:
    return StageEvent(
        id=str(uuid.uuid4()),
        runId=run.id,
        stage=stage,
        timestamp=now(),
        agent=agent,
        confidence=confidence,
        severity=severity,
        action=redact_secrets(action),
        toolBadges=tool_badges or ["concierge", "policy-compiler"],
        evidenceRef=evidence_ref,
    )


def append_agent_event(
    run: Run,
    stage: Stage,
    agent_name: AgentName,
    output: Any,
) -> None:
    run.trace.append(
        create_event(
            run,
            stage,
            agent_name,
            output.action,
            output.confidence,
            output.severity,
            output.badges,
            output.evidence_ref,
        )
    )


def transition(run: Run, to: Stage) -> None:
    if to not in stage_transitions.get(run.stage, []):
        raise ValueError(f"Invalid transition {run.stage} -> {to}")
    run.stage = to
    run.updatedAt = now()


def next_strategy() -> List[Literal["A", "B", "C"]]:
    best = sorted(state.learning_memory, key=lambda m: m.successRate, reverse=True)[0].strategy
    order: List[Literal["A", "B", "C"]] = ["A", "B", "C"]
    return [best, *[s for s in order if s != best]]


async def call_safedep_cloud(run: Run) -> List[DependencyFinding]:
    tenant = os.getenv("SAFEDEP_CLOUD_TENANT_DOMAIN")
    api_key = os.getenv("SAFEDEP_CLOUD_API_KEY")
    if not tenant or not api_key or run.mode != "real":
        return []

    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.post(
                "https://api.safedep.io/v1/risk/mock-compat",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "X-Tenant-Domain": tenant,
                    "Content-Type": "application/json",
                },
                json={"repo": run.repo, "prNumber": run.prNumber},
            )
            if response.status_code >= 400:
                return []
            payload = response.json()
            findings = payload.get("findings") or []
            return [DependencyFinding(**item) for item in findings]
    except Exception:
        return []


async def safedep_risk_scan(run: Run) -> List[DependencyFinding]:
    cloud_findings = await call_safedep_cloud(run)
    if cloud_findings:
        return cloud_findings

    if run.scenario == "clean-pass":
        return [
            DependencyFinding(
                packageName="zod",
                version="4.3.6",
                riskScore=5,
                severity="low",
                reason="No critical advisories in dependency graph.",
                safeReplacement="zod",
                compatibilityScore=99,
                malicious=False,
            )
        ]

    return [
        DependencyFinding(
            packageName="event-stream",
            version="3.3.6",
            riskScore=92,
            severity="critical",
            reason="Suspicious post-install behavior and known maintainer takeover pattern.",
            safeReplacement="event-stream-safe",
            compatibilityScore=88,
            malicious=True,
        )
    ]


def compile_policy_plans(findings: List[DependencyFinding]) -> List[PolicyActionPlan]:
    plans: List[PolicyActionPlan] = []
    for idx, finding in enumerate([f for f in findings if f.riskScore >= 60]):
        plans.append(
            PolicyActionPlan(
                policyId=f"POL-{idx + 1}",
                title=f"Block high-risk package {finding.packageName}",
                violation=f"{finding.packageName}@{finding.version} exceeds risk threshold with score {finding.riskScore}.",
                playbook=[
                    "Pin safe replacement package",
                    "Regenerate lockfile deterministically",
                    "Run targeted and full verification suite",
                    "Run blast-radius simulation before merge",
                ],
                confidence=0.78,
            )
        )
    return plans


def execute_strategy(run: Run, strategy: Literal["A", "B", "C"], attempt: int) -> RemediationAttempt:
    if run.scenario == "clean-pass":
        return RemediationAttempt(
            attempt=attempt,
            strategy=strategy,
            patchSummary="No patch needed; dependency graph already compliant.",
            lockfileUpdated=False,
            success=True,
            reason="No violating dependencies detected.",
        )

    if run.scenario == "low-confidence":
        return RemediationAttempt(
            attempt=attempt,
            strategy=strategy,
            patchSummary=f"Applied strategy {strategy} with partial lockfile substitution.",
            lockfileUpdated=True,
            success=False,
            reason="Conflicting peer dependency constraints reduced confidence below threshold.",
        )

    if run.scenario == "malicious-retry" and attempt == 1:
        return RemediationAttempt(
            attempt=attempt,
            strategy=strategy,
            patchSummary="Strategy A: version pin and lockfile refresh.",
            lockfileUpdated=True,
            success=False,
            reason="Targeted tests fail due to API mismatch in replacement package.",
        )

    return RemediationAttempt(
        attempt=attempt,
        strategy=strategy,
        patchSummary="Strategy B: safe fork substitution plus compatibility shim.",
        lockfileUpdated=True,
        success=True,
        reason="All policy checks and tests pass.",
    )


def verify_run(attempt: RemediationAttempt) -> VerificationResult:
    if not attempt.success:
        return VerificationResult(
            passed=False,
            tests=[
                VerificationTest(name="unit:dependency-resolution", passed=False, durationMs=913),
                VerificationTest(name="integration:checkout", passed=True, durationMs=1202),
            ],
            coverage=86,
        )

    return VerificationResult(
        passed=True,
        tests=[
            VerificationTest(name="unit:dependency-resolution", passed=True, durationMs=711),
            VerificationTest(name="integration:checkout", passed=True, durationMs=1180),
            VerificationTest(name="e2e:payment-flow", passed=True, durationMs=1865),
        ],
        coverage=90,
    )


def simulate_blast_radius(run: Run, attempt: RemediationAttempt) -> SimulationResult:
    if run.scenario == "low-confidence":
        return SimulationResult(
            passed=False,
            journeys=[
                SimulationJourney(journey="Signup -> Trial -> Upgrade", beforeImpact=45, afterImpact=62),
                SimulationJourney(journey="Checkout -> Receipt", beforeImpact=38, afterImpact=54),
            ],
            blastRadiusScoreBefore=41,
            blastRadiusScoreAfter=58,
            businessImpactDelta=17,
        )

    after = 17 if attempt.success else 64
    score_after = round((after + 18 + 24) / 3)
    return SimulationResult(
        passed=score_after < 30,
        journeys=[
            SimulationJourney(journey="Checkout -> Payment", beforeImpact=66, afterImpact=after),
            SimulationJourney(journey="Login -> Dashboard", beforeImpact=22, afterImpact=18),
            SimulationJourney(journey="API ingest -> Analytics", beforeImpact=40, afterImpact=24),
        ],
        blastRadiusScoreBefore=56,
        blastRadiusScoreAfter=score_after,
        businessImpactDelta=score_after - 56,
    )


def finalize_decision(run: Run) -> FinalDecision:
    if run.scenario == "low-confidence":
        return FinalDecision(
            status="exception",
            confidence=0.44,
            rationale="Ambiguous runtime behavior after remediation; human escalation required.",
            topOptions=[
                DecisionOption(option="Use curated private mirror replacement", predictedSuccess=0.76),
                DecisionOption(option="Revert dependency and isolate feature flag", predictedSuccess=0.59),
            ],
        )

    passed = bool(run.verificationResult and run.verificationResult.passed and run.simulationResult and run.simulationResult.passed)
    return FinalDecision(
        status="merge-ready" if passed else "blocked",
        confidence=0.93 if passed else 0.62,
        rationale="All policy, verification, and simulation gates satisfied." if passed else "One or more gates failed.",
    )


def build_proof_pack(run: Run) -> ProofPack:
    payload = {
        "runId": run.id,
        "decision": run.finalDecision.model_dump() if run.finalDecision else None,
        "retryCount": len(run.remediationAttempts),
        "traceDigest": trace_digest(run.trace),
    }

    return ProofPack(
        runId=run.id,
        createdAt=now(),
        riskSummary=(
            f"{run.dependencyFindings[0].packageName} risk reduced from {run.dependencyFindings[0].riskScore} to 18."
            if run.dependencyFindings
            else "No dependency risk findings."
        ),
        patchSummary=" | ".join([f"{a.strategy}:{a.patchSummary}" for a in run.remediationAttempts]),
        verificationSummary="Verification suite passed." if run.verificationResult and run.verificationResult.passed else "Verification failures detected.",
        simulationSummary="Blast-radius simulation is below regression threshold." if run.simulationResult and run.simulationResult.passed else "Simulation indicates elevated business impact.",
        rollbackCommand=f"POST /api/runs/{run.id}/rollback",
        traceDigest=payload["traceDigest"],
        signature=sign_payload(payload),
    )


def create_exception_ticket(run: Run) -> ExceptionTicket:
    provider = os.getenv("EXCEPTION_PROVIDER", "none")
    if provider not in ("jira", "linear", "none"):
        provider = "none"
    return ExceptionTicket(
        id=str(uuid.uuid4()),
        runId=run.id,
        reason=run.finalDecision.rationale if run.finalDecision else "Unknown exception",
        topOptions=(run.finalDecision.topOptions if run.finalDecision else []),
        createdAt=now(),
        provider=provider,
    )


def update_learning_memory(run: Run) -> None:
    success = bool(run.finalDecision and run.finalDecision.status == "merge-ready")
    for attempt in run.remediationAttempts:
        existing = next((r for r in state.learning_memory if r.strategy == attempt.strategy), None)
        if not existing:
            state.learning_memory.append(
                LearningMemoryRecord(
                    id=str(uuid.uuid4()),
                    packagePattern=run.dependencyFindings[0].packageName if run.dependencyFindings else "generic",
                    strategy=attempt.strategy,
                    successRate=1.0 if success else 0.0,
                    sampleSize=1,
                    lastUsedAt=now(),
                )
            )
            continue

        total_success = existing.successRate * existing.sampleSize + (1.0 if success else 0.0)
        existing.sampleSize += 1
        existing.successRate = round(total_success / existing.sampleSize, 2)
        existing.lastUsedAt = now()


def persist_run_state_aws(run: Run) -> Dict[str, Any]:
    table_name = os.getenv("DYNAMODB_TABLE")
    region = os.getenv("AWS_REGION")
    if not table_name or not region or boto3 is None:
        return {"enabled": False, "reason": "DYNAMODB_TABLE/AWS_REGION not configured or boto3 unavailable"}

    try:
        table = boto3.resource("dynamodb", region_name=region).Table(table_name)
        table.put_item(
            Item={
                "id": run.id,
                "stage": run.stage,
                "status": run.status,
                "updatedAt": run.updatedAt,
                "finalDecision": run.finalDecision.model_dump() if run.finalDecision else None,
            }
        )
        return {"enabled": True, "persisted": True}
    except Exception as exc:
        return {"enabled": True, "persisted": False, "error": str(exc)}


def upload_proof_pack_aws(run: Run) -> Dict[str, Any]:
    bucket = os.getenv("ARTIFACT_BUCKET")
    region = os.getenv("AWS_REGION")
    if not bucket or not region or boto3 is None:
        return {"enabled": False, "reason": "ARTIFACT_BUCKET/AWS_REGION not configured or boto3 unavailable"}

    if not run.proofPack:
        return {"enabled": True, "uploaded": False, "error": "proof pack missing"}

    key = f"proof-packs/{run.id}.json"
    try:
        client = boto3.client("s3", region_name=region)
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(run.proofPack.model_dump(), indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        return {"enabled": True, "uploaded": True, "key": key}
    except Exception as exc:
        return {"enabled": True, "uploaded": False, "error": str(exc)}


def publish_exception_aws(run: Run) -> Dict[str, Any]:
    topic_arn = os.getenv("SNS_TOPIC_ARN")
    region = os.getenv("AWS_REGION")
    if not topic_arn or not region or boto3 is None:
        return {"enabled": False, "reason": "SNS_TOPIC_ARN/AWS_REGION not configured or boto3 unavailable"}

    if not run.finalDecision:
        return {"enabled": True, "published": False, "error": "final decision missing"}

    try:
        client = boto3.client("sns", region_name=region)
        client.publish(
            TopicArn=topic_arn,
            Subject="RealityShield exception",
            Message=json.dumps(
                {
                    "runId": run.id,
                    "reason": run.finalDecision.rationale,
                    "confidence": run.finalDecision.confidence,
                }
            ),
        )
        return {"enabled": True, "published": True}
    except Exception as exc:
        return {"enabled": True, "published": False, "error": str(exc)}


async def execute_run(run: Run) -> None:
    start_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    append_agent_event(run, "detect", "Intake Agent", intake_agent.process("pull_request"))
    ai_cycle_steps = run_ai_cycle_graph(run.id, run.scenario)
    run.trace.append(
        create_event(
            run,
            "detect",
            "Intake Agent",
            f"LangGraph AI cycle ready: {' -> '.join(ai_cycle_steps)}.",
            0.93,
            "low",
            ["langgraph", "langchain", "ai-cycle"],
        )
    )

    transition(run, "assess")
    append_agent_event(run, "assess", "Dependency Graph Agent", dependency_graph_agent.process())

    run.dependencyFindings = await safedep_risk_scan(run)
    append_agent_event(
        run,
        "assess",
        "Risk Intelligence Agent",
        risk_intelligence_agent.summarize(
            finding_count=len(run.dependencyFindings),
            has_malicious=any(f.malicious for f in run.dependencyFindings),
            run_id=run.id,
        ),
    )

    run.policyActionPlans = compile_policy_plans(run.dependencyFindings)
    append_agent_event(
        run,
        "assess",
        "Policy Compiler Agent",
        policy_compiler_agent.compile_summary(len(run.policyActionPlans)),
    )

    transition(run, "remediate")
    ordered = next_strategy()

    for index, strategy in enumerate(ordered):
        attempt_num = index + 1
        append_agent_event(
            run,
            "remediate",
            "Remediation Planner Agent",
            remediation_planner_agent.rank(strategy, attempt_num),
        )

        attempt = execute_strategy(run, strategy, attempt_num)
        run.remediationAttempts.append(attempt)
        append_agent_event(
            run,
            "remediate",
            "Patch Executor Agent",
            patch_executor_agent.apply(strategy, attempt.reason, attempt.success),
        )

        transition(run, "verify")
        run.verificationResult = verify_run(attempt)
        append_agent_event(run, "verify", "Verification Agent", verification_agent.check(run.verificationResult.passed))

        transition(run, "simulate")

        if not run.verificationResult.passed:
            run.telemetry.retries += 1
            if attempt_num == len(ordered):
                transition(run, "remediate")
                transition(run, "exception")
                break
            transition(run, "remediate")
            continue

        run.simulationResult = simulate_blast_radius(run, attempt)
        append_agent_event(
            run,
            "simulate",
            "Blast-Radius Simulation Agent",
            simulation_agent.evaluate(
                run.simulationResult.blastRadiusScoreBefore,
                run.simulationResult.blastRadiusScoreAfter,
                run.simulationResult.passed,
            ),
        )

        if not run.simulationResult.passed:
            run.telemetry.retries += 1
            if attempt_num == len(ordered):
                transition(run, "exception")
                break
            transition(run, "remediate")
            continue

        transition(run, "finalize")
        break

    run.finalDecision = finalize_decision(run)
    if run.stage not in ("exception", "finalize"):
        run.stage = "exception" if run.finalDecision.status == "exception" else "finalize"

    if run.finalDecision.status == "exception":
        append_agent_event(run, "exception", "Exception Router Agent", exception_router_agent.route())
        run.exceptionTicket = create_exception_ticket(run)

    run.trace.append(
        create_event(
            run,
            "exception" if run.stage == "exception" else "finalize",
            "PR Ops Agent",
            f"PR decision posted: {run.finalDecision.status}.",
            run.finalDecision.confidence,
            "low" if run.finalDecision.status == "merge-ready" else "medium",
            ["github-mcp", "checks-api"],
        )
    )

    run.proofPack = build_proof_pack(run)
    append_agent_event(
        run,
        "exception" if run.stage == "exception" else "finalize",
        "Evidence and Proof Agent",
        proof_agent.generate(run.id),
    )

    update_learning_memory(run)
    append_agent_event(
        run,
        "exception" if run.stage == "exception" else "finalize",
        "Learning Memory Agent",
        learning_memory_agent.record(),
    )

    run.status = "completed"
    run.updatedAt = now()
    end_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    run.telemetry.meanRemediationMs = end_ms - start_ms
    run.telemetry.autoResolved = run.finalDecision.status == "merge-ready"

    dynamo = persist_run_state_aws(run)
    run.trace.append(
        create_event(
            run,
            run.stage,
            "Learning Memory Agent",
            "DynamoDB run-state persisted." if dynamo.get("persisted") else f"DynamoDB persistence skipped/failed: {dynamo.get('reason') or dynamo.get('error')}",
            0.92 if dynamo.get("persisted") else 0.7,
            "low" if dynamo.get("persisted") else "medium",
            ["aws-dynamodb", "run-state"],
        )
    )

    s3 = upload_proof_pack_aws(run)
    run.trace.append(
        create_event(
            run,
            run.stage,
            "Evidence and Proof Agent",
            "Proof pack uploaded to S3." if s3.get("uploaded") else f"S3 upload skipped/failed: {s3.get('reason') or s3.get('error')}",
            0.92 if s3.get("uploaded") else 0.7,
            "low" if s3.get("uploaded") else "medium",
            ["aws-s3", "proof-pack"],
        )
    )

    if run.finalDecision.status == "exception":
        sns = publish_exception_aws(run)
        run.trace.append(
            create_event(
                run,
                "exception",
                "Exception Router Agent",
                "SNS exception alert published." if sns.get("published") else f"SNS publish skipped/failed: {sns.get('reason') or sns.get('error')}",
                0.9 if sns.get("published") else 0.68,
                "medium" if sns.get("published") else "high",
                ["aws-sns", "exception-alert"],
            )
        )


async def start_run(input_data: StartRunInput) -> Run:
    run = Run(
        id=str(uuid.uuid4()),
        prNumber=input_data.prNumber,
        repo=input_data.repo,
        branch=input_data.branch,
        mode=input_data.mode,
        scenario=input_data.scenario,
        stage="detect",
        createdAt=now(),
        updatedAt=now(),
        status="running",
        dependencyFindings=[],
        policyActionPlans=[],
        remediationAttempts=[],
        trace=[],
        telemetry=Telemetry(meanRemediationMs=0, autoResolved=False, retries=0),
    )
    state.runs[run.id] = run
    await execute_run(run)
    return run


async def process_webhook(payload: WebhookPayload) -> Dict[str, Any]:
    if payload.eventId in state.webhook_events:
        existing = next((r for r in state.runs.values() if r.prNumber == payload.prNumber and r.repo == payload.repo), None)
        return {"deduplicated": True, "run": existing.model_dump() if existing else None}

    state.webhook_events.add(payload.eventId)
    run = await start_run(
        StartRunInput(
            repo=payload.repo,
            branch=payload.branch,
            prNumber=payload.prNumber,
            scenario=payload.scenario or "malicious-retry",
            mode=payload.mode or "mock",
        )
    )
    return {"deduplicated": False, "run": run.model_dump()}


def list_runs() -> List[Run]:
    return sorted(state.runs.values(), key=lambda r: r.updatedAt, reverse=True)


def metrics_summary() -> Dict[str, Any]:
    runs = list_runs()
    if not runs:
        return {
            "totalRuns": 0,
            "autoResolvedRate": 0,
            "meanRemediationMs": 0,
            "criticalBlocked": 0,
            "simulationRegressionPrevented": 0,
            "activeAgents": [
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
            ],
        }

    auto_resolved = len([r for r in runs if r.finalDecision and r.finalDecision.status == "merge-ready"])
    blocked = len([r for r in runs if r.finalDecision and r.finalDecision.status == "blocked"])
    mean = round(sum(r.telemetry.meanRemediationMs for r in runs) / len(runs))
    prevented = len(
        [
            r
            for r in runs
            if r.simulationResult and isinstance(r.simulationResult.businessImpactDelta, int) and r.simulationResult.businessImpactDelta < 0
        ]
    )
    return {
        "totalRuns": len(runs),
        "autoResolvedRate": round((auto_resolved / len(runs)) * 100, 1),
        "meanRemediationMs": mean,
        "criticalBlocked": blocked,
        "simulationRegressionPrevented": prevented,
        "activeAgents": [
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
        ],
    }


def verify_github_signature(body: bytes, signature_header: str) -> bool:
    secret = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    if not secret:
        return False
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


app = FastAPI(title="RealityShield FastAPI Backend", version="1.0.0")

cors_origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/webhooks/pr")
async def webhook_pr(
    request: Request,
    x_github_event: Optional[str] = Header(default=None),
    x_github_delivery: Optional[str] = Header(default=None),
    x_hub_signature_256: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    body = await request.body()

    if x_github_event == "ping":
        return {"ok": True, "deliveryId": x_github_delivery}

    if x_github_event:
        if x_github_event != "pull_request":
            return {"ignored": True, "reason": f"Unsupported event type: {x_github_event}"}
        if not x_hub_signature_256 or not verify_github_signature(body, x_hub_signature_256):
            raise HTTPException(status_code=401, detail="Invalid GitHub webhook signature")

        payload = json.loads(body.decode("utf-8"))
        action = payload.get("action")
        if action not in {"opened", "synchronize", "reopened", "ready_for_review"}:
            return {"ignored": True, "reason": f"Unsupported pull_request action: {action}"}
        if payload.get("pull_request", {}).get("draft"):
            return {"ignored": True, "reason": "Draft pull request"}

        labels = payload.get("pull_request", {}).get("labels", [])
        names = {str(label.get("name", "")).lower() for label in labels}
        scenario: Scenario = "malicious-retry"
        if "shield:clean-pass" in names:
            scenario = "clean-pass"
        elif "shield:low-confidence" in names:
            scenario = "low-confidence"

        normalized = WebhookPayload(
            eventId=x_github_delivery or str(uuid.uuid4()),
            repo=payload.get("repository", {}).get("full_name", "unknown/repo"),
            branch=payload.get("pull_request", {}).get("head", {}).get("ref", "unknown-branch"),
            prNumber=int(payload.get("number", 1)),
            scenario=scenario,
            mode="real" if os.getenv("APP_MODE", "mock") == "real" else "mock",
        )
        return await process_webhook(normalized)

    # Allows local direct testing without GitHub headers.
    normalized = WebhookPayload(**json.loads(body.decode("utf-8")))
    return await process_webhook(normalized)


@app.post("/api/runs/start", response_model=Run)
async def api_start_run(payload: StartRunInput) -> Run:
    return await start_run(payload)


@app.get("/api/runs/{run_id}", response_model=Run)
def api_get_run(run_id: str) -> Run:
    run = state.runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.get("/api/runs/{run_id}/timeline")
def api_run_timeline(run_id: str) -> Dict[str, Any]:
    run = state.runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"timeline": [event.model_dump() for event in run.trace]}


@app.get("/api/runs/{run_id}/proof-pack")
def api_run_proof_pack(run_id: str) -> Dict[str, Any]:
    run = state.runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if not run.proofPack:
        raise HTTPException(status_code=404, detail="Proof pack not available")
    return run.proofPack.model_dump()


@app.post("/api/runs/{run_id}/retry", response_model=Run)
async def api_retry_run(run_id: str) -> Run:
    run = state.runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return await start_run(
        StartRunInput(
            repo=run.repo,
            branch=run.branch,
            prNumber=run.prNumber,
            scenario=run.scenario,
            mode=run.mode,
        )
    )


@app.post("/api/runs/{run_id}/rollback", response_model=Run)
def api_rollback_run(run_id: str) -> Run:
    run = state.runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    run.trace.append(
        create_event(
            run,
            run.stage,
            "PR Ops Agent",
            "Rollback action queued with safe baseline pin and compatibility lock.",
            0.92,
            "medium",
            ["rollback", "github-mcp"],
        )
    )
    run.updatedAt = now()
    return run


@app.get("/api/metrics/summary")
def api_metrics_summary() -> Dict[str, Any]:
    return metrics_summary()
