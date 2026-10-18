import Image from "next/image";
import type { InterviewTypeId } from "@/lib/interview/types";
import type { PrepType } from "./world/script";

// Each kind of round's icon. System design has none yet, so it renders nothing.
const ICONS: Partial<Record<PrepType | InterviewTypeId, string>> = {
  behavioral: "/design/interview-types/behavioral.svg",
  technical: "/design/interview-types/technical.svg",
  resume: "/design/interview-types/resume-quiz.svg",
};

/** The icon for a kind of round: about 44px on the cards where you pick one, about 22px beside a label. */
export function RoundIcon({ type, size = 22, className = "" }: { type: PrepType | InterviewTypeId; size?: number; className?: string }) {
  const src = ICONS[type];
  if (!src) return null;
  return <Image src={src} alt="" width={size} height={size} className={`shrink-0 ${className}`} style={{ width: size, height: size }} />;
}
