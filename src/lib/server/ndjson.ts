import { describeApiError, type TurnResult } from "../claude";

/**
 * Streams an interviewer turn as newline-delimited JSON:
 *   {"type":"say","text":"…"}      (repeated, as the spoken line is generated)
 *   {"type":"done","state":…,"entry":…}
 *   {"type":"error","error":"…"}
 */
export function streamTurn(run: (onSay: (text: string) => void) => Promise<TurnResult>, label: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The client disconnected; nothing to send to.
        }
      };
      try {
        const result = await run((text) => send({ type: "say", text }));
        send({ type: "done", ...result });
      } catch (error) {
        console.error(`${label} failed`, error);
        send({ type: "error", error: describeApiError(error).message });
      }
      try {
        controller.close();
      } catch {
        // Already closed because the client disconnected.
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
