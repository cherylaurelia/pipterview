// Runs candidate JavaScript (or TypeScript, with ?lang=typescript) in a worker (no DOM access, killed on timeout).
// Messages in:  { type: "init" } | { type: "run", id, code, harness }
// Messages out: { type: "ready" } | { type: "result", id, results, stdout, error }
// harness: null (just run the code) or { mode, entry, argTypes, tests: [{ args }] }

const LANGUAGE = new URLSearchParams(self.location.search).get("lang") || "javascript";
// The TypeScript compiler, loaded once (it's large) before this worker reports ready.
const TYPESCRIPT_URL = "https://cdn.jsdelivr.net/npm/typescript@5.9.3/lib/typescript.js";

/** Strips TypeScript types; throws a readable error for syntax mistakes. */
function transpile(source) {
  const out = self.ts.transpileModule(source, {
    compilerOptions: { target: self.ts.ScriptTarget.ES2020, module: self.ts.ModuleKind.None },
    reportDiagnostics: true,
  });
  const problems = (out.diagnostics || []).map((d) => {
    const where = d.file && d.start !== undefined ? `Line ${d.file.getLineAndCharacterOfPosition(d.start).line + 1}: ` : "";
    return where + self.ts.flattenDiagnosticMessageText(d.messageText, "\n");
  });
  if (problems.length) throw new SyntaxError(problems.join("\n"));
  return out.outputText;
}

function TreeNode(val, left, right) {
  this.val = val === undefined ? 0 : val;
  this.left = left === undefined ? null : left;
  this.right = right === undefined ? null : right;
}

function buildTree(values) {
  if (!values || values.length === 0) return null;
  const nodes = values.map((v) => (v === null ? null : new TreeNode(v)));
  const kids = nodes.slice().reverse();
  const root = kids.pop();
  for (const node of nodes) {
    if (node) {
      if (kids.length) node.left = kids.pop();
      if (kids.length) node.right = kids.pop();
    }
  }
  return root;
}

const format = (value) => {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const jsonable = (value) => (value === undefined ? null : JSON.parse(JSON.stringify(value instanceof Set ? [...value] : value) ?? "null"));

const errorText = (err) => (err && err.name ? `${err.name}: ${err.message}` : String(err));

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "init") {
    if (LANGUAGE === "typescript" && !self.ts) {
      try {
        importScripts(TYPESCRIPT_URL);
      } catch (err) {
        self.postMessage({ type: "ready", error: `Couldn't load TypeScript: ${err}` });
        return;
      }
    }
    self.postMessage({ type: "ready" });
    return;
  }
  if (message.type !== "run") return;

  const { id, code, harness } = message;
  const logs = [];
  const sandboxConsole = {
    log: (...args) => logs.push(args.map(format).join(" ")),
    info: (...args) => logs.push(args.map(format).join(" ")),
    warn: (...args) => logs.push(args.map(format).join(" ")),
    error: (...args) => logs.push(args.map(format).join(" ")),
  };
  const results = [];
  let error = null;

  try {
    const entry = harness && harness.entry;
    // entry comes from our own coding specs, never from candidate input.
    const lookup = entry ? `return typeof ${entry} === "undefined" ? undefined : ${entry};` : "return undefined;";
    const source = LANGUAGE === "typescript" ? transpile(code) : code;
    const program = new Function("console", "TreeNode", `"use strict";\n${source}\n;${lookup}`);
    const target = program(sandboxConsole, TreeNode);

    if (harness) {
      if (typeof target !== "function") {
        throw new ReferenceError(`Define a ${harness.mode === "class" ? "class" : "function"} named ${entry}`);
      }
      const types = harness.argTypes || [];
      for (const test of harness.tests) {
        try {
          let out;
          if (harness.mode === "class") {
            const [ops, args] = test.args;
            const instance = new target(...args[0]);
            out = [null];
            for (let i = 1; i < ops.length; i++) out.push(instance[ops[i]](...args[i]));
          } else {
            const callArgs = test.args.map((arg, i) => ((types[i] || "json") === "tree" ? buildTree(arg) : arg));
            out = target(...callArgs);
          }
          results.push({ ok: true, value: jsonable(out) });
        } catch (err) {
          results.push({ ok: false, error: errorText(err) });
        }
      }
    }
  } catch (err) {
    error = errorText(err);
  }

  self.postMessage({ type: "result", id, results, stdout: logs.join("\n").slice(-4000), error });
};
