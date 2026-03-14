from .base_agent import BaseAgent, AgentOutput


class VerificationAgent(BaseAgent):
    name = "Verification Agent"

    def check(self, passed: bool) -> AgentOutput:
        return self.emit(
            action="Verification suite passed." if passed else "Verification failed, preparing next strategy.",
            confidence=0.9 if passed else 0.59,
            severity="low" if passed else "high",
            badges=["codebuild", "test-suite"],
        )
