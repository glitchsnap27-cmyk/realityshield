from .base_agent import BaseAgent, AgentOutput


class RemediationPlannerAgent(BaseAgent):
    name = "Remediation Planner Agent"

    def rank(self, strategy: str, attempt: int) -> AgentOutput:
        return self.emit(
            action=f"Generated strategy {strategy} with ranking position {attempt}.",
            confidence=0.81,
            severity="medium",
            badges=["learning-memory", "multi-strategy"],
        )
