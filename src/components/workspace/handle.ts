import type { WorkspaceSnapshot } from "@/lib/workspace/types";

/** What the interview room asks of a workspace (code editor or whiteboard). */
export interface WorkspaceHandle {
  /** The current work and a key that changes whenever it does; null when there's nothing yet. */
  snapshot(): Promise<{ snapshot: WorkspaceSnapshot; key: string } | null>;
  /** Everything the candidate produced, for the feedback report (e.g. code for every question they attempted). */
  finalWork(): Promise<WorkspaceSnapshot[]>;
}
