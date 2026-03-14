from .base_agent import BaseAgent, AgentOutput


class EvidenceProofAgent(BaseAgent):
    name = "Evidence and Proof Agent"

    def generate(self, run_id: str) -> AgentOutput:
        return self.emit(
            action="Merge Readiness Proof Pack generated and signed.",
            confidence=0.99,
            severity="low",
            badges=["aws-s3", "proof-pack"],
            evidence_ref=f"/api/runs/{run_id}/proof-pack",
        )
