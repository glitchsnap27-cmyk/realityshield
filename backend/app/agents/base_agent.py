from dataclasses import dataclass
from typing import Literal, Optional


Severity = Literal["low", "medium", "high", "critical"]


@dataclass
class AgentOutput:
    action: str
    confidence: float = 0.9
    severity: Severity = "medium"
    badges: list[str] | None = None
    evidence_ref: Optional[str] = None


class BaseAgent:
    name: str

    def emit(
        self,
        action: str,
        confidence: float = 0.9,
        severity: Severity = "medium",
        badges: list[str] | None = None,
        evidence_ref: Optional[str] = None,
    ) -> AgentOutput:
        return AgentOutput(
            action=action,
            confidence=confidence,
            severity=severity,
            badges=badges or [],
            evidence_ref=evidence_ref,
        )
