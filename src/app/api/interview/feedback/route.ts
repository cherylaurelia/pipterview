import { describeApiError, generateFeedback } from "@/lib/claude";
import { FeedbackRequestSchema } from "@/lib/interview/schemas";

/** Scores the finished (or ended-early) interview against its rubric. */
export async function POST(request: Request) {
  const body = FeedbackRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { state, transcript, work } = body.data;
  if (!transcript.some((entry) => entry.role === "candidate")) {
    return Response.json({ error: "Answer at least one question before asking for feedback." }, { status: 400 });
  }

  try {
    return Response.json({ feedback: await generateFeedback(state, transcript, work ?? []) });
  } catch (error) {
    console.error("interview/feedback failed", error);
    const { status, message } = describeApiError(error);
    return Response.json({ error: message }, { status });
  }
}
