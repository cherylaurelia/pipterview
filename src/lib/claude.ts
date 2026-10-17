import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  advance,
  createSession,
  currentQuestion,
  directiveFor,
  pickBankQuestions,
  questionCount,
  stressGuidance,
  type DirectiveContext,
} from "./interview/flow";
import { createSayExtractor } from "./interview/say-stream";
import { CODING_SPECS } from "./interview/coding";
import {
  CALL_STARTED,
  answerWithWorkspace,
  FEEDBACK_SYSTEM_PROMPT,
  FeedbackSchema,
  InterviewerTurnSchema,
  feedbackRequest,
  interviewerSystemPrompt,
  type Feedback,
} from "./interview/prompts";
import {
  TailoringSchema,
  hasTailoringMaterial,
  tailoringRequest,
  tailoringSystemPrompt,
  type Profile,
} from "./interview/tailor";
import type { InterviewTypeId, Question, SessionSettings, SessionState, TranscriptEntry } from "./interview/types";
import type { WorkspaceSnapshot } from "./workspace/types";
import { MOCK_ENABLED, mockFeedback, mockInterviewerTurn, mockTailoring } from "./mock";

// Override with CLAUDE_MODEL in .env.local. Turns need a model that supports
// mid-conversation system messages.
const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
// Interviewer turns are short and latency-sensitive; tailoring and feedback need more care.
const TURN_EFFORT = "low";
const TAILOR_EFFORT = "medium";
const FEEDBACK_EFFORT = "medium";

const BETAS: Anthropic.Beta.AnthropicBeta[] = [
  // fallbacks: "default" retries a safety-classifier decline on another model.
  "server-side-fallback-2026-07-01",
  // Lets each turn's directive show for one turn and then drop out of view.
  "mid-conversation-system-clear-at-2026-08-21",
];

// Created on first use so importing this module (e.g. during `next build`)
// doesn't require credentials.
let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic());

/**
 * Rebuilds the conversation for Claude. Each interviewer line is preceded by
 * the directive that produced it, so the history only ever grows by
 * appending. Directives use clear_at so the model only sees the latest one.
 */
function buildMessages(transcript: TranscriptEntry[], directive: string): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: CALL_STARTED }];
  for (const entry of transcript) {
    if (entry.role === "candidate") {
      messages.push({ role: "user", content: candidateContent(entry) });
    } else {
      if (entry.directive) {
        messages.push({ role: "system", content: entry.directive, clear_at: "next_user_message" });
      }
      messages.push({ role: "assistant", content: entry.text });
    }
  }
  messages.push({ role: "system", content: directive, clear_at: "next_user_message" });
  return messages;
}

/** A candidate answer, plus their code or whiteboard (text, and the diagram as an image) when attached. */
function candidateContent(entry: TranscriptEntry): string | Anthropic.Beta.BetaContentBlockParam[] {
  if (!entry.workspace) return entry.text;
  return withImages(answerWithWorkspace(entry.text, entry.workspace), [entry.workspace]);
}

/** Text plus any whiteboard images, images first. */
function withImages(text: string, work: WorkspaceSnapshot[]): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = work.flatMap((w) =>
    w.kind === "design" && w.image
      ? [{ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: w.image } }]
      : [],
  );
  blocks.push({ type: "text", text });
  return blocks;
}

/** Whether the candidate has shared code for the question currently being asked. */
function codeSharedFor(state: SessionState, transcript: TranscriptEntry[]) {
  const id = currentQuestion(state)?.id;
  return transcript.some((e) => e.workspace?.kind === "code" && e.workspace.questionId === id);
}

export interface TurnResult {
  entry: TranscriptEntry;
  state: SessionState;
}

/**
 * One interviewer turn. Streams: onSay receives the spoken line as it's
 * generated, so the client can start talking on the first sentence.
 */
