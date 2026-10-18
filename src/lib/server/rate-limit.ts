import { MOCK_ENABLED } from "../mock";

/**
 * Per-visitor limits on the routes that spend money (Claude and ElevenLabs), so a public link can't drain the keys.
 *
 * Counts live in memory, so each server instance counts on its own: on serverless hosting a determined visitor
 * could get a few times these numbers by landing on different instances. That stops casual abuse; set a spending
 * cap in the Claude console as the hard ceiling, or move the counts to a shared store (e.g. Upstash Redis) to make
 * them exact.
 *
 * On in production only (not in development, not with MOCK_AI). RATE_LIMIT=off turns it off.
 */

const HOUR = 60 * 60 * 1000;

export const LIMITS = {
  /** New sessions. A round is one start, so this is a lot of practice. */
  start: { limit: 12, windowMs: HOUR },
  /** Answers within sessions. */
  turn: { limit: 150, windowMs: HOUR },
  feedback: { limit: 12, windowMs: HOUR },
  /** Spoken sentences (one request each). Over the limit, the browser's own voice takes over. */
  tts: { limit: 400, windowMs: HOUR },
} as const;

export type LimitName = keyof typeof LIMITS;

export type Hits = Map<string, number[]>;
const hits: Hits = new Map();

/** Records a request and says whether it's allowed. Pure apart from `store`, for testing. */
export function checkRateLimit(name: LimitName, visitor: string, now = Date.now(), store: Hits = hits): { ok: true } | { ok: false; retryAfterSec: number } {
  const { limit, windowMs } = LIMITS[name];
  const key = `${name}:${visitor}`;
  const recent = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    store.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  store.set(key, recent);
  if (store.size > 20_000) prune(store, now);
  return { ok: true };
}

function prune(store: Hits, now: number) {
  for (const [key, times] of store) {
    const windowMs = LIMITS[key.slice(0, key.indexOf(":")) as LimitName]?.windowMs ?? HOUR;
    if (!times.some((t) => now - t < windowMs)) store.delete(key);
  }
}

/** Who's asking: the client IP the host forwards (first hop of x-forwarded-for), or one shared bucket if unknown. */
export function visitorOf(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

const enabled = () => process.env.NODE_ENV === "production" && !MOCK_ENABLED && process.env.RATE_LIMIT !== "off";

/** A 429 response if this visitor is over the limit for `name`, otherwise null. Call first thing in a route. */
export function rateLimited(request: Request, name: LimitName): Response | null {
  if (!enabled()) return null;
  const result = checkRateLimit(name, visitorOf(request));
  if (result.ok) return null;
  const minutes = Math.ceil(result.retryAfterSec / 60);
  return Response.json(
    { error: `You've been practising a lot! Take a short break and try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}
