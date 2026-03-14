
# RealityShield Autopilot

Its handled.

Live demo: https://ai-system-architect--glitchsnap27.replit.app/

Autonomous PR security and reliability operator that does not stop at alerts. It detects risk, remediates, verifies with business-impact simulation, and returns a merge-ready PR with machine-verifiable proof.

No chatbot UI. Input to finished outcome with minimal human intervention.

## Architecture Summary

- End-to-end Concierge staged workflow with deterministic transitions.
- 12-agent system with strict handoff contracts and traceable events.
- Multi-strategy remediation retries (A, B, C) until policy and verification pass.
- Runtime blast-radius simulation with before/after impact scoring.
- Policy-to-action compiler that emits executable playbooks.
- Signed Merge Readiness Proof Pack with rollback command.
- Confidence-gated escalation for ambiguous runs only.
- Repository learning memory to improve next strategy ranking.
- Safe rollback and roll-forward hooks for post-merge or failed verification recovery.

## Product Workflow

1. PR webhook received.
2. Dependency and lockfile diff extraction.
3. SafeDep malicious package and risk scan.
4. Policy evaluation and action plan compilation.
5. Remediation plan generation with ranked alternatives.
6. Apply patch and lockfile updates.
7. Verification tests plus synthetic flow simulation.
8. If failed, retry next remediation strategy.
9. Final decision: merge-ready or exception queue.
10. Publish proof pack and PR updates.

## Multi-Agent Architecture

1. Intake Agent
2. Dependency Graph Agent
3. Risk Intelligence Agent
4. Policy Compiler Agent
5. Remediation Planner Agent
6. Patch Executor Agent
7. Verification Agent
8. Blast-Radius Simulation Agent
9. PR Ops Agent
10. Evidence and Proof Agent
11. Exception Router Agent
12. Learning Memory Agent

## Concierge Orchestration

Stages:

- detect
- assess
- remediate
- verify
- simulate
- finalize
- exception

Transitions:

- detect to assess
- assess to remediate
- assess to exception
- remediate to verify
- verify to simulate
- simulate to finalize
- simulate to remediate
- remediate to exception

## Partner Integrations

1. SafeDep cloud plus OSS tools for malicious package intelligence.
2. Concierge SDK pattern for staged orchestration and state.
3. Unsiloed optional mode for parsing policy docs and extracting machine-actionable acceptance criteria.
4. MCP integrations:

- GitHub MCP for PR status, comments, labels, checks
- Slack MCP for incident notifications
- Jira or Linear MCP for exception tickets

## Cloud Architecture (AWS Free-Tier Friendly)

1. API Gateway for webhook intake
2. Lambda for orchestration and workers
3. Step Functions optional mirror for observability
4. CodeBuild for test and simulation jobs
5. DynamoDB for run state, events, learning memory
6. S3 for artifacts and proof packs
7. SNS for alerts
8. CloudWatch for logs and metrics

## Build Modes

1. Real mode with API keys.
2. Mock mode with seeded scenarios when keys are unavailable.

Demo always works in mock mode.

## Frontend Command Center

Implemented screens:

1. Live Incident Timeline
2. Risk Diff Panel
3. Blast Radius Map
4. Merge Readiness Card
5. Autonomous Action Log
6. Exception Queue
7. KPI Strip

Design direction implemented:

1. Strong typography and hierarchy
2. Atmospheric gradient background with subtle grid texture
3. High-contrast status colors
4. Meaningful motion for state transitions
5. Mobile-responsive and desktop-optimized layouts
6. Loading, empty, and failure states

## Tech Stack

- Frontend: Next.js App Router + TypeScript
- Backend: FastAPI + Python (agent orchestration APIs)
- LangChain (policy compiler runnable pipeline)
- LangGraph (AI cycle and stage graph orchestration)
- Tailwind CSS
- Hero UI component usage
- Magic UI-inspired animated timeline and visual effects
- Pydantic schema validation
- Zustand store
- AWS integrations from Python backend via boto3 (DynamoDB, S3, SNS)

