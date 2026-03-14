"use client";

import { useEffect, useMemo } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Progress,
  Snippet,
  Spinner,
  Tooltip,
} from "@heroui/react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  GitBranch,
  RefreshCcw,
  RotateCcw,
  Shield,
  Sparkles,
} from "lucide-react";
import { useRunStore } from "@/store/use-run-store";
import { GridAura } from "@/components/magic-ui/grid-aura";
import { TimelineReveal } from "@/components/magic-ui/timeline-reveal";

function statusTone(status?: string) {
  if (status === "merge-ready") return "success" as const;
  if (status === "exception") return "warning" as const;
  if (status === "blocked") return "danger" as const;
  return "default" as const;
}

export function CommandCenter() {
  const {
    runs,
    metrics,
    timeline,
    selectedRunId,
    loading,
    error,
    bootstrap,
    selectRun,
    startScenario,
    retryRun,
    rollbackRun,
  } = useRunStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || runs[0],
    [runs, selectedRunId],
  );

  const blast = selectedRun?.simulationResult;
  const proofPackHref = selectedRun ? `/api/runs/${selectedRun.id}/proof-pack` : "#";

  return (
    <div className="relative mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-900/20 sm:p-8">
        <GridAura />
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Its handled</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl">
                RealityShield Autopilot
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200 sm:text-base">
                Autonomous PR security operator from webhook to merge-ready proof.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button color="primary" variant="shadow" onPress={() => void startScenario("malicious-retry")}>Run malicious retry</Button>
              <Button color="success" variant="flat" onPress={() => void startScenario("clean-pass")}>Run clean pass</Button>
              <Button color="warning" variant="flat" onPress={() => void startScenario("low-confidence")}>Run low confidence</Button>
            </div>
          </div>

          {metrics ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card className="bg-white/5">
                <CardBody>
                  <p className="text-xs text-slate-300">Auto-resolved rate</p>
                  <p className="text-xl font-bold text-emerald-300">{metrics.autoResolvedRate}%</p>
                </CardBody>
              </Card>
              <Card className="bg-white/5">
                <CardBody>
                  <p className="text-xs text-slate-300">Mean remediation</p>
                  <p className="text-xl font-bold text-cyan-300">{metrics.meanRemediationMs} ms</p>
                </CardBody>
              </Card>
              <Card className="bg-white/5">
                <CardBody>
                  <p className="text-xs text-slate-300">Critical blocked</p>
                  <p className="text-xl font-bold text-rose-300">{metrics.criticalBlocked}</p>
                </CardBody>
              </Card>
              <Card className="bg-white/5">
                <CardBody>
                  <p className="text-xs text-slate-300">Simulation regressions prevented</p>
                  <p className="text-xl font-bold text-violet-300">{metrics.simulationRegressionPrevented}</p>
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      </section>

      {loading && runs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-12 text-center text-slate-100">
          <Spinner color="primary" />
          <p className="mt-4">Bootstrapping seeded scenarios and orchestration memory...</p>
        </div>
      ) : null}

      {error ? (
        <Card className="border border-rose-500/40 bg-rose-900/20">
          <CardBody className="flex items-center gap-2 text-rose-100">
            <AlertTriangle className="h-4 w-4" />
            <p>{error}</p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border border-white/10 bg-slate-950/70">
          <CardHeader className="flex justify-between">
            <div className="flex items-center gap-2 text-white">
              <Activity className="h-4 w-4 text-cyan-300" />
              Live Incident Timeline
            </div>
            <Chip size="sm" variant="flat" color="primary">
              {timeline.length} events
            </Chip>
          </CardHeader>
          <Divider className="bg-white/10" />
          <CardBody className="max-h-[420px] space-y-3 overflow-auto">
            {timeline.map((event, index) => (
              <TimelineReveal key={event.id} index={index}>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Chip size="sm" color={event.severity === "critical" ? "danger" : event.severity === "high" ? "warning" : "default"}>
                        {event.stage}
                      </Chip>
                      <p className="text-xs text-slate-200">{event.agent}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-100">{event.action}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {event.toolBadges.map((badge) => (
                      <Chip key={`${event.id}-${badge}`} size="sm" variant="bordered">
                        {badge}
                      </Chip>
                    ))}
                    <Chip size="sm" variant="flat" color="secondary">conf {Math.round(event.confidence * 100)}%</Chip>
                  </div>
                </div>
              </TimelineReveal>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card className="border border-white/10 bg-slate-950/70">
            <CardHeader className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-emerald-300" />
                Run Picker
              </div>
              <Chip size="sm">{runs.length} runs</Chip>
            </CardHeader>
            <Divider className="bg-white/10" />
            <CardBody className="space-y-2">
              {runs.map((run) => (
                <button
                  key={run.id}
                  className={`w-full rounded-xl border p-3 text-left transition ${run.id === selectedRun?.id ? "border-cyan-300 bg-cyan-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                  onClick={() => void selectRun(run.id)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-100">{run.repo} #{run.prNumber}</p>
                    <Chip size="sm" color={statusTone(run.finalDecision?.status)}>
                      {run.finalDecision?.status || run.status}
                    </Chip>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">{run.scenario} | retries: {run.telemetry.retries}</p>
                </button>
              ))}
            </CardBody>
          </Card>

          <Card className="border border-white/10 bg-slate-950/70">
            <CardHeader className="text-white">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-300" />
                Merge Readiness Card
              </div>
            </CardHeader>
            <Divider className="bg-white/10" />
            <CardBody className="space-y-3">
              {selectedRun ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Chip color={selectedRun.dependencyFindings.some((f) => f.malicious) ? "warning" : "success"} variant="flat">Security {selectedRun.finalDecision?.status === "merge-ready" ? "Pass" : "Review"}</Chip>
                    <Chip color={selectedRun.verificationResult?.passed ? "success" : "danger"} variant="flat">Tests {selectedRun.verificationResult?.passed ? "Pass" : "Fail"}</Chip>
                    <Chip color={selectedRun.policyActionPlans.length > 0 ? "warning" : "success"} variant="flat">Policy {selectedRun.finalDecision?.status === "merge-ready" ? "Pass" : "Actioned"}</Chip>
                    <Chip color={selectedRun.simulationResult?.passed ? "success" : "danger"} variant="flat">Simulation {selectedRun.simulationResult?.passed ? "Pass" : "Fail"}</Chip>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-slate-300">PR Ready</p>
                    <p className="mt-1 text-lg font-bold text-white">{selectedRun.finalDecision?.status === "merge-ready" ? "YES" : "NO"}</p>
                    <Progress
                      className="mt-2"
                      value={(selectedRun.finalDecision?.confidence || 0) * 100}
                      color={statusTone(selectedRun.finalDecision?.status)}
                      label={`confidence ${Math.round((selectedRun.finalDecision?.confidence || 0) * 100)}%`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" color="primary" startContent={<RefreshCcw className="h-3.5 w-3.5" />} onPress={() => void retryRun(selectedRun.id)}>
                      Retry
                    </Button>
                    <Button size="sm" color="warning" variant="flat" startContent={<RotateCcw className="h-3.5 w-3.5" />} onPress={() => void rollbackRun(selectedRun.id)}>
                      Rollback
                    </Button>
                    <Button as="a" href={proofPackHref} target="_blank" rel="noreferrer" size="sm" color="success" variant="flat" startContent={<Download className="h-3.5 w-3.5" />}>
                      Proof pack
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-300">No runs yet.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-white/10 bg-slate-950/70">
          <CardHeader className="text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
              Risk Diff Panel
            </div>
          </CardHeader>
          <Divider className="bg-white/10" />
          <CardBody className="space-y-3">
            {selectedRun?.dependencyFindings.map((finding) => (
              <div key={`${finding.packageName}-${finding.version}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{finding.packageName}@{finding.version}</p>
                  <Chip color={finding.severity === "critical" ? "danger" : "warning"} size="sm">{finding.severity}</Chip>
                </div>
                <p className="mt-1 text-sm text-slate-300">{finding.reason}</p>
                <p className="mt-2 text-sm text-emerald-300">
                  Safe replacement: {finding.safeReplacement || "None"} ({finding.compatibilityScore || 0}% compatible)
                </p>
                <Snippet symbol="" className="mt-2 bg-slate-900/90 text-xs text-slate-100">
                  npm uninstall {finding.packageName} && npm install {finding.safeReplacement || finding.packageName}
                </Snippet>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="border border-white/10 bg-slate-950/70">
          <CardHeader className="text-white">Blast Radius Map</CardHeader>
          <Divider className="bg-white/10" />
          <CardBody className="space-y-3">
            {blast?.journeys.map((journey) => (
              <div key={journey.journey} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold text-slate-100">{journey.journey}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <p>Before impact: {journey.beforeImpact}</p>
                  <p>After impact: {journey.afterImpact}</p>
                </div>
                <Progress
                  className="mt-2"
                  size="sm"
                  value={Math.max(0, 100 - journey.afterImpact)}
                  color={journey.afterImpact < journey.beforeImpact ? "success" : "warning"}
                />
              </div>
            ))}
            {blast ? (
              <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-100">
                Projected business impact delta: <b>{blast.businessImpactDelta}</b>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-white/10 bg-slate-950/70">
          <CardHeader className="text-white">Autonomous Action Log</CardHeader>
          <Divider className="bg-white/10" />
          <CardBody className="space-y-2 text-sm text-slate-200">
            {selectedRun?.trace.slice(-6).map((event) => (
              <div key={event.id} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <div>
                  <p>{event.action}</p>
                  <p className="text-xs text-slate-400">{event.evidenceRef || "evidence linked in proof pack"}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="border border-white/10 bg-slate-950/70">
          <CardHeader className="text-white">Exception Queue</CardHeader>
          <Divider className="bg-white/10" />
          <CardBody className="space-y-3 text-sm">
            {runs
              .filter((run) => run.finalDecision?.status === "exception")
              .map((run) => (
                <div key={run.id} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100">
                  <p className="font-semibold">Run {run.id.slice(0, 8)} needs human review</p>
                  <p className="mt-1 text-xs">{run.finalDecision?.rationale}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    {run.finalDecision?.topOptions?.slice(0, 2).map((option) => (
                      <p key={option.option}>• {option.option} ({Math.round(option.predictedSuccess * 100)}% success)</p>
                    ))}
                  </div>
                </div>
              ))}
            {runs.filter((run) => run.finalDecision?.status === "exception").length === 0 ? (
              <Tooltip content="Confidence gate keeps queue clean.">
                <p className="text-slate-300">No exceptions. Autonomous closure is active.</p>
              </Tooltip>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
