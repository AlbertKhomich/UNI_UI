import { NextResponse } from "next/server";
import { proxyRagResponse, ragUrl, requireRagSessionForRequest } from "@/app/api/rag/_lib";

export async function GET() {
  try {
    const session = await requireRagSessionForRequest();
    const response = await fetch(ragUrl(`/sessions/${encodeURIComponent(session.id)}/documents`), {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    return proxyRagResponse(response, "Failed to load document status");
  } catch (error: unknown) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to load document status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
