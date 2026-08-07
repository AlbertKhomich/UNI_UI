import { NextResponse } from "next/server";
import WebSocket from "ws";
import { ragUrl, requireRagSessionForRequest } from "@/app/api/rag/_lib";

export const maxDuration = 600;
export const runtime = "nodejs";

function toWebSocketUrl(path: string): string {
  const url = new URL(ragUrl(path));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function encodeEvent(event: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  try {
    const session = await requireRagSessionForRequest();
    const body = await request.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json({ error: "Enter a question before asking." }, { status: 400 });
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          controller.close();
        };
        const send = (event: unknown) => {
          if (!closed) controller.enqueue(encodeEvent(event));
        };
        const socket = new WebSocket(toWebSocketUrl(`/ws/sessions/${encodeURIComponent(session.id)}/queries`), {
          headers: { Authorization: `Bearer ${session.token}` },
        });

        request.signal.addEventListener("abort", () => {
          socket.close();
          close();
        });

        socket.on("open", () => {
          socket.send(JSON.stringify({ question, uris: [] }));
        });

        socket.on("message", (data) => {
          const text = data.toString();
          try {
            const event = JSON.parse(text);
            send(event);
            if (event?.type === "done") {
              socket.close();
              close();
            }
          } catch {
            send({ type: "token", text });
          }
        });

        socket.on("error", (error) => {
          send({ type: "error", error: error.message || "Failed to ask RAG session" });
          close();
        });

        socket.on("close", close);
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  } catch (error: unknown) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to ask RAG session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
