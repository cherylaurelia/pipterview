import { getInterviewType } from "./catalog";
import { DEFAULT_INTERVIEWER_NAME, type CandidateContext, type InterviewTypeId, type InterviewerAction, type Question, type SessionSettings, type SessionState } from "./types";

export const DEFAULT_SETTINGS: SessionSettings = { intensity: "standard", style: "big_tech", length: "full" };

export { INTERVIEWER_ACTIONS, type InterviewerAction } from "./types";

const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

/** How many questions a session asks: one for a quick rep, the round's usual number otherwise. */
export function questionCount(typeId: InterviewTypeId, settings: SessionSettings = DEFAULT_SETTINGS) {
  return settings.length === "quick" ? 1 : getInterviewType(typeId).questionsPerSession;
}

/** Picks questions from the bank at random, then orders them warm-up first. */
export function pickBankQuestions(typeId: InterviewTypeId, random: () => number = Math.random, count?: number): Question[] {
  const type = getInterviewType(typeId);
  return [...type.questions]
    .map((q) => ({ q, key: random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count ?? type.questionsPerSession)
    .map(({ q }) => q)
    .sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);
}


export function createSession(
  typeId: InterviewTypeId,
  options: { questions?: Question[]; candidate?: CandidateContext; settings?: SessionSettings } = {},
): SessionState {
  const settings = options.settings ?? DEFAULT_SETTINGS;
  return {
    typeId,
    questions: options.questions ?? pickBankQuestions(typeId, Math.random, questionCount(typeId, settings)),
    candidate: options.candidate,
    settings,
    phase: "intro",
    questionIndex: 0,
    followUps: 0,
    hintsGiven: 0,
    turnsOnQuestion: 0,
  };
}

export function currentQuestion(state: SessionState): Question | undefined {
  return state.phase === "question" ? state.questions[state.questionIndex] : undefined;
}

export function allowedActions(state: SessionState): InterviewerAction[] {
  const type = getInterviewType(state.typeId);
  switch (state.phase) {
    case "intro":
      return ["next_question"];
    case "question": {
      if (state.turnsOnQuestion >= type.maxTurnsPerQuestion) return ["next_question"];
      const question = state.questions[state.questionIndex];
      const actions: InterviewerAction[] = ["clarify"];
      if (state.hintsGiven < question.hints.length) actions.push("hint");
      if (state.followUps < type.maxFollowUps) actions.push("follow_up");
      actions.push("next_question");
      return actions;
    }
    case "candidate_questions":
      return ["end_interview"];
    case "done":
      return [];
  }
}

const bullets = (items: string[]) => items.map((item, i) => `  ${i + 1}. ${item}`).join("\n");

/** What the server knows about the conversation beyond the session state. */
export interface DirectiveContext {
  /** Whether the candidate has shared any code for the current question yet. */
  codeShared?: boolean;
  /** Signs the candidate is struggling right now, from their latest answer. */
  stress?: string[];
}

/** How Alex responds to signs of stress, by intensity. Gentle and standard ease off; realistic holds steady. */
export function stressGuidance(state: SessionState, stress: string[] | undefined): string | undefined {
  if (!stress?.length) return undefined;
  const signs = stress.join("; ");
  if (state.settings.intensity === "realistic") {
    return `- The candidate may be under pressure right now (${signs}). Stay professional and don't add pressure, but don't reassure either; that's part of realistic practice.`;
  }
  return `- The candidate may be struggling right now (${signs}). Respond to that first: slow down, say one short, natural reassuring sentence (for example that it's fine to take a moment), and if they're stuck, prefer a hint or let them restart their answer over moving on. Never mention these signs or say they seem nervous.`;
}

/** The private, per-turn instruction telling the interviewer what to do next. */
export function directiveFor(state: SessionState, context: DirectiveContext = {}): string {
  const type = getInterviewType(state.typeId);
  const total = state.questions.length;
  const quote = (q: Question) => `"${q.prompt}"`;

  switch (state.phase) {
    case "intro":
      return [
        "Phase: opening.",
        `Greet the candidate, introduce yourself as ${state.settings.interviewerName ?? DEFAULT_INTERVIEWER_NAME}, and say in one sentence that this is a ${type.label.toLowerCase()} interview with ${total === 1 ? "one main question" : `${total} questions`}.`,
        `Then ask the first question, close to verbatim: ${quote(state.questions[0])}`,
        'Use action "next_question".',
      ].join("\n");

    case "question": {
      const q = state.questions[state.questionIndex];
      const next = state.questions[state.questionIndex + 1];
      const actions = allowedActions(state);
      const moveOn = next
        ? `briefly and neutrally acknowledge the answer, then ask the next question, close to verbatim: ${quote(next)}`
        : "briefly and neutrally acknowledge the answer, say that's all the questions you have, and ask whether they have any questions for you.";

      const lines = [
        `Phase: question ${state.questionIndex + 1} of ${total}: "${q.prompt}"`,
        "Private interviewer notes. Never read these aloud or reveal them.",
        `- A strong answer: ${q.strongAnswer}`,
        `- Common mistakes worth probing if you hear them: ${q.commonMistakes.join("; ")}.`,
        `- Follow-up ladder (used ${state.followUps} of ${type.maxFollowUps}). Pick the next one that fits what they've said, adapting the wording; skip any they've already covered:`,
        bullets(q.followUps),
      ];
      if (q.hints.length > 0) {
        lines.push(`- Hint ladder (given ${state.hintsGiven} of ${q.hints.length}):`, bullets(q.hints));
      }

      if (q.coding) {
        lines.push(
          "- If they jump straight to a textbook solution, check it's understanding rather than recall: ask why it works, or change a constraint from the follow-up ladder.",
        );
      }
      if (q.coding && !context.codeShared) {
        lines.push(
          "- No code from them on this question yet. Once their approach is sound (or after one follow-up on it), your follow-up should be to ask them to code it in the editor and run the tests.",
        );
      }
      if (state.settings.intensity === "gentle") {
        lines.push("- Gentle practice mode: if they seem stuck or flustered, prefer a hint and a reassuring word over moving on.");
      }
      const stress = stressGuidance(state, context.stress);
      if (stress) lines.push(stress);

      if (actions.length === 1) {
        lines.push(`Time is up for this question. Use action "next_question": ${moveOn}`);
      } else {
        lines.push("Based on the candidate's latest message, choose exactly one action:");
        lines.push(
          '- "clarify": they asked a clarifying question or asked you to repeat. Answer briefly, without giving away the solution, and let them continue.',
        );
        if (actions.includes("hint")) {
          lines.push(
            `- "hint": they're stuck, going in circles, or asked for help. Give hint ${state.hintsGiven + 1} from the ladder in your own words, and nothing bigger.`,
          );
        }
        if (actions.includes("follow_up")) {
          lines.push(
            '- "follow_up": they answered, and there is a gap, a mistake, or a deeper level worth probing. Ask the next fitting follow-up from the ladder.',
          );
        }
        lines.push(`- "next_question": this question is covered well enough. ${capitalize(moveOn)}`);
      }
      return lines.join("\n");
    }

    case "candidate_questions":
      return [
        "Phase: candidate's questions.",
        "If the candidate asked you something, answer briefly and honestly as an interviewer at a typical tech company, without inventing specific facts about a real company.",
        "Then close: thank them for their time and tell them their feedback report is ready on screen.",
        'Use action "end_interview".',
      ].join("\n");

    case "done":
      throw new Error("Interview is already over");
  }
}

/**
 * Applies the interviewer's action to the session. A disallowed action (say,
 * another follow-up after running out) is treated as "clarify", which stays on
 * the question and still counts toward the turn cap, so the flow always ends
 * up moving on. Returns the action actually applied.
 */
export function advance(state: SessionState, chosen: InterviewerAction): { state: SessionState; action: InterviewerAction } {
  const actions = allowedActions(state);
  const fallback = actions.includes("clarify") ? "clarify" : actions[actions.length - 1];
  const action = actions.includes(chosen) ? chosen : fallback;
  const turn = state.turnsOnQuestion + 1;

  switch (state.phase) {
    case "intro":
      return {
        action,
        state: { ...state, phase: "question", questionIndex: 0, followUps: 0, hintsGiven: 0, turnsOnQuestion: 0 },
      };

    case "question":
      if (action === "follow_up") return { action, state: { ...state, followUps: state.followUps + 1, turnsOnQuestion: turn } };
      if (action === "hint") return { action, state: { ...state, hintsGiven: state.hintsGiven + 1, turnsOnQuestion: turn } };
      if (action === "clarify") return { action, state: { ...state, turnsOnQuestion: turn } };
      if (state.questionIndex + 1 < state.questions.length) {
        return {
          action,
          state: { ...state, questionIndex: state.questionIndex + 1, followUps: 0, hintsGiven: 0, turnsOnQuestion: 0 },
        };
      }
      return { action, state: { ...state, phase: "candidate_questions" } };

    case "candidate_questions":
    case "done":
      return { action, state: { ...state, phase: "done" } };
  }
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
