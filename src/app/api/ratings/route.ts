import { RatingSchema, saveRating, summarizeRatings } from "@/lib/ratings";

/** Records one question-quality rating. */
export async function POST(request: Request) {
  const body = RatingSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid rating." }, { status: 400 });
  }
  try {
    await saveRating(body.data);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("ratings: save failed", error);
    return Response.json({ error: "Ratings can't be saved on this server." }, { status: 503 });
  }
}

/** Aggregated ratings per question, for the /review page. */
export async function GET() {
  return Response.json({ questions: await summarizeRatings() });
}
