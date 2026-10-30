// Runs candidate Python code in the browser with Pyodide.
// Messages in:  { type: "init" } | { type: "run", id, code, harness }
// Messages out: { type: "ready" } | { type: "result", id, results, stdout, error }
// harness: null (just run the code) or { mode, entry, argTypes, tests: [{ args }] }

// Pinned: 314.x fails to load via importScripts in current Chrome.
importScripts("https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js");

const pyodideReady = loadPyodide();

const HARNESS = `
import io, json, sys, traceback

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val, self.left, self.right = val, left, right

def __build_tree(values):
    if not values:
        return None
    nodes = [None if v is None else TreeNode(v) for v in values]
    kids = nodes[::-1]
    root = kids.pop()
    for node in nodes:
        if node:
            if kids: node.left = kids.pop()
            if kids: node.right = kids.pop()
    return root

def __jsonable(value):
    return json.loads(json.dumps(value, default=lambda o: list(o) if isinstance(o, (set, tuple)) else str(o)))

__buffer = io.StringIO()
__stdout = sys.stdout
sys.stdout = __buffer
__result = {"results": [], "error": None}
try:
    __ns = {"TreeNode": TreeNode, "__name__": "__main__"}
    exec(compile(__user_code, "solution.py", "exec"), __ns)
    __h = json.loads(__harness_json)
    if __h:
        __entry = __h["entry"]
        if __entry not in __ns:
            kind = "class" if __h["mode"] == "class" else "function"
            raise NameError(f"Define a {kind} named {__entry}")
        __types = __h.get("argTypes") or []
        for __test in __h["tests"]:
            try:
                if __h["mode"] == "class":
                    __ops, __args = __test["args"]
                    __obj = __ns[__entry](*__args[0])
                    __out = [None]
                    for __op, __a in zip(__ops[1:], __args[1:]):
                        __out.append(getattr(__obj, __op)(*__a))
                else:
                    __call_args = [
                        __build_tree(a) if (__types[i] if i < len(__types) else "json") == "tree" else a
                        for i, a in enumerate(__test["args"])
                    ]
                    __out = __ns[__entry](*__call_args)
                __result["results"].append({"ok": True, "value": __jsonable(__out)})
            except Exception as __e:
                __result["results"].append({"ok": False, "error": f"{type(__e).__name__}: {__e}"})
except Exception:
    __result["error"] = traceback.format_exc(limit=-1).strip()
finally:
    sys.stdout = __stdout
__result["stdout"] = __buffer.getvalue()[-4000:]
json.dumps(__result)
`;

self.onmessage = async (event) => {
  const message = event.data;
  if (message.type === "init") {
    try {
      await pyodideReady;
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "ready", error: `Couldn't load Python: ${err}` });
    }
    return;
  }
  if (message.type !== "run") return;
  const { id, code, harness } = message;
  try {
    const pyodide = await pyodideReady;
    pyodide.globals.set("__user_code", code);
    pyodide.globals.set("__harness_json", JSON.stringify(harness ?? null));
    const output = await pyodide.runPythonAsync(HARNESS);
    self.postMessage({ type: "result", id, ...JSON.parse(output) });
  } catch (err) {
    self.postMessage({ type: "result", id, results: [], stdout: "", error: String(err) });
  }
};
