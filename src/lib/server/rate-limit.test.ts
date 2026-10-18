import { describe, expect, it } from "vitest";
import { LIMITS, checkRateLimit, visitorOf, type Hits } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows up to the limit, then blocks with a retry time", () => {
    const store: Hits = new Map();
    const { limit } = LIMITS.start;
    for (let i = 0; i < limit; i++) expect(checkRateLimit("start", "a", 1000 + i, store).ok).toBe(true);
    const blocked = checkRateLimit("start", "a", 2000, store);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("counts each visitor and each route separately", () => {
    const store: Hits = new Map();
    for (let i = 0; i < LIMITS.start.limit; i++) checkRateLimit("start", "a", i, store);
    expect(checkRateLimit("start", "a", 100, store).ok).toBe(false);
    expect(checkRateLimit("start", "b", 100, store).ok).toBe(true);
    expect(checkRateLimit("turn", "a", 100, store).ok).toBe(true);
  });

  it("lets requests through again once the window has passed", () => {
    const store: Hits = new Map();
    const { limit, windowMs } = LIMITS.feedback;
    for (let i = 0; i < limit; i++) checkRateLimit("feedback", "a", 0, store);
    expect(checkRateLimit("feedback", "a", windowMs - 1, store).ok).toBe(false);
    expect(checkRateLimit("feedback", "a", windowMs, store).ok).toBe(true);
  });
});

describe("visitorOf", () => {
  it("uses the first forwarded address", () => {
    expect(visitorOf(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe("1.2.3.4");
    expect(visitorOf(new Request("http://x", { headers: { "x-real-ip": "5.6.7.8" } }))).toBe("5.6.7.8");
    expect(visitorOf(new Request("http://x"))).toBe("unknown");
  });
});
