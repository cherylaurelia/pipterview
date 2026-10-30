import { MOCK_ENABLED } from "@/lib/mock";

/**
 * What the server is set up to use, so you can check your .env.local took effect: the AI interviewer (live Claude,
 * the scripted mock, or missing a key) and the voice (ElevenLabs or the browser's own). Never returns the keys.
 */
export async function GET() {
  const ai = MOCK_ENABLED ? "mock" : process.env.ANTHROPIC_API_KEY ? "live" : "missing-key";
  const voice = process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "browser";
  return Response.json({ ai, voice });
}
