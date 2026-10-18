import { z } from "zod";
import { ProfileSchema } from "./tailor";
import { CODE_LANGUAGES, VALUE_TYPES } from "../workspace/types";
import { COMPANY_STYLES, DIFFICULTIES, INTENSITIES, INTERVIEWER_ACTIONS, INTERVIEW_TYPE_IDS, LENGTHS, ROLE_IDS } from "./types";

export const SettingsSchema = z.object({
  intensity: z.enum(INTENSITIES),
  style: z.enum(COMPANY_STYLES),
  length: z.enum(LENGTHS).default("full"),
  // A first name only: it's spoken aloud and goes into the prompt.
  interviewerName: z.string().regex(/^[A-Za-z][A-Za-z' -]{0,23}$/).optional(),
  stories: z.array(z.string().max(200)).max(8).optional(),
});

/** Request-body validation for the interview API routes. */

const text = (max: number) => z.string().max(max);
const list = (maxItems: number, maxLength = 600) => z.array(text(maxLength)).max(maxItems);

const identifier = z.string().regex(/^[A-Za-z_$][\w$]{0,79}$/);

const SignatureSchema = z.object({ params: z.array(z.enum(VALUE_TYPES)).max(10), returns: z.enum(VALUE_TYPES) });

export const CodingSpecSchema = z.object({
  mode: z.enum(["function", "class"]),
  entry: z.object({ python: identifier, javascript: identifier, typescript: identifier, java: identifier, cpp: identifier, c: identifier }),
  argTypes: z.array(z.enum(["json", "tree"])).max(10).optional(),
  types: z.union([
    SignatureSchema,
    z.object({ constructor: z.array(z.enum(VALUE_TYPES)).max(10), methods: z.record(identifier, SignatureSchema) }),
  ]),
  signature: text(1000),
  starter: z.object({
    python: text(5000),
    javascript: text(5000),
    typescript: text(5000),
    java: text(5000),
    cpp: text(5000),
    c: text(5000),
  }),
  compare: z.enum(["exact", "unordered"]),
  tests: z
    .array(z.object({ args: z.array(z.unknown()).max(10), expected: z.unknown(), hidden: z.boolean().optional() }))
    .max(30),
});

export const WorkspaceSnapshotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("code"),
    questionId: text(80),
    language: z.enum(CODE_LANGUAGES),
    code: text(20_000),
    run: text(4000).optional(),
  }),
  z.object({
    kind: z.literal("design"),
    notes: text(10_000),
    diagram: text(10_000),
    // Base64 JPEG; ~1.5 MB of image at most.
    image: z.string().max(2_000_000).optional(),
  }),
]);

export const QuestionSchema = z.object({
  id: text(80),
  prompt: text(600),
  difficulty: z.enum(DIFFICULTIES),
  topics: list(10, 80),
  strongAnswer: text(2000),
  followUps: list(8),
  hints: list(5),
  commonMistakes: list(8),
  tailoredReason: text(600).optional(),
  coding: CodingSpecSchema.optional(),
});

export const SessionStateSchema = z.object({
  typeId: z.enum(INTERVIEW_TYPE_IDS),
  questions: z.array(QuestionSchema).min(1).max(5),
  candidate: z.object({ role: z.enum(ROLE_IDS), summary: text(2000) }).optional(),
  settings: SettingsSchema,
  phase: z.enum(["intro", "question", "candidate_questions", "done"]),
  questionIndex: z.number().int().min(0),
  followUps: z.number().int().min(0),
  hintsGiven: z.number().int().min(0),
  turnsOnQuestion: z.number().int().min(0),
});

export const TranscriptSchema = z
  .array(
    z.object({
      role: z.enum(["interviewer", "candidate"]),
      text: text(8000),
      directive: text(8000).optional(),
      action: z.enum(INTERVIEWER_ACTIONS).optional(),
      questionId: text(80).optional(),
      workspace: WorkspaceSnapshotSchema.optional(),
      durationMs: z.number().int().min(0).max(3_600_000).optional(),
      thinkMs: z.number().int().min(0).max(3_600_000).optional(),
      stressSignals: list(5, 200).optional(),
      adapted: z.boolean().optional(),
    }),
  )
  .max(200);

export const TurnRequestSchema = z.object({
  state: SessionStateSchema,
  transcript: TranscriptSchema,
});

export const FeedbackRequestSchema = TurnRequestSchema.extend({
  /** The candidate's final code (per question) or whiteboard, which may be newer than anything they said. */
  work: z.array(WorkspaceSnapshotSchema).max(5).optional(),
});

export const StartRequestSchema = z.object({
  typeId: z.enum(INTERVIEW_TYPE_IDS),
  settings: SettingsSchema.optional(),
  profile: ProfileSchema.optional(),
});
