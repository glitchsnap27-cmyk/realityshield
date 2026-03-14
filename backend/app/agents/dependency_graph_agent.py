from .base_agent import BaseAgent, AgentOutput


class DependencyGraphAgent(BaseAgent):
    name = "Dependency Graph Agent"

    def process(self) -> AgentOutput:
        return self.emit(
            action="Dependency and lockfile diff extracted.",
            confidence=0.96,
            severity="medium",
            badges=["lockfile-diff", "sbom"],
        )
