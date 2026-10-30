import { z } from "zod";

/**
 * Optional natural-sounding voice for the interviewer via ElevenLabs. Set
 * ELEVENLABS_API_KEY (and optionally ELEVENLABS_VOICE_ID) to turn it on;
 * otherwise the browser's built-in voice is used.
 */
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5";

export async function GET() {
  return Response.json({ available: Boolean(process.env.ELEVENLABS_API_KEY) });
}

const BodySchema = z.object({ text: z.string().min(1).max(1500) });

export async function POST(request: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: "No ELEVENLABS_API_KEY set." }, { status: 404 });
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request body." }, { status: 400 });

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: body.data.text, model_id: MODEL_ID }),
  });
  if (!upstream.ok || !upstream.body) {
    console.error("tts: ElevenLabs returned", upstream.status, await upstream.text().catch(() => ""));
    return Response.json({ error: `Voice service error (${upstream.status}).` }, { status: 502 });
  }
  return new Response(upstream.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
