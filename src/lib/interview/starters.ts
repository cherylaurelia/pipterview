import type { CodingSpec, Signature, ValueType } from "../workspace/types";

/**
 * Generates TypeScript and C starter code from a problem's types, so new
 * languages don't need hand-written starters for every problem. Parameter
 * names are read from the JavaScript starter. C follows LeetCode's
 * conventions: arrays come with sizes, returned arrays report their size
 * through returnSize, and design problems are a struct plus Create/…/Free.
 */

type ClassTypes = { constructor: ValueType[]; methods: Record<string, Signature> };
export const isClassTypes = (t: CodingSpec["types"]): t is ClassTypes => "methods" in t;

const TS_TYPE: Record<ValueType, string> = {
  int: "number",
  "int[]": "number[]",
  "int[][]": "number[][]",
  string: "string",
  bool: "boolean",
  tree: "TreeNode | null",
  void: "void",
};

/** Parameter names from the JavaScript starter: `function name(a, b)` or `method(a, b) {`. */
function paramNames(jsStarter: string, name: string): string[] {
  const match = new RegExp(`(?:function\\s+)?\\b${name}\\s*\\(([^)]*)\\)`).exec(jsStarter);
  return match ? match[1].split(",").map((p) => p.trim()).filter(Boolean) : [];
}

/** LeetCode's C prefix for a design class: LRUCache → lRUCache. */
export const cPrefix = (className: string) => className.charAt(0).toLowerCase() + className.slice(1);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function typescriptStarter(spec: CodingSpec): string {
  const js = spec.starter.javascript;
  const treeNote = JSON.stringify(spec.types).includes('"tree"')
    ? "// A TreeNode is provided:\n// class TreeNode { val: number; left: TreeNode | null; right: TreeNode | null }\n\n"
    : "";
  const entry = spec.entry.javascript;
  if (isClassTypes(spec.types)) {
    const ctorNames = paramNames(js, "constructor");
    const ctor = spec.types.constructor.map((t, i) => `${ctorNames[i] ?? `arg${i}`}: ${TS_TYPE[t]}`).join(", ");
    const methods = Object.entries(spec.types.methods).map(([method, sig]) => {
      const names = paramNames(js, method);
      const params = sig.params.map((t, i) => `${names[i] ?? `arg${i}`}: ${TS_TYPE[t]}`).join(", ");
      return `    ${method}(${params}): ${TS_TYPE[sig.returns]} {\n    }`;
    });
    return `${treeNote}class ${entry} {\n    constructor(${ctor}) {\n    }\n\n${methods.join("\n\n")}\n}\n`;
  }
  const names = paramNames(js, entry);
  const params = spec.types.params.map((t, i) => `${names[i] ?? `arg${i}`}: ${TS_TYPE[t]}`).join(", ");
  return `${treeNote}function ${entry}(${params}): ${TS_TYPE[spec.types.returns]} {\n}\n`;
}

/** One C parameter, expanded the LeetCode way (arrays carry their sizes). */
function cParam(type: ValueType, name: string): string {
  switch (type) {
    case "int":
      return `int ${name}`;
    case "bool":
      return `bool ${name}`;
    case "string":
      return `char* ${name}`;
    case "int[]":
      return `int* ${name}, int ${name}Size`;
    case "int[][]":
      return `int** ${name}, int ${name}Size, int* ${name}ColSize`;
    case "tree":
      return `struct TreeNode* ${name}`;
    case "void":
      throw new Error("void parameter");
  }
}

const C_RETURN: Record<ValueType, string> = {
  int: "int",
  bool: "bool",
  "int[]": "int*",
  "int[][]": "int**",
  string: "char*",
  tree: "struct TreeNode*",
  void: "void",
};

/** Out-parameters a C function needs for its return type. */
export function cReturnParams(type: ValueType): string[] {
  if (type === "int[]") return ["int* returnSize"];
  if (type === "int[][]") return ["int* returnSize", "int** returnColumnSizes"];
  return [];
}

const C_DEFAULT_BODY: Record<ValueType, string> = {
  int: "    return 0;",
  bool: "    return false;",
  "int[]": "    *returnSize = 0;\n    return NULL;",
  "int[][]": "    *returnSize = 0;\n    *returnColumnSizes = NULL;\n    return NULL;",
  string: "    return NULL;",
  tree: "    return NULL;",
  void: "",
};

export function cStarter(spec: CodingSpec): string {
  const js = spec.starter.javascript;
  const treeNote = JSON.stringify(spec.types).includes('"tree"')
    ? "// A TreeNode is provided:\n// struct TreeNode { int val; struct TreeNode *left; struct TreeNode *right; };\n\n"
    : "";
  if (isClassTypes(spec.types)) {
    const name = spec.entry.c;
    const prefix = cPrefix(name);
    const ctorNames = paramNames(js, "constructor");
    const ctor = spec.types.constructor.map((t, i) => cParam(t, ctorNames[i] ?? `arg${i}`)).join(", ");
    const methods = Object.entries(spec.types.methods).map(([method, sig]) => {
      const names = paramNames(js, method);
      const params = [`${name}* obj`, ...sig.params.map((t, i) => cParam(t, names[i] ?? `arg${i}`)), ...cReturnParams(sig.returns)].join(", ");
      const body = C_DEFAULT_BODY[sig.returns];
      return `${C_RETURN[sig.returns]} ${prefix}${capitalize(method)}(${params}) {\n${body ? `${body}\n` : ""}}`;
    });
    return `${treeNote}typedef struct {\n    int capacity;  // add your fields\n} ${name};\n\n${name}* ${prefix}Create(${ctor}) {\n    ${name}* obj = malloc(sizeof(${name}));\n    return obj;\n}\n\n${methods.join("\n\n")}\n\nvoid ${prefix}Free(${name}* obj) {\n    free(obj);\n}\n`;
  }
  const entry = spec.entry.c;
  const names = paramNames(js, spec.entry.javascript);
  const params = [...spec.types.params.map((t, i) => cParam(t, names[i] ?? `arg${i}`)), ...cReturnParams(spec.types.returns)].join(", ");
  const note = spec.types.returns === "int[]" || spec.types.returns === "int[][]" ? "/**\n * Return an array allocated with malloc; set *returnSize (and *returnColumnSizes for each row).\n */\n" : "";
  return `${treeNote}${note}${C_RETURN[spec.types.returns]} ${entry}(${params}) {\n${C_DEFAULT_BODY[spec.types.returns]}\n}\n`;
}
