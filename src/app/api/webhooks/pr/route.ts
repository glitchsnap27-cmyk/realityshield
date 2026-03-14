import crypto from "crypto";
import { NextResponse } from "next/server";
import { processWebhook } from "@/lib/system";

const acceptedPullRequestActions = new Set([
  "opened",
  "synchronize",
  "reopened",
  "ready_for_review",
]);

function safeSignatureMatch(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function inferScenario(labels: Array<{ name?: string }> | undefined) {
  const names = (labels || []).map((label) => (label.name || "").toLowerCase());
  if (names.includes("shield:clean-pass")) return "clean-pass";
  if (names.includes("shield:low-confidence")) return "low-confidence";
  return "malicious-retry";
}

export async function POST(req: Request) {
  try {
    const eventType = req.headers.get("x-github-event");
    const deliveryId = req.headers.get("x-github-delivery");
    const signature = req.headers.get("x-hub-signature-256");
    const rawBody = await req.text();

    if (!eventType || !deliveryId) {
      return NextResponse.json(
        { error: "Missing GitHub delivery metadata headers" },
        { status: 400 },
      );
    }

    if (eventType === "ping") {
      return NextResponse.json({ ok: true, deliveryId, eventType }, { status: 200 });
    }

    if (eventType !== "pull_request") {
      return NextResponse.json(
        { ignored: true, reason: `Unsupported event type: ${eventType}` },
        { status: 202 },
      );
    }

    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Server missing GITHUB_WEBHOOK_SECRET configuration" },
        { status: 500 },
      );
    }

    if (!signature) {
      return NextResponse.json(
        { error: "Missing x-hub-signature-256 header" },
        { status: 401 },
      );
    }

    const computedSignature = `sha256=${crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody, "utf8")
      .digest("hex")}`;

    if (!safeSignatureMatch(computedSignature, signature)) {
      return NextResponse.json({ error: "Invalid GitHub webhook signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as {
      action?: string;
      number?: number;
      pull_request?: {
        head?: { ref?: string };
        base?: { ref?: string };
        merged?: boolean;
        draft?: boolean;
        labels?: Array<{ name?: string }>;
      };
      repository?: { full_name?: string };
    };

    if (!payload.action || !acceptedPullRequestActions.has(payload.action)) {
      return NextResponse.json(
        { ignored: true, reason: `Unsupported pull_request action: ${payload.action || "unknown"}` },
        { status: 202 },
      );
    }

    if (payload.pull_request?.draft) {
      return NextResponse.json(
        { ignored: true, reason: "Draft pull request" },
        { status: 202 },
      );
    }

    const repo = payload.repository?.full_name;
    const branch = payload.pull_request?.head?.ref || payload.pull_request?.base?.ref;
    const prNumber = payload.number;

    if (!repo || !branch || typeof prNumber !== "number") {
      return NextResponse.json(
        { error: "Missing required pull request fields in webhook payload" },
        { status: 400 },
      );
    }

    const mode = process.env.APP_MODE === "real" ? "real" : "mock";
    const scenario = inferScenario(payload.pull_request?.labels);

    const result = await processWebhook({
      eventId: deliveryId,
      repo,
      branch,
      prNumber,
      mode,
      scenario,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook payload" },
      { status: 400 },
    );
  }
}