## Required API Endpoints

- POST /api/webhooks/pr
- POST /api/runs/start
- GET /api/runs/:id
- GET /api/runs/:id/timeline
- GET /api/runs/:id/proof-pack
- POST /api/runs/:id/retry
- POST /api/runs/:id/rollback
- GET /api/metrics/summary

## Data Model

- Run
- StageEvent
- DependencyFinding
- PolicyActionPlan
- RemediationAttempt
- VerificationResult
- SimulationResult
- FinalDecision
- ProofPack
- ExceptionTicket
- LearningMemoryRecord

## AI Development Cycle Embedded

1. Plan
2. Observe
3. Decide
4. Act
5. Verify
6. Simulate
7. Learn
8. Improve next attempt

## Security Requirements

1. Environment variables only for secrets
2. .env.example included
3. Secret redaction in logs
4. No hardcoded keys
5. Idempotent webhook handling and retry-safe workers

## Seeded Demo Scenarios

1. Malicious dependency, first remediation fails, second succeeds, PR becomes merge-ready
2. Clean PR passes directly
3. Low-confidence case routed to exception queue

## Acceptance Criteria

1. End-to-end run completes autonomously
2. At least one scenario shows multi-strategy retry
3. Blast-radius score is computed and displayed
4. Proof pack is generated and downloadable
5. PR decision is clearly shown as merge-ready or blocked
6. Judge understands value in under 15 seconds

## Folder Tree

```text
backend/
	app/
		agents/
			base_agent.py
			intake_agent.py
			dependency_graph_agent.py
			risk_intelligence_agent.py
			policy_compiler_agent.py
			remediation_planner_agent.py
			patch_executor_agent.py
			verification_agent.py
			simulation_agent.py
			exception_router_agent.py
			proof_agent.py
			learning_memory_agent.py
			__init__.py
		langgraph_flow.py
		main.py
	requirements.txt
src/
	app/
		api/
			metrics/summary/route.ts
			runs/
				[id]/
					proof-pack/route.ts
					retry/route.ts
					rollback/route.ts
					timeline/route.ts
					route.ts
				start/route.ts
			webhooks/pr/route.ts
		globals.css
		layout.tsx
		page.tsx
		providers.tsx
	components/
		command-center.tsx
		magic-ui/
			grid-aura.tsx
			timeline-reveal.tsx
	lib/
		backend-url.ts
		integrations/aws.ts
		system.ts
	store/
		use-run-store.ts
	types/
		run.ts
scripts/
	seed.ts
	run-one-case.ts
.env.example
```

## Setup and Run

```bash
npm install
python -m pip install -r backend/requirements.txt
```

Run backend (FastAPI):

```bash
npm run dev:backend
```

Run frontend (Next.js):

```bash
npm run dev:frontend
```

Open http://localhost:3000

Backend default URL: http://localhost:8000

Set these in .env for frontend-to-backend routing:

- NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
- BACKEND_CORS_ORIGINS=http://localhost:3000

## Partner Apps Quickstart (SafeDep + Unsiloed)

This project integrates partner capabilities in the FastAPI backend at `backend/app/main.py`.

### SafeDep Cloud Integration

Reference: https://docs.safedep.io/cloud/quickstart

What SafeDep powers in RealityShield:

1. Malicious package intelligence and dependency risk enrichment.
2. Policy violation inputs for policy-to-action playbooks.
3. Optional cloud-mode reporting and query workflows.

Required environment variables:

- SAFEDEP_CLOUD_TENANT_DOMAIN
- SAFEDEP_CLOUD_API_KEY

Quick onboarding options from SafeDep docs:

1. Web onboarding:
	- Create account at app.safedep.io.
	- Create tenant and capture tenant domain.
	- Generate API key.
