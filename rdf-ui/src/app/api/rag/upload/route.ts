import { NextResponse } from "next/server";
import { ensureDemoRagSession, proxyRagResponse, ragUrl } from "@/app/api/rag/_lib";

export async function POST(request: Request) {
  try {
    const incoming = await request.formData();
    const files = incoming.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "Choose at least one document to upload." }, { status: 400 });
    }

    const session = await ensureDemoRagSession();
    const form = new FormData();
    for (const file of files) form.append("files", file, file.name);

    const response = await fetch(ragUrl(`/sessions/${encodeURIComponent(session.id)}/documents`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      body: form,
    });

    const proxied = await proxyRagResponse(response, "Failed to upload document");
    proxied.headers.set("x-rag-session-id", session.id);
    return proxied;
  } catch (error: unknown) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to upload document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

