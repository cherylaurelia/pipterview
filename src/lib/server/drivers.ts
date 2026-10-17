import type { CodingSpec, Signature, ValueType } from "../workspace/types";

/**
 * Generates Java and C++ test drivers for a coding spec. Each test prints one
 * line, `@@RESULT@@ {"ok":true,"value":…}` or `{"ok":false,"error":"…"}`, so
 * results can be told apart from the candidate's own prints. Test values are
 * written into the driver as typed literals.
 */
export const RESULT_MARKER = "@@RESULT@@";

type ClassTypes = { constructor: ValueType[]; methods: Record<string, Signature> };
const isClassTypes = (t: CodingSpec["types"]): t is ClassTypes => "methods" in t;

const int = (v: unknown) => {
  if (typeof v !== "number" || !Number.isInteger(v)) throw new Error(`Expected an integer test value, got ${JSON.stringify(v)}`);
  return String(v);
};
const ints = (v: unknown) => {
  if (!Array.isArray(v)) throw new Error(`Expected an array test value, got ${JSON.stringify(v)}`);
  return v.map(int).join(", ");
};
const grid = (v: unknown, open: string) => {
  if (!Array.isArray(v)) throw new Error(`Expected a 2D array test value, got ${JSON.stringify(v)}`);
  return v.map((row) => `${open}${ints(row)}}`).join(", ");
};
const str = (v: unknown) => {
  if (typeof v !== "string") throw new Error(`Expected a string test value, got ${JSON.stringify(v)}`);
  return JSON.stringify(v); // JSON escapes are valid Java and C++ string escapes for these inputs
};
const treeValues = (v: unknown, nullToken: string) => {
  if (!Array.isArray(v)) throw new Error(`Expected a level-order tree, got ${JSON.stringify(v)}`);
  return v.map((x) => (x === null ? nullToken : int(x))).join(", ");
};

// ---------- Java ----------

function javaType(t: ValueType) {
  return { int: "int", "int[]": "int[]", "int[][]": "int[][]", string: "String", bool: "boolean", tree: "TreeNode", void: "void" }[t];
}

function javaLiteral(v: unknown, t: ValueType): string {
  switch (t) {
    case "int":
      return int(v);
    case "bool":
      return v ? "true" : "false";
    case "string":
      return str(v);
    case "int[]":
      return `new int[]{${ints(v)}}`;
    case "int[][]":
      return `new int[][]{${grid(v, "{")}}`;
    case "tree":
      return `TreeNode.build(new Integer[]{${treeValues(v, "null")}})`;
    case "void":
      throw new Error("void has no literal");
  }
}

export const JAVA_TREE_NODE = `public class TreeNode {
    public int val;
    public TreeNode left, right;
    public TreeNode() {}
    public TreeNode(int val) { this.val = val; }
    public TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }

    /** Builds a tree from a level-order list with nulls, LeetCode style. */
    static TreeNode build(Integer[] values) {
        if (values.length == 0 || values[0] == null) return null;
        java.util.List<TreeNode> nodes = new java.util.ArrayList<>();
        for (Integer v : values) nodes.add(v == null ? null : new TreeNode(v));
        java.util.Deque<TreeNode> kids = new java.util.ArrayDeque<>();
        for (int i = nodes.size() - 1; i >= 0; i--) kids.push(nodes.get(i) == null ? NULL : nodes.get(i));
        TreeNode root = unwrap(kids.pop());
        for (TreeNode node : nodes) {
            if (node == null) continue;
            if (!kids.isEmpty()) node.left = unwrap(kids.pop());
            if (!kids.isEmpty()) node.right = unwrap(kids.pop());
        }
        return root;
    }
    private static final TreeNode NULL = new TreeNode();
    private static TreeNode unwrap(TreeNode n) { return n == NULL ? null : n; }
}
`;

