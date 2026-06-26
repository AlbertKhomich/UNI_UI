import { NextResponse } from "next/server";
import { proxyRagResponse, ragUrl, requireDemoRagSession } from "@/app/api/rag/_lib";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json({ error: "Enter a question before asking." }, { status: 400 });
    }

    const session = await requireDemoRagSession();
    const response = await fetch(ragUrl(`/sessions/${encodeURIComponent(session.id)}/queries`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question, uris: [] }),
    });

    return proxyRagResponse(response, "Failed to ask RAG session");
  } catch (error: unknown) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to ask RAG session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
