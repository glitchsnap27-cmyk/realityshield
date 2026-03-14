from .base_agent import BaseAgent, AgentOutput


class BlastRadiusSimulationAgent(BaseAgent):
    name = "Blast-Radius Simulation Agent"

    def evaluate(self, before: int, after: int, passed: bool) -> AgentOutput:
        return self.emit(
            action=f"Synthetic journeys executed. Blast radius {before} -> {after}.",
            confidence=0.89 if passed else 0.52,
            severity="low" if passed else "high",
            badges=["simulation", "business-impact"],
        )
