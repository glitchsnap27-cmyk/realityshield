import { NextResponse } from "next/server";
import { getProofPack } from "@/lib/system";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const proofPack = getProofPack(params.id);
  if (!proofPack) {
    return NextResponse.json({ error: "Proof pack not found" }, { status: 404 });
  }
  return NextResponse.json(proofPack, {
    headers: {
      "Content-Disposition": `attachment; filename=proof-pack-${params.id}.json`,
    },
  });
}
