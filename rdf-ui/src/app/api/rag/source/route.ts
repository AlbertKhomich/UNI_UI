import { NextResponse } from "next/server";
import { ragUrl, requireRagSessionForRequest } from "@/app/api/rag/_lib";

function safeFilename(input: string): string {
  const base = input.trim() || "highlighted.pdf";
  const pdfName = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  return pdfName.replace(/[^\w .()!-]+/g, "_");
}

export async function GET(request: Request) {
  try {
    const session = await requireRagSessionForRequest();
    const url = new URL(request.url);
    const chunkId = url.searchParams.get("chunkId")?.trim() ?? "";
    const filename = safeFilename(url.searchParams.get("filename") ?? "highlighted.pdf");

    if (!chunkId) {
      return NextResponse.json({ error: "Missing chunkId." }, { status: 400 });
    }

    const response = await fetch(
      ragUrl(`/sessions/${encodeURIComponent(session.id)}/chunks/${encodeURIComponent(chunkId)}/highlight`),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download highlighted source (HTTP ${response.status}).` },
        { status: response.status },
      );
    }

    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Type": response.headers.get("content-type") ?? "application/pdf",
      },
    });
  } catch (error: unknown) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to download highlighted source";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
