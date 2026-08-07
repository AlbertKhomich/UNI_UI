import { NextResponse } from "next/server";
import { ensureRagSessionForRequest, resetUserRagSession } from "@/app/api/rag/_lib";

export async function POST() {
  try {
    await ensureRagSessionForRequest();
    return NextResponse.json({ ready: true });
  } catch (error: unknown) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to create RAG session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await resetUserRagSession();
    return NextResponse.json({ ready: true });
  } catch (error: unknown) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to clear attachments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