export async function interviewerTurn(
  state: SessionState,
  transcript: TranscriptEntry[],
  onSay: (text: string) => void = () => {},
): Promise<TurnResult> {
  const last = transcript.at(-1);
  const context: DirectiveContext = {
    codeShared: codeSharedFor(state, transcript),
    stress: last?.role === "candidate" ? last.stressSignals : undefined,
  };
  const adapted = Boolean(stressGuidance(state, context.stress)) && state.settings.intensity !== "realistic";
  if (MOCK_ENABLED) {
    const result = mockInterviewerTurn(state, transcript, context);
    await streamMockSay(result.entry.text, onSay);
    return { ...result, entry: { ...result.entry, ...(adapted ? { adapted } : {}) } };
  }

  const directive = directiveFor(state, context);
  const say = createSayExtractor();
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    betas: BETAS,
    fallbacks: "default",
    cache_control: { type: "ephemeral" },
    output_config: { effort: TURN_EFFORT, format: betaZodOutputFormat(InterviewerTurnSchema) },
    system: interviewerSystemPrompt(state.typeId, state.settings, state.candidate),
    messages: buildMessages(transcript, directive),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const text = say(event.delta.text);
      if (text) onSay(text);
    }
  }
  const response = await stream.finalMessage();

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    // Stay on the same step and let the candidate try again.
    return {
      state,
      entry: { role: "interviewer", text: "Sorry, could you say that again in a different way?", directive },
    };
  }

  const turn = response.parsed_output;
  const { state: next, action } = advance(state, turn.action);
  return {
    state: next,
    entry: {
      role: "interviewer",
      text: turn.say,
      directive,
      action,
      questionId: currentQuestion(next)?.id,
      ...(adapted ? { adapted } : {}),
    },
  };
}

/** Mock mode streams its scripted line word by word, so the streaming path gets exercised without an API key. */
async function streamMockSay(text: string, onSay: (text: string) => void) {
  for (const word of text.split(/(?<= )/)) {
    onSay(word);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/**
 * Builds a new session. With a resume or job description, Claude writes
 * questions for this candidate; otherwise they come from the bank.
 */
export async function startSession(typeId: InterviewTypeId, settings?: SessionSettings, profile?: Profile): Promise<SessionState> {
  if (!profile) return createSession(typeId, { settings });
  if (!hasTailoringMaterial(profile)) {
    return createSession(typeId, { settings, candidate: { role: profile.role, summary: "No resume or job description provided." } });
  }
  if (MOCK_ENABLED) return createSession(typeId, { settings, ...mockTailoring(typeId, profile, questionCount(typeId, settings)) });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (profile.resumePdf) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: profile.resumePdf } });
  }
  content.push({ type: "text", text: tailoringRequest(typeId, profile, questionCount(typeId, settings)) });

  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: TAILOR_EFFORT, format: betaZodOutputFormat(TailoringSchema) },
    system: tailoringSystemPrompt(typeId),
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Couldn't tailor questions (${response.stop_reason}). Try again, or start without a resume.`);
  }
  const { candidateSummary, questions } = response.parsed_output;
  return createSession(typeId, {
    settings,
    questions: fillQuestions(typeId, questions, questionCount(typeId, settings)),
    candidate: { role: profile.role, summary: candidateSummary.slice(0, 2000) },
  });
}

/** Keeps tailored questions within the session schema's limits, topping up from the bank if too few came back. */
function fillQuestions(typeId: InterviewTypeId, generated: Question[], wanted: number): Question[] {
  const seen = new Set<string>();
  const cleaned = generated.slice(0, wanted).map((q, i) => {
    const id = seen.has(q.id) || !q.id ? `tailored-${i + 1}` : q.id.slice(0, 80);
    seen.add(id);
    return {
      ...q,
      id,
      topics: q.topics.slice(0, 10),
      followUps: q.followUps.slice(0, 8),
      hints: q.hints.slice(0, 5),
      commonMistakes: q.commonMistakes.slice(0, 8),
      // A reused bank problem keeps its tests.
      coding: typeId === "technical" ? CODING_SPECS[id] : undefined,
    };
  });
  const extras = pickBankQuestions(typeId, Math.random, wanted).filter((q) => !seen.has(q.id));
  return [...cleaned, ...extras].slice(0, wanted);
}

export async function generateFeedback(
  state: SessionState,
  transcript: TranscriptEntry[],
  finalWork: WorkspaceSnapshot[] = [],
): Promise<Feedback> {
  if (MOCK_ENABLED) return mockFeedback(state, finalWork);
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: FEEDBACK_EFFORT, format: betaZodOutputFormat(FeedbackSchema) },
    system: FEEDBACK_SYSTEM_PROMPT,
    messages: [{ role: "user", content: withImages(feedbackRequest(state, transcript, finalWork), finalWork) }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Feedback generation stopped early (${response.stop_reason})`);
  }
  return response.parsed_output;
}

/** Maps SDK errors to an HTTP status and a message that's safe to show the user. */
export function describeApiError(error: unknown): { status: number; message: string } {
  if (error instanceof Anthropic.AuthenticationError) {
    return { status: 500, message: "The server's ANTHROPIC_API_KEY is missing or invalid." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "Rate limited by the AI provider. Wait a moment and try again." };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: 502, message: `AI provider error (${error.status ?? "network"}).` };
  }
  return { status: 500, message: error instanceof Error ? error.message : "Unexpected error." };
}
