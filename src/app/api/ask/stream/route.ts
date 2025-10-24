import { NextRequest } from "next/server";
import { askStream } from "@/lib/ai";

export const runtime = "nodejs"; // evitar Edge para SSE

export async function GET(req: NextRequest) {
  const q = String(req.nextUrl.searchParams.get("q") || "");
  const prevId = req.nextUrl.searchParams.get("prev") || req.nextUrl.searchParams.get("prev_id") || undefined;
  const tzParam = req.nextUrl.searchParams.get("tz") || undefined;
  // Aceitar history compactado por query, com sanitização
  const hParam = req.nextUrl.searchParams.get("h");
  let history: Array<{ role: "user" | "assistant" | "system" | "developer"; content: string }> | undefined;
  try {
    history = hParam ? JSON.parse(hParam) : undefined;
  } catch {
    history = undefined;
  }
  if (history) {
    const MAX_ITEMS = 10;
    const MAX_CHARS = 600;
    history = history.slice(-MAX_ITEMS).map(m => ({
      role: m.role,
      content: String(m.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS)
    }));
  }
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const event of askStream(q, { previousResponseId: prevId, history, timeZone: tzParam })) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      // emitir "done" para o cliente fechar limpo
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}


