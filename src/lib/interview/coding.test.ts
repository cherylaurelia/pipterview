import ts from "typescript";
import { describe, expect, it } from "vitest";
import { cDriver, cppDriver, javaDriver } from "../server/drivers";
import { CODE_LANGUAGES } from "../workspace/types";
import { INTERVIEW_TYPES } from "./catalog";
import { CODING_SPECS } from "./coding";

describe("coding specs", () => {
  it("every technical bank question has a spec", () => {
    for (const q of INTERVIEW_TYPES.technical.questions) expect(q.coding, q.id).toBeDefined();
  });

  for (const [id, spec] of Object.entries(CODING_SPECS)) {
    describe(id, () => {
      it("has an entry and starter code for every language", () => {
        for (const lang of CODE_LANGUAGES) {
          expect(spec.entry[lang], lang).toMatch(/^[A-Za-z_]\w*$/);
          expect(spec.starter[lang], lang).toContain(spec.entry[lang]);
        }
      });

      it("has visible examples and hidden tests", () => {
        expect(spec.tests.some((t) => !t.hidden)).toBe(true);
        expect(spec.tests.some((t) => t.hidden)).toBe(true);
      });

      it("types match each test's arguments", () => {
        for (const test of spec.tests) {
          if (spec.mode === "class") {
            const [ops, args] = test.args as [string[], unknown[][]];
            expect(ops.length).toBe(args.length);
            if (!("methods" in spec.types)) throw new Error("class spec without method types");
            for (const op of ops.slice(1)) expect(spec.types.methods[op], op).toBeDefined();
          } else {
            if ("methods" in spec.types) throw new Error("function spec with method types");
            expect(test.args.length).toBe(spec.types.params.length);
          }
        }
      });

      it("has a TypeScript starter that transpiles cleanly", () => {
        const out = ts.transpileModule(spec.starter.typescript, { reportDiagnostics: true });
        expect(out.diagnostics ?? []).toHaveLength(0);
      });

      it("generates Java, C++, and C drivers with one result per test", () => {
        for (const driver of [javaDriver(spec), cppDriver(spec), cDriver(spec)]) {
          expect(driver.match(/\/\/ Test \d+/g)).toHaveLength(spec.tests.length);
        }
      });
    });
  }

  it("writes typed literals into the drivers", () => {
    const two = CODING_SPECS["two-sum"];
    expect(javaDriver(two)).toContain("int[] a0 = new int[]{2, 7, 11, 15};");
    expect(cppDriver(two)).toContain("vector<int> a0 = vector<int>{2, 7, 11, 15};");
    const bst = CODING_SPECS["valid-bst"];
    expect(javaDriver(bst)).toContain("TreeNode.build(new Integer[]{5, 1, 4, null, null, 3, 6})");
    expect(cppDriver(bst)).toContain("mi_driver::build({5, 1, 4, nullopt, nullopt, 3, 6})");
    expect(cDriver(two)).toContain("int a0[4] = {2, 7, 11, 15};");
    expect(cDriver(two)).toContain("int* r = twoSum(a0, a0Size, a1, &rs);");
  });

  it("rejects test values that don't match their declared type", () => {
    const bad = { ...CODING_SPECS["two-sum"], tests: [{ args: [["not", "ints"], 9], expected: [0, 1] }] };
    expect(() => javaDriver(bad)).toThrow(/integer/);
  });
});
