import type { SessionRecord } from "./history";
import type { DeliveryStats } from "./interview/delivery";

// What got better since your last session, in plain words. The island rewards finishing (something grows every
// time); this rewards improving: when a habit moves the right way, flowers bloom. Delivery habits carry across round
// types, so the comparison is with your most recent session of any kind.

export interface ThisSession {
  stats: DeliveryStats;
  nervousBefore?: number;
}

const one = (n: number) => n.toFixed(1);

export function improvementsSince(previous: SessionRecord | undefined, now: ThisSession): string[] {
  if (!previous) return [];
  const out: string[] = [];
  const { stats } = now;
  if (previous.fillersPerMinute !== undefined && stats.fillersPerMinute !== undefined && previous.fillersPerMinute - stats.fillersPerMinute >= 0.5) {
    out.push(`fewer filler words (${one(previous.fillersPerMinute)} → ${one(stats.fillersPerMinute)} a minute)`);
  }
  if (previous.hedgesPerAnswer !== undefined && stats.averageAnswerWords > 0 && previous.hedgesPerAnswer - stats.hedgesPerAnswer >= 0.3) {
    out.push(`less hedging (${one(previous.hedgesPerAnswer)} → ${one(stats.hedgesPerAnswer)} an answer)`);
  }
  if (previous.ownershipPercent !== undefined && stats.ownershipPercent !== undefined && stats.ownershipPercent - previous.ownershipPercent >= 10) {
    out.push(`more "I" and less "we" (${Math.round(previous.ownershipPercent)}% → ${Math.round(stats.ownershipPercent)}%)`);
  }
  if (previous.nervousBefore !== undefined && now.nervousBefore !== undefined && now.nervousBefore < previous.nervousBefore) {
    out.push("calmer going in");
  }
  return out;
}
