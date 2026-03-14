"use client";

import { create } from "zustand";
import { backendPath } from "@/lib/backend-url";
import type { Run, StageEvent } from "@/types/run";

type Metrics = {
  totalRuns: number;
  autoResolvedRate: number;
  meanRemediationMs: number;
  criticalBlocked: number;
  simulationRegressionPrevented: number;
  activeAgents: string[];
};

type RunState = {
  runs: Run[];
  selectedRunId?: string;
  timeline: StageEvent[];
  metrics?: Metrics;
  loading: boolean;
  error?: string;
  bootstrap: () => Promise<void>;
  startScenario: (scenario: Run["scenario"]) => Promise<void>;
  selectRun: (id: string) => Promise<void>;
  retryRun: (id: string) => Promise<void>;
  rollbackRun: (id: string) => Promise<void>;
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(backendPath(url), init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const useRunStore = create<RunState>((set, get) => ({
  runs: [],
  timeline: [],
  loading: false,
  async bootstrap() {
    set({ loading: true, error: undefined });
    try {
      const scenarios: Run["scenario"][] = ["malicious-retry", "clean-pass", "low-confidence"];
      const seededRuns = await Promise.all(
        scenarios.map((scenario, idx) =>
          json<Run>("/api/runs/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario, mode: "mock", prNumber: 1000 + idx }),
          }),
        ),
      );

      const metrics = await json<Metrics>("/api/metrics/summary");
      const selectedRunId = seededRuns[0]?.id;
      const timelineRes = selectedRunId
        ? await json<{ timeline: StageEvent[] }>(`/api/runs/${selectedRunId}/timeline`)
        : { timeline: [] };

      set({ runs: seededRuns, selectedRunId, timeline: timelineRes.timeline, metrics, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to initialize dashboard",
      });
    }
  },
  async startScenario(scenario) {
    set({ loading: true, error: undefined });
    try {
      const run = await json<Run>("/api/runs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, mode: "mock", prNumber: Math.floor(Math.random() * 8000) + 2000 }),
      });
      const metrics = await json<Metrics>("/api/metrics/summary");
      const timelineRes = await json<{ timeline: StageEvent[] }>(`/api/runs/${run.id}/timeline`);
      set((state) => ({
        runs: [run, ...state.runs],
        selectedRunId: run.id,
        timeline: timelineRes.timeline,
        metrics,
        loading: false,
      }));
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : "Unable to start run" });
    }
  },
  async selectRun(id) {
    try {
      const run = await json<Run>(`/api/runs/${id}`);
      const timelineRes = await json<{ timeline: StageEvent[] }>(`/api/runs/${id}/timeline`);
      set((state) => ({
        selectedRunId: id,
        timeline: timelineRes.timeline,
        runs: state.runs.map((r) => (r.id === id ? run : r)),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Unable to load run" });
    }
  },
  async retryRun(id) {
    const run = await json<Run>(`/api/runs/${id}/retry`, { method: "POST" });
    const metrics = await json<Metrics>("/api/metrics/summary");
    set((state) => ({ runs: [run, ...state.runs], selectedRunId: run.id, metrics }));
    await get().selectRun(run.id);
  },
  async rollbackRun(id) {
    await json(`/api/runs/${id}/rollback`, { method: "POST" });
    await get().selectRun(id);
  },
}));
