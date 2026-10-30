/** Shared types for the coding editor and the system design whiteboard. */

export const CODE_LANGUAGES = ["python", "javascript", "java", "cpp"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  python: "Python",
  javascript: "JavaScript",
  java: "Java",
  cpp: "C++",
};

/** Languages that compile and run on the server (the local runner) rather than in the browser. */
export const NATIVE_LANGUAGES: readonly CodeLanguage[] = ["java", "cpp"];

/** Value types for generating Java and C++ test drivers. */
export const VALUE_TYPES = ["int", "int[]", "int[][]", "string", "bool", "tree", "void"] as const;
export type ValueType = (typeof VALUE_TYPES)[number];

export interface Signature {
  params: ValueType[];
  returns: ValueType;
}

export interface CodingTest {
  /** Function mode: the arguments. Class mode: [operations, argumentsPerOperation], LeetCode style. */
  args: unknown[];
  expected: unknown;
  /** Hidden tests report pass/fail only, like CodeSignal. */
  hidden?: boolean;
}

/** How to run a bank problem's tests. Tailored questions have none and run code without tests. */
export interface CodingSpec {
  /** "function": call the entry with each test's args. "class": construct the entry class, then call methods. */
  mode: "function" | "class";
  /** Function or class name per language. */
  entry: Record<CodeLanguage, string>;
  /** One per argument; "tree" turns a level-order array (with nulls) into TreeNode objects. Default "json". */
  argTypes?: ("json" | "tree")[];
  /**
   * Static types for Java and C++. Function mode: the method's signature (a
   * method on class Solution). Class mode: the constructor's and each method's.
   */
  types: Signature | { constructor: ValueType[]; methods: Record<string, Signature> };
  /** Input/output format, shown above the editor. */
  signature: string;
  starter: Record<CodeLanguage, string>;
  /** "unordered" accepts any ordering of the top-level array (e.g. indices or intervals in any order). */
  compare: "exact" | "unordered";
  tests: CodingTest[];
}

/** The candidate's code (and latest test run) as the interviewer sees it. */
export interface CodeSnapshot {
  kind: "code";
  questionId: string;
  language: CodeLanguage;
  code: string;
  /** Plain-text summary of the latest test run, if any. */
  run?: string;
}

/** The candidate's whiteboard and notes as the interviewer sees them. */
export interface DesignSnapshot {
  kind: "design";
  notes: string;
  /** Text summary of the diagram: components, connections, and free text. */
  diagram: string;
  /** JPEG of the diagram, base64 without a data: prefix. */
  image?: string;
}

export type WorkspaceSnapshot = CodeSnapshot | DesignSnapshot;
