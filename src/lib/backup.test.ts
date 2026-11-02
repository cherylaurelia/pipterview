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
    const exported = exportData(here);
    if (!exported.ok) throw new Error(exported.error);
    const file = exported.json;
    expect(file).not.toContain("someone-else");
    const there = memoryStorage({ "pip:tour": "old", "extraview:stale": "gone", "other-site": "untouched" });
    expect(importData(file, there)).toEqual({ ok: true, count: 2 });
    expect(there.getItem("extraview:island")).toBe('{"grown":3}');
    expect(there.getItem("pip:tour")).toBe("[]");
    expect(there.getItem("other-site")).toBe("untouched");
    expect(there.getItem("extraview:stale")).toBeNull();
  });

  it("refuses files that aren't a backup, changing nothing", () => {
    const s = memoryStorage({ "pip:tour": "[]" });
    expect(importData("not json", s).ok).toBe(false);
    expect(importData('{"app":"something-else","version":1,"data":{}}', s).ok).toBe(false);
    expect(importData('{"app":"pipterview","version":1,"data":[]}', s).ok).toBe(false);
    expect(importData('{"app":"pipterview","version":1,"data":{"pip:tour":5}}', s).ok).toBe(false);
    expect(s.getItem("pip:tour")).toBe("[]");
  });

  it("puts everything back if the storage fills up part way through a restore", () => {
    const s = memoryStorage({ "pip:tour": "[]", "extraview:island": "mine" });
    const setItem = s.setItem;
    s.setItem = (k, v) => {
      if (k === "extraview:big") throw new Error("QuotaExceededError");
      setItem(k, v);
    };
    const file = JSON.stringify({ app: "pipterview", version: 1, data: { "pip:tour": "new", "extraview:big": "x".repeat(10) } });
    expect(importData(file, s).ok).toBe(false);
    expect(s.getItem("pip:tour")).toBe("[]");
    expect(s.getItem("extraview:island")).toBe("mine");
  });

  it("deletes only this app's keys", () => {
    const s = memoryStorage({ "mock-interviewer:history": "[]", "pip:mic": "mic", "other-site": "x" });
    deleteAllData(s);
    expect(s.length).toBe(1);
    expect(s.getItem("other-site")).toBe("x");
  });
});
