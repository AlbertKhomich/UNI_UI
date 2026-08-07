import { NextResponse } from "next/server";
import { ensureUserRagSession, proxyRagResponse, ragUrl } from "@/app/api/rag/_lib";

export async function POST(request: Request) {
  try {
    const session = await ensureUserRagSession();
    const incoming = await request.formData();
    const files = incoming.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "Choose at least one document to upload." }, { status: 400 });
    }

    const form = new FormData();
    for (const file of files) form.append("files", file, file.name);

    const response = await fetch(ragUrl(`/sessions/${encodeURIComponent(session.id)}/documents`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      body: form,
    });

    return proxyRagResponse(response, "Failed to upload document");
  } catch (error: unknown) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to upload document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