const JAVA_HELPERS = `
    static String q(String s) {
        StringBuilder b = new StringBuilder("\\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\\\') b.append('\\\\').append(c);
            else if (c < 0x20) b.append(String.format("\\\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }
    static String j(int v) { return Integer.toString(v); }
    static String j(boolean v) { return v ? "true" : "false"; }
    static String j(String v) { return v == null ? "null" : q(v); }
    static String j(int[] v) {
        if (v == null) return "null";
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) b.append(i > 0 ? "," : "").append(v[i]);
        return b.append(']').toString();
    }
    static String j(int[][] v) {
        if (v == null) return "null";
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; i < v.length; i++) b.append(i > 0 ? "," : "").append(j(v[i]));
        return b.append(']').toString();
    }
    static void ok(String json) { System.out.print("\\n${RESULT_MARKER} {\\"ok\\":true,\\"value\\":" + json + "}\\n"); }
    static void fail(Throwable t) {
        String m = t.getClass().getSimpleName() + (t.getMessage() == null ? "" : ": " + t.getMessage());
        System.out.print("\\n${RESULT_MARKER} {\\"ok\\":false,\\"error\\":" + q(m) + "}\\n");
    }
`;

export function javaDriver(spec: CodingSpec): string {
  const entry = spec.entry.java;
  const blocks = spec.tests.map((test, i) => {
    let body: string;
    if (spec.mode === "class") {
      if (!isClassTypes(spec.types)) throw new Error("Class problems need constructor and method types");
      const types = spec.types;
      const [ops, args] = test.args as [string[], unknown[][]];
      const ctorArgs = args[0].map((a, k) => javaLiteral(a, types.constructor[k])).join(", ");
      const lines = [`StringBuilder out = new StringBuilder("[null");`, `${entry} obj = new ${entry}(${ctorArgs});`];
      ops.slice(1).forEach((op, k) => {
        const sig = types.methods[op];
        if (!sig) throw new Error(`No types for method ${op}`);
        const call = `obj.${op}(${args[k + 1].map((a, n) => javaLiteral(a, sig.params[n])).join(", ")})`;
        lines.push(sig.returns === "void" ? `${call}; out.append(",null");` : `out.append(",").append(j(${call}));`);
      });
      lines.push(`ok(out.append("]").toString());`);
      body = lines.join("\n            ");
    } else {
      if (isClassTypes(spec.types)) throw new Error("Function problems need a signature");
      const sig = spec.types;
      const decls = test.args.map((a, k) => `${javaType(sig.params[k])} a${k} = ${javaLiteral(a, sig.params[k])};`);
      const call = `new Solution().${entry}(${test.args.map((_, k) => `a${k}`).join(", ")})`;
      body = [...decls, `ok(j(${call}));`].join("\n            ");
    }
    return `        // Test ${i + 1}\n        try {\n            ${body}\n        } catch (Throwable t) {\n            fail(t);\n        }`;
  });
  return `public class Main {${JAVA_HELPERS}
    public static void main(String[] args) {
${blocks.join("\n")}
        System.out.flush();
    }
}
`;
}

// ---------- C++ ----------

function cppType(t: ValueType) {
  return {
    int: "int",
    "int[]": "vector<int>",
    "int[][]": "vector<vector<int>>",
    string: "string",
    bool: "bool",
    tree: "TreeNode*",
    void: "void",
  }[t];
}

function cppLiteral(v: unknown, t: ValueType): string {
  switch (t) {
    case "int":
      return int(v);
    case "bool":
      return v ? "true" : "false";
    case "string":
      return `string(${str(v)})`;
    case "int[]":
      return `vector<int>{${ints(v)}}`;
    case "int[][]":
      return `vector<vector<int>>{${grid(v, "{")}}`;
    case "tree":
      return `mi_driver::build({${treeValues(v, "nullopt")}})`;
    case "void":
      throw new Error("void has no literal");
  }
}

/** Everything before the candidate's code: headers, TreeNode, and the namespace std convenience. */
export const CPP_PRELUDE = `#include <algorithm>
#include <climits>
#include <cmath>
#include <deque>
#include <functional>
#include <iostream>
#include <list>
#include <map>
#include <numeric>
#include <optional>
#include <queue>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
using namespace std;

struct TreeNode {
    int val;
    TreeNode *left, *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode* l, TreeNode* r) : val(x), left(l), right(r) {}
};
`;

