from .base_agent import BaseAgent, AgentOutput


class RiskIntelligenceAgent(BaseAgent):
    name = "Risk Intelligence Agent"

    def summarize(self, finding_count: int, has_malicious: bool, run_id: str) -> AgentOutput:
        return self.emit(
            action=f"SafeDep scan completed with {finding_count} finding(s).",
            confidence=0.9,
            severity="critical" if has_malicious else "low",
            badges=["safedep-cloud", "risk-enrichment"],
            evidence_ref=f"/runs/{run_id}/findings",
        )
