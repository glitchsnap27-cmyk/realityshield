from .base_agent import BaseAgent, AgentOutput


class PatchExecutorAgent(BaseAgent):
    name = "Patch Executor Agent"

    def apply(self, strategy: str, reason: str, success: bool) -> AgentOutput:
        return self.emit(
            action=f"Applied remediation strategy {strategy}. {reason}",
            confidence=0.88 if success else 0.63,
            severity="medium" if success else "high",
            badges=["patch-engine", "lockfile-updater"],
        )
