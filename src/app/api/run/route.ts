import { z } from "zod";
import { CodingSpecSchema } from "@/lib/interview/schemas";
import { nativeRunnerEnabled, runNative } from "@/lib/server/native-runner";
import type { CodingSpec } from "@/lib/workspace/types";

const RunRequestSchema = z.object({
  language: z.enum(["java", "cpp", "c"]),
  code: z.string().max(50_000),
  spec: CodingSpecSchema.optional(),
});

/** Compiles and runs Java, C++, or C for the code editor. Python, JavaScript, and TypeScript run in the browser instead. */
export async function POST(request: Request) {
  if (!nativeRunnerEnabled()) {
    return Response.json(
      { error: "Java, C++, and C need the local code runner, which is off in production. Use Python, JavaScript, or TypeScript." },
      { status: 503 },
    );
  }
  const body = RunRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request body." }, { status: 400 });
  const { language, code, spec } = body.data;
  return Response.json(await runNative(language, code, spec as CodingSpec | undefined));
}
