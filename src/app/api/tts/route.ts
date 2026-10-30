import { z } from "zod";
import { rateLimited } from "@/lib/server/rate-limit";

/**
 * A natural voice for the interviewer via ElevenLabs. Set ELEVENLABS_API_KEY to turn it on; otherwise the browser's
 * built-in voice is used. Optional: ELEVENLABS_VOICE_ID (pick a warm, friendly voice for Pip in the ElevenLabs voice
 * library), ELEVENLABS_MODEL_ID, and ELEVENLABS_SPEED.
 *
 * The client sends one sentence at a time (so speech starts before the reply has finished streaming) along with the
 * sentence before it, which ElevenLabs uses to keep the intonation flowing across sentences.
 */
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5"; // the low-latency model
const SPEED = Number(process.env.ELEVENLABS_SPEED ?? "1");

// Warm and a little expressive (lower stability), still clearly the same voice. Style exaggeration stays off: it adds latency.
const VOICE_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: Number.isFinite(SPEED) ? SPEED : 1 };

export async function GET() {
  return Response.json({ available: Boolean(process.env.ELEVENLABS_API_KEY) });
}

const BodySchema = z.object({
  text: z.string().min(1).max(1500),
  previousText: z.string().max(1500).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimited(request, "tts");
  if (limited) return limited;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ error: "No ELEVENLABS_API_KEY set." }, { status: 404 });
  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request body." }, { status: 400 });

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text: body.data.text,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
      ...(body.data.previousText ? { previous_text: body.data.previousText } : {}),
    }),
    signal: request.signal, // the candidate interrupted: stop paying for audio nobody will hear
  });
  if (!upstream.ok || !upstream.body) {
    console.error("tts: ElevenLabs returned", upstream.status, await upstream.text().catch(() => ""));
    return Response.json({ error: `Voice service error (${upstream.status}).` }, { status: 502 });
  }
  return new Response(upstream.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
