import { MOCK_ENABLED } from "@/lib/mock";
import { nativeRunnerEnabled } from "@/lib/server/native-runner";

/**
 * What the server is set up to use, so you can check your .env.local took effect: the AI interviewer (live Claude,
 * the scripted mock, or missing a key), the voice (ElevenLabs or the browser's own), and whether it will run Java,
 * C++ and C (the code editor only offers them if so). Never returns the keys.
 */
export async function GET() {
  const ai = MOCK_ENABLED ? "mock" : process.env.ANTHROPIC_API_KEY ? "live" : "missing-key";
  const voice = process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "browser";
  return Response.json({ ai, voice, nativeRunner: nativeRunnerEnabled() });
}
