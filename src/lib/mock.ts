import { ROLES, getInterviewType, rubricFor } from "./interview/catalog";
import { advance, currentQuestion, directiveFor, pickBankQuestions, type DirectiveContext, type InterviewerAction } from "./interview/flow";
import type { Feedback } from "./interview/prompts";
import type { Profile } from "./interview/tailor";
import type { CandidateContext, InterviewTypeId, Question, SessionState, TranscriptEntry } from "./interview/types";
import type { WorkspaceSnapshot } from "./workspace/types";

/**
 * Scripted stand-in for Claude, enabled with MOCK_AI=1. Follows the real flow
 * (same directives and state machine) so the voice loop, 3D scene, and UI can
 * be developed without an API key or spending credits.
 *
 * Per question it asks the first follow-up from the ladder, then moves on.
 * Say "hint" or "stuck" to get the next hint instead.
 */
export const MOCK_ENABLED = process.env.MOCK_AI === "1";

export function mockInterviewerTurn(state: SessionState, transcript: TranscriptEntry[], context: DirectiveContext = {}) {
  const type = getInterviewType(state.typeId);
  const directive = directiveFor(state, context);
  const last = transcript.at(-1)?.role === "candidate" ? transcript.at(-1) : undefined;
  const lastAnswer = last?.text.toLowerCase() ?? "";
  // Shows that the candidate's work reached the interviewer.
  const seen = last?.workspace ? `${describeWork(last.workspace)} ` : "";
  const question = currentQuestion(state);

  let action: InterviewerAction;
  let say: string;
  // Mock version of easing off when the candidate seems stuck.
  const reassure = context.stress?.length && state.settings.intensity !== "realistic" ? "No rush, take your time. " : "";
  if (state.phase === "intro") {
    action = "next_question";
    say = `Hi, I'm Alex, thanks for joining. This is a practice ${type.label.toLowerCase()} interview. Let's start. ${state.questions[0].prompt}`;
  } else if (question && /moment to think/.test(lastAnswer)) {
    action = "clarify";
    say = "Of course, take your time.";
  } else if (question && /\b(hint|stuck)\b/.test(lastAnswer) && state.hintsGiven < question.hints.length) {
    action = "hint";
    say = `${reassure}Sure, here's a nudge. ${question.hints[state.hintsGiven]}`;
  } else if (question && state.followUps === 0) {
    action = "follow_up";
    const ask = question.coding && !context.codeShared ? "Sounds good. Go ahead and code that up in the editor, then run the tests." : (question.followUps[0] ?? "Can you go one level deeper on that?");
    say = `${reassure || "Okay, thanks. "}${seen}${ask}`;
  } else if (state.phase === "question") {
    action = "next_question";
    const next = state.questions[state.questionIndex + 1];
    say = next
      ? `Got it. ${seen}Moving on. ${next.prompt}`
      : "Got it, thanks. That's all the questions I have. Do you have any questions for me?";
  } else {
    action = "end_interview";
    say = "Great question. Thanks so much for your time today. Your feedback report is ready on screen.";
  }

  const { state: next, action: applied } = advance(state, action);
  const entry: TranscriptEntry = {
    role: "interviewer",
    text: say,
    directive,
    action: applied,
    questionId: currentQuestion(next)?.id,
  };
  return { state: next, entry };
}

export function mockTailoring(typeId: InterviewTypeId, profile: Profile, count?: number): { questions: Question[]; candidate: CandidateContext } {
  const source = profile.resumePdf ? "an uploaded resume PDF" : profile.resumeText ? "a pasted resume" : "no resume";
  const jd = profile.jobDescription?.trim() ? "a job description" : "no job description";
  return {
    candidate: {
      role: profile.role,
      summary: `Mock summary (MOCK_AI=1) for a ${ROLES[profile.role]} candidate, from ${source} and ${jd}.`,
    },
    questions: pickBankQuestions(typeId, Math.random, count).map((q) => ({
      ...q,
      tailoredReason: "Mock mode picks bank questions; real tailoring needs an API key.",
    })),
  };
}

function describeWork(work: WorkspaceSnapshot) {
  if (work.kind === "code") {
    const lines = work.code.trim().split("\n").length;
    const result = work.run?.split("\n")[0].replace(/^Last run: /, "") ?? "not run yet";
    return `I can see your ${work.language} code, ${lines} lines; tests: ${result}`;
  }
  const components = work.diagram.match(/^Components: (.*)$/m)?.[1] ?? "none yet";
  return `I can see your diagram. Components: ${components}.`;
}

export function mockFeedback(state: SessionState, finalWork: WorkspaceSnapshot[] = []): Feedback {
  const rubric = rubricFor(state.typeId, state.candidate?.role);
  return {
    recommendation: "lean_hire",
    summary: `This is mock feedback (MOCK_AI=1). Set ANTHROPIC_API_KEY and remove MOCK_AI to get real feedback on your answers.${finalWork.length ? ` Final work received: ${finalWork.map(describeWork).join(" | ")}` : ""}`,
    dimensions: rubric.map((d, i) => ({
      name: d.name,
      score: (i % 4) + 1,
      evidence: "Placeholder evidence from the transcript.",
      advice: `Placeholder advice for ${d.name.toLowerCase()}.`,
    })),
    strengths: ["Placeholder strength one.", "Placeholder strength two."],
    improvements: ["Placeholder improvement one.", "Placeholder improvement two."],
    questionReviews: state.questions.map((q) => ({
      questionId: q.id,
      wentWell: "Placeholder: what went well.",
      toImprove: "Placeholder: what to improve.",
      strongerAnswer: q.strongAnswer,
    })),
    nextSteps: ["Placeholder next step one.", "Placeholder next step two."],
  };
}
