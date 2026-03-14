from typing import Any, TypedDict

from langgraph.graph import END, StateGraph


class AICycleState(TypedDict):
    run_id: str
    scenario: str
    steps: list[str]


def _append(step: str):
    def _fn(state: AICycleState) -> AICycleState:
        state["steps"].append(step)
        return state

    return _fn


def run_ai_cycle_graph(run_id: str, scenario: str) -> list[str]:
    graph = StateGraph(AICycleState)
    graph.add_node("plan", _append("Plan"))
    graph.add_node("observe", _append("Observe"))
    graph.add_node("decide", _append("Decide"))
    graph.add_node("act", _append("Act"))
    graph.add_node("verify", _append("Verify"))
    graph.add_node("simulate", _append("Simulate"))
    graph.add_node("learn", _append("Learn"))
    graph.add_node("improve", _append("Improve next attempt"))

    graph.set_entry_point("plan")
    graph.add_edge("plan", "observe")
    graph.add_edge("observe", "decide")
    graph.add_edge("decide", "act")
    graph.add_edge("act", "verify")
    graph.add_edge("verify", "simulate")
    graph.add_edge("simulate", "learn")
    graph.add_edge("learn", "improve")
    graph.add_edge("improve", END)

    app = graph.compile()
    result: Any = app.invoke({"run_id": run_id, "scenario": scenario, "steps": []})
    return result.get("steps", [])
