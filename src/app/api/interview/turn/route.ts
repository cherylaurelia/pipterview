import { interviewerTurn } from "@/lib/claude";
import { TurnRequestSchema } from "@/lib/interview/schemas";
import { streamTurn } from "@/lib/server/ndjson";

/** Takes the transcript ending in the candidate's answer and streams the interviewer's reply. */
export async function POST(request: Request) {
  const body = TurnRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { state, transcript } = body.data;
  if (state.phase === "done") {
    return Response.json({ error: "This interview is already over." }, { status: 409 });
  }
  if (transcript.at(-1)?.role !== "candidate") {
    return Response.json({ error: "The transcript must end with the candidate's answer." }, { status: 400 });
  }
  return streamTurn((onSay) => interviewerTurn(state, transcript, onSay, request.signal), "interview/turn");
}
