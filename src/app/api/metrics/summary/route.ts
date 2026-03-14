import { NextResponse } from "next/server";
import { metricsSummary } from "@/lib/system";

export async function GET() {
  return NextResponse.json(metricsSummary());
}
