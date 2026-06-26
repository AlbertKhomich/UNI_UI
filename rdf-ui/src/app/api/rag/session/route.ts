import { NextResponse } from "next/server";
import { ensureDemoRagSession } from "@/app/api/rag/_lib";

export async function POST() {
  try {
    const session = await ensureDemoRagSession();
    return NextResponse.json({ id: session.id });
  } catch (error: unknown) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to create RAG session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