2. CLI onboarding:
	- `brew tap safedep/tap`
	- `brew install safedep/tap/vet`
	- `vet cloud quickstart`

Useful verification commands from SafeDep docs:

- `vet auth configure --tenant <tenant-domain>`
- `vet auth verify`

Optional sync command from SafeDep docs:

- `vet scan -M /path/to/package-lock.json --report-sync --report-sync-project my-project --report-sync-project-version my-project-version`

GitHub Actions partner integration pattern from SafeDep docs:

1. Add GitHub secrets:
	- SAFEDEP_CLOUD_API_KEY
	- SAFEDEP_CLOUD_TENANT_DOMAIN
2. Use `safedep/vet-action@v1` with cloud mode enabled.

### Unsiloed Integration

Reference: https://docs.unsiloed.ai/quickstart

What Unsiloed powers in RealityShield:

1. Optional policy/document parsing in `Policy Compiler Agent` workflows.
2. Extraction of machine-actionable acceptance criteria from unstructured policy docs.

Required environment variable:

- UNSILOED_API_KEY

Unsiloed API quickstart highlights:

1. Get API key and keep it in environment variables only.
2. Optional SDK install:
	- `pip install unsiloed-sdk`
3. Parse and extract with schema-driven workflows (Python, TypeScript, or REST).

Unsiloed API endpoint details:

- Base URL: `https://prod.visionapi.unsiloed.ai`
- Auth header: `api-key: <UNSILOED_API_KEY>`

Common use cases mapped to this project:

1. Contract and policy parsing for rule extraction.
2. Document classification for exception routing.
3. Structured extraction with confidence scoring for policy gates.

### Partner Mode Matrix

1. Mock mode (`APP_MODE=mock`): deterministic demo, no external dependency required.
2. Real mode (`APP_MODE=real`): SafeDep Cloud active when tenant and key are set; Unsiloed policy parsing enabled when key is set.
3. Mixed mode: SafeDep real plus Unsiloed optional fallback supported.

### Connect GitHub PR Webhook (Verified)

1. Set GITHUB_WEBHOOK_SECRET in your local .env.
2. In your GitHub repository, go to Settings, then Webhooks, then Add webhook.
3. Set Payload URL to your backend endpoint:
	 - Local with tunnel: https://<your-ngrok-id>.ngrok.app/api/webhooks/pr
	 - Deployed: https://<your-domain>/api/webhooks/pr
4. Set Content type to application/json.
5. Set Secret to the same value as GITHUB_WEBHOOK_SECRET.
6. Select Pull requests events.
7. Save and open, synchronize, or reopen a PR to trigger the full pipeline.

Supported PR actions: opened, synchronize, reopened, ready_for_review.
Draft PRs and unsupported events are ignored.

Optional scenario labels for demos:

- shield:clean-pass
- shield:low-confidence
- default (no label): malicious-retry

### Seed Demo Data

```bash
npm run seed
```

### Run One Case (No Webhook)

This runs one full backend case locally with mock integrations and writes output JSON to seed-output.

```bash
npm run run:one-case
```

Scenario override:

```bash
npm run run:one-case -- clean-pass
npm run run:one-case -- low-confidence
```

### Replit or Emergent Friendly Start

