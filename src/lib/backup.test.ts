import { describe, expect, it } from "vitest";
import { deleteAllData, exportData, importData } from "./backup";

/** A stand-in for localStorage. */
function memoryStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("backing up your data", () => {
  it("exports only this app's keys and restores them elsewhere", () => {
    const here = memoryStorage({ "extraview:island": '{"grown":3}', "pip:tour": "[]", "someone-else": "keep out" });
    const file = exportData(here);
    expect(file).not.toContain("someone-else");
    const there = memoryStorage({ "pip:tour": "old", "other-site": "untouched" });
    expect(importData(file, there)).toEqual({ ok: true, count: 2 });
    expect(there.getItem("extraview:island")).toBe('{"grown":3}');
    expect(there.getItem("pip:tour")).toBe("[]");
    expect(there.getItem("other-site")).toBe("untouched");
  });

  it("refuses files that aren't a backup, changing nothing", () => {
    const s = memoryStorage({ "pip:tour": "[]" });
    expect(importData("not json", s).ok).toBe(false);
    expect(importData('{"app":"something-else","version":1,"data":{}}', s).ok).toBe(false);
    expect(s.getItem("pip:tour")).toBe("[]");
  });

  it("deletes only this app's keys", () => {
    const s = memoryStorage({ "mock-interviewer:history": "[]", "pip:mic": "mic", "other-site": "x" });
    deleteAllData(s);
    expect(s.length).toBe(1);
    expect(s.getItem("other-site")).toBe("x");
  });
});
