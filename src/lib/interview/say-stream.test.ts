import { describe, expect, it } from "vitest";
import { createSayExtractor } from "./say-stream";

const feed = (chunks: string[]) => {
  const push = createSayExtractor();
  return chunks.map((c) => push(c));
};

describe("createSayExtractor", () => {
  it("streams the say value as it arrives", () => {
    const out = feed(['{"action":"follow_up",', '"say":"Okay, th', "anks. Why does ", 'that work?"}']);
    expect(out).toEqual(["", "Okay, th", "anks. Why does ", "that work?"]);
  });

  it("decodes escapes, even when split across chunks", () => {
    const out = feed(['{"say":"She said \\', '"hi\\" \\u00e9', "t\\u00e9", '\\n"}']);
    expect(out.join("")).toBe('She said "hi" été\n');
  });

  it("ignores everything after the closing quote", () => {
    const push = createSayExtractor();
    expect(push('{"say":"Done."}')).toBe("Done.");
    expect(push(', "say":"again"')).toBe("");
  });

  it("works when say comes before other keys", () => {
    expect(feed(['{"say":"Hi there.","action":"next_question"}']).join("")).toBe("Hi there.");
  });
});
