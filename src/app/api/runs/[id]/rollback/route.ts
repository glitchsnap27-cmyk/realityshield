import { NextResponse } from "next/server";
import { rollbackRun } from "@/lib/system";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const rollback = rollbackRun(params.id);
  if (!rollback) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json(rollback);
}
