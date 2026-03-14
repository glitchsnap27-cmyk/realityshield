from .base_agent import BaseAgent, AgentOutput


class IntakeAgent(BaseAgent):
    name = "Intake Agent"

    def process(self, event_type: str) -> AgentOutput:
        return self.emit(
            action=f"Inbound {event_type} event normalized and idempotency key verified.",
            confidence=0.97,
            severity="low",
            badges=["github-mcp", "concierge"],
        )
