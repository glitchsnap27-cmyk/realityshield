from .base_agent import BaseAgent, AgentOutput


class ExceptionRouterAgent(BaseAgent):
    name = "Exception Router Agent"

    def route(self) -> AgentOutput:
        return self.emit(
            action="Confidence-gated escalation triggered with top two options.",
            confidence=0.91,
            severity="high",
            badges=["jira-mcp", "slack-mcp", "linear-mcp"],
        )
