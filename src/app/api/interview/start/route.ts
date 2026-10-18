import { interviewerTurn, startSession } from "@/lib/claude";
import { StartRequestSchema } from "@/lib/interview/schemas";
import { streamTurn } from "@/lib/server/ndjson";

/** Creates a session (tailored when a resume or job description is given) and streams the opening line. */
export async function POST(request: Request) {
  const body = StartRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { typeId, settings, profile, avoid } = body.data;
  return streamTurn(
    async (onSay) => interviewerTurn(await startSession(typeId, settings, profile, avoid), [], onSay, request.signal),
    "interview/start",
  );
}