```bash
npm install
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## 90-Second Demo Script

1. Open dashboard and point to KPI strip and autonomy claim: Its handled.
2. Trigger malicious-retry and show deterministic stage timeline.
3. Show strategy A failure and automatic strategy B success.
4. Open Blast Radius Map and show before and after impact reduction.
5. Download Proof Pack and show signature, trace digest, and rollback command.
6. Trigger low-confidence and show exception queue with top 2 suggested actions.
7. Close on merge-readiness clarity and auto-resolved rate.

## Competitor Comparison

| Capability | RealityShield Autopilot | CodeRabbit | Snyk | Dependabot |
|---|---|---|---|---|
| Autonomous detect to remediate to verify to simulate closure | Yes | Partial | Partial | Partial |
| Multi-strategy remediation retries | Yes | No | Limited | No |
| Blast-radius business simulation | Yes | No | Limited | No |
| Signed merge-readiness proof pack | Yes | No | No | No |
| Confidence-gated escalation | Yes | No | Limited | No |
| Agent trace replay | Yes | No | No | No |
| Learning-memory ranked remediation | Yes | No | Limited | No |
| Rollback and roll-forward automation hooks | Yes | No | Limited | Limited |

## Deliverables Checklist

1. Architecture summary
2. Folder tree
3. Full code in repository
4. Run commands for local and Replit style startup
5. Environment template
6. Seed scripts
7. 90-second demo script
8. Competitor comparison table

## Prompt Section

The following is the exact build prompt reference used for this project:

```markdown
You are a principal AI systems architect and full-stack engineer. Build a complete, hackathon-ready MVP in one pass.

Project name:
RealityShield Autopilot

Mission:
Build an autonomous PR security and reliability operator that does not just alert. It must detect risk, remediate, verify with business-impact simulation, and return a merge-ready PR with machine-verifiable proof.

Theme:
Its handled
No chatbot UI
Input to finished outcome with minimal human intervention

Competitive goal:
Outperform CodeRabbit, Snyk, and Dependabot by proving end-to-end autonomous closure, not just findings or suggestions.

Core differentiators you must implement:
1. Multi-strategy remediation retries
Try fix plan A, then B, then C automatically until one passes policy and tests.
2. Runtime blast-radius simulation
Run synthetic user/business flows after each fix and compute impact score.
3. Policy-to-action compiler
Translate policy violations into executable playbooks, not static alerts.
4. Merge Readiness Proof Pack
Generate signed evidence bundle with risk, patch, tests, simulation, rollback command.
5. Confidence-gated human escalation
Auto-resolve high-confidence runs; escalate only ambiguous runs with top 2 options.
6. Agent trace replay
One-click replay of every decision and action for trust and judging.
7. Repo learning memory
Store successful past fixes and rank future remediation choices using that memory.
8. Safe rollback and roll-forward
If verification or post-merge telemetry fails, auto-open rollback or improved fix PR.

Product workflow:
1. PR webhook received
2. Dependency and lockfile diff extraction
3. SafeDep malicious package and risk scan
4. Policy evaluation and action plan compilation
5. Remediation plan generation with ranked alternatives
6. Apply patch and lockfile updates
7. Verification tests plus synthetic flow simulation
8. If failed, retry next remediation strategy
9. Final decision: merge-ready or exception queue
10. Publish proof pack and PR updates

Multi-agent architecture:
Create separate agents with strict handoff contracts.
1. Intake Agent
2. Dependency Graph Agent
3. Risk Intelligence Agent
4. Policy Compiler Agent
5. Remediation Planner Agent
6. Patch Executor Agent
7. Verification Agent
8. Blast-Radius Simulation Agent
9. PR Ops Agent
10. Evidence and Proof Agent
11. Exception Router Agent
12. Learning Memory Agent

Concierge orchestration:
Use Concierge staged workflow with deterministic transitions.

Stages:
- detect
- assess
- remediate
- verify
- simulate
- finalize
- exception

Transitions:
- detect to assess
- assess to remediate
- assess to exception
- remediate to verify
- verify to simulate
- simulate to finalize
- simulate to remediate
- remediate to exception

Partner integrations:
1. SafeDep cloud plus OSS tools for malicious package intelligence
2. Concierge SDK for staged orchestration and state
3. Unsiloed optional mode for parsing policy docs and extracting machine-actionable acceptance criteria
4. MCP integrations:
- GitHub MCP for PR status, comments, labels, checks
- Slack MCP for incident notifications
- Jira or Linear MCP for exception tickets

