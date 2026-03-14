import { NextResponse } from "next/server";
import { getTimeline } from "@/lib/system";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  return NextResponse.json({ timeline: getTimeline(params.id) });
}
