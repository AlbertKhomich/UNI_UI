import { NextResponse } from "next/server";
import { toErrorMessage } from "@/lib/errors";
import { canonicalizeUpbkgIri } from "@/lib/query";
import { parseDescribeBodyWithN3 } from "@/lib/rdf";
import { sparqlDescribe } from "@/lib/sparql";

function parseDescribeIri(raw: string): string | null {
  const iri = canonicalizeUpbkgIri(raw);
  if (!iri) return null;

  try {
    const parsed = new URL(iri);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawIri = (url.searchParams.get("iri") ?? url.searchParams.get("uri") ?? "").trim();
    const iri = parseDescribeIri(rawIri);
    if (!iri) return NextResponse.json({ error: "Missing or invalid iri" }, { status: 400 });

    const query = `DESCRIBE <${iri}>`;
    const payload = await sparqlDescribe(query);
    const parsed = parseDescribeBodyWithN3(payload.body, payload.contentType);
    return NextResponse.json({
      iri,
      contentType: payload.contentType,
      body: payload.body,
      ...(parsed
        ? {
            quads: parsed.quads,
            prefixes: parsed.prefixes,
            parseError: parsed.parseError,
          }
        : {}),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}