Cloud architecture (AWS free-tier friendly):
1. API Gateway for webhook intake
2. Lambda for orchestration and workers
3. Step Functions optional mirror for observability
4. CodeBuild for test and simulation jobs
5. DynamoDB for run state, events, learning memory
6. S3 for artifacts and proof packs
7. SNS for alerts
8. CloudWatch for logs and metrics

Build modes:
1. Real mode with API keys
2. Mock mode with seeded scenarios when keys are unavailable
Demo must always work in mock mode.

Frontend requirements:
Create a bold, premium command-center UI that looks distinctly better than standard dashboards.
Use:
- Hero UI for polished components
- Magic UI for animated timeline and visual effects
- Optional generated inspirations from v0.dev, bolt.new, lovable, uizard

UI screens:
1. Live Incident Timeline
- stage progression with timestamps
- current active agent
- tool badges
- confidence and severity chips
2. Risk Diff Panel
- risky package and reason
- safe replacement and compatibility score
- patch preview
3. Blast Radius Map
- changed modules
- impacted user journeys
- projected business impact score before and after
4. Merge Readiness Card
- Security pass/fail
- Tests pass/fail
- Policy pass/fail
- Simulation pass/fail
- PR ready yes/no
5. Autonomous Action Log
- deterministic machine actions with evidence links
6. Exception Queue
- only low-confidence runs
- top 2 recommended actions with predicted success
7. KPI Strip
- auto-resolved rate
- mean remediation time
- critical blocked
- simulation-regression prevented

Design direction:
1. Strong typography and hierarchy
2. Atmospheric gradient background with subtle grid texture
3. High-contrast status colors
4. Meaningful motion only for state transitions
5. Mobile-responsive and desktop-optimized
6. Excellent loading, empty, and failure states

Tech stack:
Use TypeScript full-stack and keep setup Replit/Emergent friendly.
- Next.js app router
- Tailwind CSS
- Hero UI
- Magic UI
- zod schema validation
- lightweight store (Zustand or context)
- Prisma plus sqlite optional
- server routes for orchestration APIs

Required API endpoints:
- POST /api/webhooks/pr
- POST /api/runs/start
- GET /api/runs/:id
- GET /api/runs/:id/timeline
- GET /api/runs/:id/proof-pack
- POST /api/runs/:id/retry
- POST /api/runs/:id/rollback
- GET /api/metrics/summary

Data model:
- Run
- StageEvent
- DependencyFinding
- PolicyActionPlan
- RemediationAttempt
- VerificationResult
- SimulationResult
- FinalDecision
- ProofPack
- ExceptionTicket
- LearningMemoryRecord

AI development cycle to embed:
1. Plan
2. Observe
3. Decide
4. Act
5. Verify
6. Simulate
7. Learn
8. Improve next attempt

Security requirements:
1. Environment variables only for secrets
2. env.example included
3. Secret redaction in logs
4. No hardcoded keys
5. Idempotent webhook handling and retry-safe workers

Seeded demo scenarios:
1. Malicious dependency, first remediation fails, second succeeds, PR becomes merge-ready
2. Clean PR passes directly
3. Low-confidence case routed to exception queue

Acceptance criteria:
1. End-to-end run completes autonomously
2. At least one scenario shows multi-strategy retry
3. Blast-radius score is computed and displayed
4. Proof pack is generated and downloadable
5. PR decision is clearly shown as merge-ready or blocked
6. Judge understands value in under 15 seconds

Deliverables:
1. Architecture summary
2. Folder tree
3. Full code files
4. Run commands for Replit and local
5. Env template
6. Seed scripts
7. 90-second demo script
8. Short competitor comparison table showing why this is stronger than CodeRabbit, Snyk, Dependabot

Output format:
1. Architecture summary
2. File tree
3. Full code
4. Setup and run steps
5. Demo script
Start now and build immediately without asking clarifying questions.
```
