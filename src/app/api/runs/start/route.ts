import { NextResponse } from "next/server";
import { seedScenarioRuns, startRun } from "@/lib/system";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const run = await startRun(body);
    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start run" },
      { status: 400 },
    );
  }
}

export async function GET() {
  const seeded = await seedScenarioRuns();
  return NextResponse.json({ seeded: seeded.length });
}
