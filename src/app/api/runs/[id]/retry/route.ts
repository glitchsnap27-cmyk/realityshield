import { NextResponse } from "next/server";
import { retryRun } from "@/lib/system";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const run = await retryRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json(run, { status: 201 });
}
