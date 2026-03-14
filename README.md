
# RealityShield Autopilot

Autonomous PR security and reliability operator that closes the loop: detect, remediate, verify, simulate blast radius, and publish merge-ready proof.

## Architecture Summary

- Concierge staged flow: detect -> assess -> remediate -> verify -> simulate -> finalize (or exception)
- 12 strict-role agents with deterministic handoff contracts
- Policy-to-action compiler turns violations into executable playbooks
- Multi-strategy remediation retries (A/B/C) with automatic fallback
- Runtime blast-radius simulation with before/after business impact scoring
- Confidence-gated escalation with top 2 options for low-confidence runs
- Signed Merge Readiness Proof Pack with rollback command and trace digest
- Learning memory that ranks future strategy choices by historical success

### Cloud Mapping (AWS free-tier friendly)

- API Gateway -> webhook intake
- Lambda -> API route workers / orchestration
- Step Functions (optional mirror) -> state transition observability
- CodeBuild -> verification and simulation jobs
- DynamoDB -> runs/events/learning memory
- S3 -> artifacts and proof packs
- SNS -> escalation alerts
- CloudWatch -> logs, metrics, traces

## Multi-Agent Contracts

1. Intake Agent: normalize webhook payload, idempotency key
2. Dependency Graph Agent: extract lockfile + package graph diff
3. Risk Intelligence Agent: SafeDep scan and risk enrichment
4. Policy Compiler Agent: compile policy to executable action plan
5. Remediation Planner Agent: rank A/B/C strategies from learning memory
6. Patch Executor Agent: apply patch + lockfile update
7. Verification Agent: tests and policy checks
8. Blast-Radius Simulation Agent: synthetic user journey impact scoring
9. PR Ops Agent: update PR checks/comments/labels
10. Evidence and Proof Agent: produce signed proof-pack
11. Exception Router Agent: queue low-confidence runs with top 2 options
12. Learning Memory Agent: update success rates for future ranking

## API Endpoints

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

## Mock and Real Modes

- Mock mode (default): seeded deterministic scenarios for always-on demo reliability
- Real mode: enable SafeDep and optional integrations via environment variables

## Security Notes

- Secrets only from environment variables
- .env.example included
- Log/event secret redaction implemented
- No hardcoded credentials
- Idempotent webhook handling with event key dedupe

## Setup and Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Connect GitHub PR Webhook (Verified)

1. Set `GITHUB_WEBHOOK_SECRET` in your local `.env`.
2. In your GitHub repository, go to Settings -> Webhooks -> Add webhook.
3. Set Payload URL to your backend endpoint:
	- Local with tunnel: `https://<your-ngrok-id>.ngrok.app/api/webhooks/pr`
	- Deployed: `https://<your-domain>/api/webhooks/pr`
4. Set Content type to `application/json`.
5. Set Secret to the same value as `GITHUB_WEBHOOK_SECRET`.
6. Select events: `Pull requests`.
7. Save and open/synchronize/reopen a PR to trigger the full pipeline.

Supported PR actions: opened, synchronize, reopened, ready_for_review.
Draft PRs and unsupported events are ignored.

Optional scenario labels for demos:
- `shield:clean-pass`
- `shield:low-confidence`
- default (no label): `malicious-retry`

### Seed Demo Data

```bash
npm run seed
```

### Run One Case (No Webhook)

This runs a full backend case locally with mock integrations and writes output JSON to `seed-output/`.

```bash
npm run run:one-case
```

Optional scenario override:

```bash
npm run run:one-case -- clean-pass
npm run run:one-case -- low-confidence
```

## Replit/Emergent Friendly Start

```bash
npm install
npm run dev -- --hostname 0.0.0.0 --port 3000
```

## Seeded Scenarios

1. malicious-retry: first remediation fails, second succeeds, merge-ready
2. clean-pass: direct pass
3. low-confidence: routed to exception queue

## 90-Second Demo Script

1. Open dashboard and call out KPI strip + "Its handled" autonomy positioning.
2. Trigger "Run malicious retry" and highlight deterministic stage timeline.
3. Show strategy A failure then strategy B success and explain auto retry loop.
4. Open Blast Radius Map and show before/after impact score reduction.
5. Download Proof Pack and show signature, trace digest, rollback command.
6. Trigger low-confidence scenario and show exception queue with top 2 recommended actions.
7. Close with auto-resolved rate and merge-readiness decision clarity under 15 seconds.

## Competitor Comparison

| Capability | RealityShield Autopilot | CodeRabbit | Snyk | Dependabot |
|---|---|---|---|---|
| Autonomous detect -> remediate -> verify -> simulate closure | Yes | Partial (review-focused) | Partial | Partial |
| Multi-strategy remediation retries | Yes (A/B/C auto-fallback) | No | Limited | No |
| Blast-radius business simulation | Yes | No | Limited | No |
| Signed merge-readiness proof pack | Yes | No | No | No |
| Confidence-gated human escalation | Yes (top 2 options) | No | Limited | No |
| Agent trace replay | Yes | No | No | No |
| Learning-memory ranked remediation | Yes | No | Limited | No |
| Rollback + roll-forward automation hooks | Yes | No | Limited | Limited |

## Folder Tree

```text
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
		system.ts
	store/
		use-run-store.ts
scripts/
	seed.ts
.env.example
```