const CPP_HELPERS = `
namespace mi_driver {
string q(const string& s) {
    string b = "\\"";
    for (char c : s) {
        if (c == '"' || c == '\\\\') { b += '\\\\'; b += c; }
        else if (static_cast<unsigned char>(c) < 0x20) { char u[8]; snprintf(u, sizeof u, "\\\\u%04x", c); b += u; }
        else b += c;
    }
    return b + "\\"";
}
string j(int v) { return to_string(v); }
string j(bool v) { return v ? "true" : "false"; }
string j(const string& v) { return q(v); }
string j(const vector<int>& v) {
    string b = "[";
    for (size_t i = 0; i < v.size(); i++) b += (i ? "," : "") + to_string(v[i]);
    return b + "]";
}
string j(const vector<vector<int>>& v) {
    string b = "[";
    for (size_t i = 0; i < v.size(); i++) b += (i ? "," : "") + j(v[i]);
    return b + "]";
}
TreeNode* build(vector<optional<int>> values) {
    if (values.empty() || !values[0]) return nullptr;
    vector<TreeNode*> nodes;
    for (auto& v : values) nodes.push_back(v ? new TreeNode(*v) : nullptr);
    vector<TreeNode*> kids(nodes.rbegin(), nodes.rend());
    TreeNode* root = kids.back(); kids.pop_back();
    for (TreeNode* node : nodes) {
        if (!node) continue;
        if (!kids.empty()) { node->left = kids.back(); kids.pop_back(); }
        if (!kids.empty()) { node->right = kids.back(); kids.pop_back(); }
    }
    return root;
}
void ok(const string& json) { cout << "\\n${RESULT_MARKER} {\\"ok\\":true,\\"value\\":" << json << "}" << endl; }
void fail(const string& message) { cout << "\\n${RESULT_MARKER} {\\"ok\\":false,\\"error\\":" << q(message) << "}" << endl; }
}  // namespace mi_driver
`;

export function cppDriver(spec: CodingSpec): string {
  const entry = spec.entry.cpp;
  const blocks = spec.tests.map((test, i) => {
    let body: string;
    if (spec.mode === "class") {
      if (!isClassTypes(spec.types)) throw new Error("Class problems need constructor and method types");
      const types = spec.types;
      const [ops, args] = test.args as [string[], unknown[][]];
      const ctorArgs = args[0].map((a, k) => cppLiteral(a, types.constructor[k])).join(", ");
      const lines = [`string out = "[null";`, `${entry} obj(${ctorArgs});`];
      ops.slice(1).forEach((op, k) => {
        const sig = types.methods[op];
        if (!sig) throw new Error(`No types for method ${op}`);
        const call = `obj.${op}(${args[k + 1].map((a, n) => cppLiteral(a, sig.params[n])).join(", ")})`;
        lines.push(sig.returns === "void" ? `${call}; out += ",null";` : `out += "," + j(${call});`);
      });
      lines.push(`ok(out + "]");`);
      body = lines.join("\n        ");
    } else {
      if (isClassTypes(spec.types)) throw new Error("Function problems need a signature");
      const sig = spec.types;
      // Named locals so reference parameters (vector<int>&) bind, as on LeetCode.
      const decls = test.args.map((a, k) => `${cppType(sig.params[k])} a${k} = ${cppLiteral(a, sig.params[k])};`);
      const call = `Solution().${entry}(${test.args.map((_, k) => `a${k}`).join(", ")})`;
      body = [...decls, `ok(j(${call}));`].join("\n        ");
    }
    return `    // Test ${i + 1}\n    try {\n        ${body}\n    } catch (const exception& e) {\n        fail(e.what());\n    } catch (...) {\n        fail("unknown exception");\n    }`;
  });
  return `${CPP_HELPERS}
int main() {
    using namespace mi_driver;
${blocks.join("\n")}
    return 0;
}
`;
}
