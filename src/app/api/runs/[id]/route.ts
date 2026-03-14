import { NextResponse } from "next/server";
import { getRun } from "@/lib/system";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const run = getRun(params.id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json(run);
}
