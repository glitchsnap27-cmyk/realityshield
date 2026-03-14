from langchain_core.runnables import RunnableLambda

from .base_agent import BaseAgent, AgentOutput


class PolicyCompilerAgent(BaseAgent):
    name = "Policy Compiler Agent"

    def compile_summary(self, violations: int) -> AgentOutput:
        # RunnableLambda keeps the policy text path LangChain-native while deterministic.
        chain = RunnableLambda(lambda n: f"Policy compiler produced {n} executable remediation playbook(s).")
        message = chain.invoke(violations)
        return self.emit(
            action=message,
            confidence=0.84,
            severity="medium",
            badges=["langchain", "policy-compiler"],
        )
