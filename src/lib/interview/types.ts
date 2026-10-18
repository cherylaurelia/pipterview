import type { CodingSpec, WorkspaceSnapshot } from "../workspace/types";

export const INTERVIEW_TYPE_IDS = ["technical", "behavioral", "system-design"] as const;
export type InterviewTypeId = (typeof INTERVIEW_TYPE_IDS)[number];

export function isInterviewTypeId(value: string): value is InterviewTypeId {
  return (INTERVIEW_TYPE_IDS as readonly string[]).includes(value);
}

/**
 * The round types people can pick, review, and see in their progress. System design is hidden for now: its questions,
 * rubric, and design workspace stay in place (and the API still accepts it), but nothing in the UI offers it, and
 * /interview/system-design redirects home (see next.config.ts).
 */
export const VISIBLE_INTERVIEW_TYPE_IDS = ["technical", "behavioral"] as const satisfies readonly InterviewTypeId[];
export const HIDDEN_INTERVIEW_TYPE_IDS = INTERVIEW_TYPE_IDS.filter((id) => !isVisibleInterviewTypeId(id));

export function isVisibleInterviewTypeId(value: string): value is (typeof VISIBLE_INTERVIEW_TYPE_IDS)[number] {
  return (VISIBLE_INTERVIEW_TYPE_IDS as readonly string[]).includes(value);
}

export const ROLE_IDS = ["swe", "pm", "data", "fde", "other"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Question {
  id: string;
  /** What the interviewer asks, close to verbatim. */
  prompt: string;
  difficulty: Difficulty;
  topics: string[];
  /** What a strong new-grad answer covers. Private to the interviewer. */
  strongAnswer: string;
  /** Escalating follow-ups, roughly in the order a real interviewer would push. */
  followUps: string[];
  /** Graduated hints for a stuck candidate, smallest nudge first. */
  hints: string[];
  /** Traps and weak patterns worth probing when they show up. */
  commonMistakes: string[];
  /** Set when the question was written for this candidate from their resume or a job description. */
  tailoredReason?: string;
  /** Starter code and tests for the editor. Coding questions without one run code with no tests. */
  coding?: CodingSpec;
}

export interface RubricDimension {
  name: string;
  /** What this dimension measures. */
  description: string;
  /** What a 1, 2, 3, and 4 look like at a new-grad bar, in that order. */
  levels: [string, string, string, string];
}

export interface InterviewType {
  id: InterviewTypeId;
  label: string;
  tagline: string;
  /** How many questions to ask in one session. */
  questionsPerSession: number;
  /** Max probing follow-ups per question before the interviewer must move on. */
  maxFollowUps: number;
  /** Hard cap on interviewer turns per question (follow-ups, hints, clarifications). */
  maxTurnsPerQuestion: number;
  /** Type-specific guidance appended to the interviewer persona. */
  interviewerGuidance: string;
  questions: Question[];
  rubric: RubricDimension[];
}

/** Who the candidate is, distilled from their resume / target job. Optional. */
export interface CandidateContext {
  role: RoleId;
  /** A short third-person summary the interviewer can lean on. */
  summary: string;
}

/**
 * The interviewer's choice for one turn. The server owns the overall flow
 * (which question, when to wrap up); the model only picks among the actions
 * the current directive allows.
 */
export const INTERVIEWER_ACTIONS = ["clarify", "hint", "follow_up", "next_question", "end_interview"] as const;
export type InterviewerAction = (typeof INTERVIEWER_ACTIONS)[number];

/**
 * How much pressure the practice session puts on. Graded exposure: start
 * gentle, work up to realistic as confidence grows.
 */
export const INTENSITIES = ["gentle", "standard", "realistic"] as const;
export type Intensity = (typeof INTENSITIES)[number];

/** The kind of company the interviewer plays. */
export const COMPANY_STYLES = ["big_tech", "startup"] as const;
export type CompanyStyle = (typeof COMPANY_STYLES)[number];

/** A quick rep is one question (about 5 to 20 minutes); a full interview is the whole round. */
export const LENGTHS = ["quick", "full"] as const;
export type SessionLength = (typeof LENGTHS)[number];

export interface SessionSettings {
  intensity: Intensity;
  style: CompanyStyle;
  length: SessionLength;
  /** What the interviewer calls themselves, so the voice matches the character on screen. Defaults to Alex. */
  interviewerName?: string;
  /** One-line summaries of stories from the candidate's story bank, so the interviewer can nudge them towards one if they freeze. */
  stories?: string[];
}

export const DEFAULT_INTERVIEWER_NAME = "Alex";

/** Where the conversation is. The server advances this. */
export type Phase = "intro" | "question" | "candidate_questions" | "done";

export interface SessionState {
  typeId: InterviewTypeId;
  /** The session's questions, in order. Carried in full because tailored ones aren't in the bank. */
  questions: Question[];
  candidate?: CandidateContext;
  settings: SessionSettings;
  phase: Phase;
  questionIndex: number;
  followUps: number;
  hintsGiven: number;
  turnsOnQuestion: number;
}

export interface TranscriptEntry {
  role: "interviewer" | "candidate";
  text: string;
  /**
   * The per-turn instruction that produced an interviewer line. Replayed
   * unchanged so the conversation sent to Claude stays append-only.
   */
  directive?: string;
  /** What the interviewer line did; lets feedback account for hints given. */
  action?: InterviewerAction;
  questionId?: string;
  /** The candidate's code or whiteboard at the time of this answer, when it changed since they last spoke. */
  workspace?: WorkspaceSnapshot;
  /** How long a spoken answer took, for pace and filler-word stats. Absent for typed answers. */
  durationMs?: number;
  /** How long the candidate took to start speaking once it was their turn (spoken answers only). */
  thinkMs?: number;
  /** Signs the candidate was struggling on this answer (a long silence before starting, "I'm blanking", a rushed pace). */
  stressSignals?: string[];
  /** Set on interviewer lines where Alex eased off because the candidate seemed stressed. */
  adapted?: boolean;
}
