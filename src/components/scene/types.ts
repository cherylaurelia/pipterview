/** What a character is doing right now; drives placeholder animation (and later, real animations). */
export type Activity = "idle" | "speaking" | "listening" | "thinking";

export interface SceneState {
  interviewer: Activity;
  candidate: Activity;
}
