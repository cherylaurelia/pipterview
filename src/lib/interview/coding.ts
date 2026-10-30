import type { CodeLanguage, CodingSpec } from "../workspace/types";
import { cStarter, typescriptStarter } from "./starters";

/** Languages whose entry names and starters are written by hand; TypeScript and C are derived from them. */
type HandWritten = Exclude<CodeLanguage, "typescript" | "c">;
type HandWrittenSpec = Omit<CodingSpec, "entry" | "starter"> & {
  entry: Record<HandWritten, string>;
  starter: Record<HandWritten, string>;
};

/**
 * Coding specs for the technical bank problems: starter code, tests, and how
 * to compare answers. Visible tests double as examples above the editor.
 * Java and C++ follow LeetCode conventions (a Solution class, or the class
 * itself for design problems); `types` drives their generated test drivers.
 */
const HAND_WRITTEN: Record<string, HandWrittenSpec> = {
  "two-sum": {
    mode: "function",
    entry: { python: "two_sum", javascript: "twoSum", java: "twoSum", cpp: "twoSum" },
    types: { params: ["int[]", "int"], returns: "int[]" },
    signature: "Input: nums (list of integers), target (integer). Output: [i, j], the indices of the two numbers, in any order.",
    starter: {
      python: `def two_sum(nums: list[int], target: int) -> list[int]:\n    # Return the indices of the two numbers that add up to target.\n    pass\n`,
      javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nfunction twoSum(nums, target) {\n  // Return the indices of the two numbers that add up to target.\n}\n`,
      java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Return the indices of the two numbers that add up to target.\n        return new int[0];\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Return the indices of the two numbers that add up to target.\n        return {};\n    }\n};\n`,
    },
    compare: "unordered",
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4], hidden: true },
      { args: [[0, 4, 3, 0], 0], expected: [0, 3], hidden: true },
      { args: [[1, 5, 9, 13, 2], 15], expected: [3, 4], hidden: true },
    ],
  },

  "valid-parentheses": {
    mode: "function",
    entry: { python: "is_valid", javascript: "isValid", java: "isValid", cpp: "isValid" },
    types: { params: ["string"], returns: "bool" },
    signature: "Input: s, a string of the characters ( ) [ ] { }. Output: true if every bracket is closed in the right order.",
    starter: {
      python: `def is_valid(s: str) -> bool:\n    pass\n`,
      javascript: `/**\n * @param {string} s\n * @return {boolean}\n */\nfunction isValid(s) {\n}\n`,
      java: `class Solution {\n    public boolean isValid(String s) {\n        return false;\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    bool isValid(string s) {\n        return false;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      { args: ["()"], expected: true },
      { args: ["()[]{}"], expected: true },
      { args: ["(]"], expected: false },
      { args: ["([)]"], expected: false, hidden: true },
      { args: ["{[]}"], expected: true, hidden: true },
      { args: [""], expected: true, hidden: true },
      { args: ["]"], expected: false, hidden: true },
      { args: ["(("], expected: false, hidden: true },
    ],
  },

  "longest-substring": {
    mode: "function",
    entry: { python: "length_of_longest_substring", javascript: "lengthOfLongestSubstring", java: "lengthOfLongestSubstring", cpp: "lengthOfLongestSubstring" },
    types: { params: ["string"], returns: "int" },
    signature: "Input: s, a string. Output: the length of the longest substring with no repeated characters.",
    starter: {
      python: `def length_of_longest_substring(s: str) -> int:\n    pass\n`,
      javascript: `/**\n * @param {string} s\n * @return {number}\n */\nfunction lengthOfLongestSubstring(s) {\n}\n`,
      java: `class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        return 0;\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        return 0;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      { args: ["abcabcbb"], expected: 3 },
      { args: ["bbbbb"], expected: 1 },
      { args: ["pwwkew"], expected: 3 },
      { args: [""], expected: 0, hidden: true },
      { args: [" "], expected: 1, hidden: true },
      { args: ["dvdf"], expected: 3, hidden: true },
      { args: ["abba"], expected: 2, hidden: true },
      { args: ["tmmzuxt"], expected: 5, hidden: true },
    ],
  },

  "merge-intervals": {
    mode: "function",
    entry: { python: "merge", javascript: "merge", java: "merge", cpp: "merge" },
    types: { params: ["int[][]"], returns: "int[][]" },
    signature: "Input: intervals, a list of [start, end] pairs. Output: the merged intervals, in any order. Touching intervals like [1, 4] and [4, 5] merge.",
    starter: {
      python: `def merge(intervals: list[list[int]]) -> list[list[int]]:\n    pass\n`,
      javascript: `/**\n * @param {number[][]} intervals\n * @return {number[][]}\n */\nfunction merge(intervals) {\n}\n`,
      java: `class Solution {\n    public int[][] merge(int[][] intervals) {\n        return new int[0][];\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> merge(vector<vector<int>>& intervals) {\n        return {};\n    }\n};\n`,
    },
    compare: "unordered",
    tests: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { args: [[[1, 10], [2, 3]]], expected: [[1, 10]], hidden: true },
      { args: [[[5, 6], [1, 2]]], expected: [[1, 2], [5, 6]], hidden: true },
      { args: [[[1, 4], [0, 4]]], expected: [[0, 4]], hidden: true },
      { args: [[[2, 3]]], expected: [[2, 3]], hidden: true },
    ],
  },

  "valid-bst": {
    mode: "function",
    entry: { python: "is_valid_bst", javascript: "isValidBST", java: "isValidBST", cpp: "isValidBST" },
    types: { params: ["tree"], returns: "bool" },
    argTypes: ["tree"],
    signature: "Input: root, a TreeNode with val, left, and right (tests are written as level-order lists with nulls). Output: true if it's a valid binary search tree. Duplicates are not allowed.",
    starter: {
      python: `# A TreeNode is provided:\n# class TreeNode:\n#     def __init__(self, val=0, left=None, right=None):\n#         self.val, self.left, self.right = val, left, right\n\ndef is_valid_bst(root) -> bool:\n    pass\n`,
      javascript: `// A TreeNode is provided:\n// function TreeNode(val, left, right) { this.val = val; this.left = left; this.right = right; }\n\n/**\n * @param {TreeNode} root\n * @return {boolean}\n */\nfunction isValidBST(root) {\n}\n`,
      java: `// A TreeNode is provided:\n// class TreeNode { int val; TreeNode left, right; }\n\nclass Solution {\n    public boolean isValidBST(TreeNode root) {\n        return false;\n    }\n}\n`,
      cpp: `// A TreeNode is provided:\n// struct TreeNode { int val; TreeNode *left, *right; };\n\nclass Solution {\npublic:\n    bool isValidBST(TreeNode* root) {\n        return false;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      { args: [[2, 1, 3]], expected: true },
      { args: [[5, 1, 4, null, null, 3, 6]], expected: false },
      { args: [[5, 3, 8, null, 6]], expected: false, hidden: true },
      { args: [[10, 5, 15, null, null, 6, 20]], expected: false, hidden: true },
      { args: [[1, 1]], expected: false, hidden: true },
      { args: [[2147483647]], expected: true, hidden: true },
      { args: [[]], expected: true, hidden: true },
    ],
  },

  "number-of-islands": {
    mode: "function",
    entry: { python: "num_islands", javascript: "numIslands", java: "numIslands", cpp: "numIslands" },
    types: { params: ["int[][]"], returns: "int" },
    signature: "Input: grid, a list of rows of 1 (land) and 0 (water). Output: the number of islands. Diagonal cells are not connected.",
    starter: {
      python: `def num_islands(grid: list[list[int]]) -> int:\n    pass\n`,
      javascript: `/**\n * @param {number[][]} grid\n * @return {number}\n */\nfunction numIslands(grid) {\n}\n`,
      java: `class Solution {\n    public int numIslands(int[][] grid) {\n        return 0;\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    int numIslands(vector<vector<int>>& grid) {\n        return 0;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      { args: [[[1, 1, 0, 0, 0], [1, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 1]]], expected: 3 },
      { args: [[[1, 1, 1], [0, 1, 0], [1, 1, 1]]], expected: 1 },
      { args: [[[0]]], expected: 0, hidden: true },
      { args: [[[1, 0, 1, 0, 1]]], expected: 3, hidden: true },
      { args: [[[1], [1], [0], [1]]], expected: 2, hidden: true },
      { args: [[[1, 0], [0, 1]]], expected: 2, hidden: true },
    ],
  },

  "top-k-frequent": {
    mode: "function",
    entry: { python: "top_k_frequent", javascript: "topKFrequent", java: "topKFrequent", cpp: "topKFrequent" },
    types: { params: ["int[]", "int"], returns: "int[]" },
    signature: "Input: nums (list of integers), k (integer). Output: the k most frequent values, in any order. The answer is unique.",
    starter: {
      python: `def top_k_frequent(nums: list[int], k: int) -> list[int]:\n    pass\n`,
      javascript: `/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number[]}\n */\nfunction topKFrequent(nums, k) {\n}\n`,
      java: `class Solution {\n    public int[] topKFrequent(int[] nums, int k) {\n        return new int[0];\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    vector<int> topKFrequent(vector<int>& nums, int k) {\n        return {};\n    }\n};\n`,
    },
    compare: "unordered",
    tests: [
      { args: [[1, 1, 1, 2, 2, 3], 2], expected: [1, 2] },
      { args: [[1], 1], expected: [1] },
      { args: [[4, 4, 4, 5, 5, 6, 6, 6, 6], 2], expected: [6, 4], hidden: true },
      { args: [[-1, -1, 2], 1], expected: [-1], hidden: true },
      { args: [[5, 3, 5, 3, 5, 1], 2], expected: [5, 3], hidden: true },
    ],
  },

  "lru-cache": {
    mode: "class",
    entry: { python: "LRUCache", javascript: "LRUCache", java: "LRUCache", cpp: "LRUCache" },
    types: {
      constructor: ["int"],
      methods: { get: { params: ["int"], returns: "int" }, put: { params: ["int", "int"], returns: "void" } },
    },
    signature: "Implement LRUCache(capacity) with get(key), which returns the value or -1, and put(key, value), which evicts the least recently used key when over capacity. Tests list operations and their arguments.",
    starter: {
      python: `class LRUCache:\n    def __init__(self, capacity: int):\n        pass\n\n    def get(self, key: int) -> int:\n        # Return the value, or -1 if the key isn't present.\n        pass\n\n    def put(self, key: int, value: int) -> None:\n        pass\n`,
      javascript: `class LRUCache {\n  /** @param {number} capacity */\n  constructor(capacity) {\n  }\n\n  /** @return {number} the value, or -1 if the key isn't present */\n  get(key) {\n  }\n\n  put(key, value) {\n  }\n}\n`,
      java: `class LRUCache {\n    public LRUCache(int capacity) {\n    }\n\n    public int get(int key) {\n        // Return the value, or -1 if the key isn't present.\n        return -1;\n    }\n\n    public void put(int key, int value) {\n    }\n}\n`,
      cpp: `class LRUCache {\npublic:\n    LRUCache(int capacity) {\n    }\n\n    int get(int key) {\n        // Return the value, or -1 if the key isn't present.\n        return -1;\n    }\n\n    void put(int key, int value) {\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      {
        args: [
          ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
          [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]],
        ],
        expected: [null, null, null, 1, null, -1, null, -1, 3, 4],
      },
      {
        args: [
          ["LRUCache", "put", "get", "put", "get", "get"],
          [[1], [2, 1], [2], [3, 2], [2], [3]],
        ],
        expected: [null, null, 1, null, -1, 2],
        hidden: true,
      },
      {
        args: [
          ["LRUCache", "put", "put", "put", "get", "put", "get", "get"],
          [[2], [1, 1], [2, 2], [1, 10], [1], [3, 3], [2], [1]],
        ],
        expected: [null, null, null, null, 10, null, -1, 10],
        hidden: true,
      },
    ],
  },

  "best-time-stock": {
    mode: "function",
    entry: { python: "max_profit", javascript: "maxProfit", java: "maxProfit", cpp: "maxProfit" },
    types: { params: ["int[]"], returns: "int" },
    signature: "Input: prices, a list of integers (one per day). Output: the maximum profit from one buy followed by one later sell, or 0.",
    starter: {
      python: `def max_profit(prices: list[int]) -> int:\n    pass\n`,
      javascript: `/**\n * @param {number[]} prices\n * @return {number}\n */\nfunction maxProfit(prices) {\n}\n`,
      java: `class Solution {\n    public int maxProfit(int[] prices) {\n        return 0;\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    int maxProfit(vector<int>& prices) {\n        return 0;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      {args:  [[7,  1,  5,  3,  6,  4]],  expected:  5},
      {args:  [[7,  6,  4,  3,  1]],  expected:  0},
      {args:  [[2,  4,  1]],  expected:  2},
      {args:  [[1]],  expected:  0,  hidden:  true},
      {args:  [[3,  3,  3]],  expected:  0,  hidden:  true},
      {args:  [[2,  1,  2,  1,  0,  1,  2]],  expected:  2,  hidden:  true},
      {args:  [[1,  2,  3,  4,  5]],  expected:  4,  hidden:  true},
    ],
  },
  "climbing-stairs": {
    mode: "function",
    entry: { python: "climb_stairs", javascript: "climbStairs", java: "climbStairs", cpp: "climbStairs" },
    types: { params: ["int"], returns: "int" },
    signature: "Input: n, the number of steps (1 or more). Output: the number of distinct ways to reach the top taking 1 or 2 steps at a time.",
    starter: {
      python: `def climb_stairs(n: int) -> int:\n    pass\n`,
      javascript: `/**\n * @param {number} n\n * @return {number}\n */\nfunction climbStairs(n) {\n}\n`,
      java: `class Solution {\n    public int climbStairs(int n) {\n        return 0;\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    int climbStairs(int n) {\n        return 0;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      {args:  [2],  expected:  2},
      {args:  [3],  expected:  3},
      {args:  [5],  expected:  8},
      {args:  [1],  expected:  1,  hidden:  true},
      {args:  [4],  expected:  5,  hidden:  true},
      {args:  [10],  expected:  89,  hidden:  true},
      {args:  [30],  expected:  1346269,  hidden:  true},
    ],
  },
  "product-except-self": {
    mode: "function",
    entry: { python: "product_except_self", javascript: "productExceptSelf", java: "productExceptSelf", cpp: "productExceptSelf" },
    types: { params: ["int[]"], returns: "int[]" },
    signature: "Input: nums, a list of integers. Output: a list where position i is the product of every number except nums[i]. Don't use division.",
    starter: {
      python: `def product_except_self(nums: list[int]) -> list[int]:\n    pass\n`,
      javascript: `/**\n * @param {number[]} nums\n * @return {number[]}\n */\nfunction productExceptSelf(nums) {\n}\n`,
      java: `class Solution {\n    public int[] productExceptSelf(int[] nums) {\n        return new int[0];\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    vector<int> productExceptSelf(vector<int>& nums) {\n        return {};\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      {args:  [[1,  2,  3,  4]],  expected:  [24,  12,  8,  6]},
      {args:  [[-1,  1,  0,  -3,  3]],  expected:  [0,  0,  9,  0,  0]},
      {args:  [[2,  3]],  expected:  [3,  2],  hidden:  true},
      {args:  [[0,  0]],  expected:  [0,  0],  hidden:  true},
      {args:  [[5,  1,  1]],  expected:  [1,  5,  5],  hidden:  true},
      {args:  [[1,  -1,  2,  -2]],  expected:  [4,  -4,  2,  -2],  hidden:  true},
    ],
  },
  "search-rotated": {
    mode: "function",
    entry: { python: "search", javascript: "search", java: "search", cpp: "search" },
    types: { params: ["int[]", "int"], returns: "int" },
    signature: "Input: nums, a rotated sorted list of distinct integers, and target. Output: the index of target, or -1. Aim for O(log n).",
    starter: {
      python: `def search(nums: list[int], target: int) -> int:\n    pass\n`,
      javascript: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number}\n */\nfunction search(nums, target) {\n}\n`,
      java: `class Solution {\n    public int search(int[] nums, int target) {\n        return 0;\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    int search(vector<int>& nums, int target) {\n        return 0;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      {args:  [[4,  5,  6,  7,  0,  1,  2],  0],  expected:  4},
      {args:  [[4,  5,  6,  7,  0,  1,  2],  3],  expected:  -1},
      {args:  [[1],  0],  expected:  -1},
      {args:  [[1],  1],  expected:  0,  hidden:  true},
      {args:  [[3,  1],  1],  expected:  1,  hidden:  true},
      {args:  [[5,  1,  3],  5],  expected:  0,  hidden:  true},
      {args:  [[1,  2,  3,  4,  5],  4],  expected:  3,  hidden:  true},
      {args:  [[6,  7,  1,  2,  3,  4,  5],  7],  expected:  1,  hidden:  true},
    ],
  },
  "kth-largest": {
    mode: "function",
    entry: { python: "find_kth_largest", javascript: "findKthLargest", java: "findKthLargest", cpp: "findKthLargest" },
    types: { params: ["int[]", "int"], returns: "int" },
    signature: "Input: nums, a list of integers, and k (1 \u2264 k \u2264 length). Output: the k-th largest value, counting duplicates separately.",
    starter: {
      python: `def find_kth_largest(nums: list[int], k: int) -> int:\n    pass\n`,
      javascript: `/**\n * @param {number[]} nums\n * @param {number} k\n * @return {number}\n */\nfunction findKthLargest(nums, k) {\n}\n`,
      java: `class Solution {\n    public int findKthLargest(int[] nums, int k) {\n        return 0;\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    int findKthLargest(vector<int>& nums, int k) {\n        return 0;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      {args:  [[3,  2,  1,  5,  6,  4],  2],  expected:  5},
      {args:  [[3,  2,  3,  1,  2,  4,  5,  5,  6],  4],  expected:  4},
      {args:  [[1],  1],  expected:  1,  hidden:  true},
      {args:  [[2,  1],  2],  expected:  1,  hidden:  true},
      {args:  [[-1,  -1],  2],  expected:  -1,  hidden:  true},
      {args:  [[7,  6,  5,  4,  3,  2,  1],  5],  expected:  3,  hidden:  true},
    ],
  },
  "daily-temperatures": {
    mode: "function",
    entry: { python: "daily_temperatures", javascript: "dailyTemperatures", java: "dailyTemperatures", cpp: "dailyTemperatures" },
    types: { params: ["int[]"], returns: "int[]" },
    signature: "Input: temperatures, a list of integers. Output: for each day, the number of days until a strictly warmer one, or 0.",
    starter: {
      python: `def daily_temperatures(temperatures: list[int]) -> list[int]:\n    pass\n`,
      javascript: `/**\n * @param {number[]} temperatures\n * @return {number[]}\n */\nfunction dailyTemperatures(temperatures) {\n}\n`,
      java: `class Solution {\n    public int[] dailyTemperatures(int[] temperatures) {\n        return new int[0];\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    vector<int> dailyTemperatures(vector<int>& temperatures) {\n        return {};\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      {args:  [[73,  74,  75,  71,  69,  72,  76,  73]],  expected:  [1,  1,  4,  2,  1,  1,  0,  0]},
      {args:  [[30,  40,  50,  60]],  expected:  [1,  1,  1,  0]},
      {args:  [[30,  60,  90]],  expected:  [1,  1,  0]},
      {args:  [[90,  80,  70]],  expected:  [0,  0,  0],  hidden:  true},
      {args:  [[50]],  expected:  [0],  hidden:  true},
      {args:  [[70,  70,  71]],  expected:  [2,  1,  0],  hidden:  true},
      {args:  [[55,  38,  53,  81,  61,  93,  97,  32,  43,  78]],  expected:  [3,  1,  1,  2,  1,  1,  0,  1,  1,  0],  hidden:  true},
    ],
  },
  "course-schedule": {
    mode: "function",
    entry: { python: "can_finish", javascript: "canFinish", java: "canFinish", cpp: "canFinish" },
    types: { params: ["int", "int[][]"], returns: "bool" },
    signature: "Input: numCourses, and prerequisites as [a, b] pairs meaning course b must come before course a. Output: true if every course can be finished.",
    starter: {
      python: `def can_finish(num_courses: int, prerequisites: list[list[int]]) -> bool:\n    pass\n`,
      javascript: `/**\n * @param {number} numCourses\n * @param {number[][]} prerequisites\n * @return {boolean}\n */\nfunction canFinish(numCourses, prerequisites) {\n}\n`,
      java: `class Solution {\n    public boolean canFinish(int numCourses, int[][] prerequisites) {\n        return false;\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {\n        return false;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      {args:  [2,  [[1,  0]]],  expected:  true},
      {args:  [2,  [[1,  0],  [0,  1]]],  expected:  false},
      {args:  [1,  []],  expected:  true,  hidden:  true},
      {args:  [3,  [[1,  0],  [2,  1]]],  expected:  true,  hidden:  true},
      {args:  [3,  [[0,  1],  [1,  2],  [2,  0]]],  expected:  false,  hidden:  true},
      {args:  [4,  [[1,  0],  [2,  0],  [3,  1],  [3,  2]]],  expected:  true,  hidden:  true},
      {args:  [5,  [[1,  4],  [2,  4],  [3,  1],  [3,  2]]],  expected:  true,  hidden:  true},
    ],
  },
  "coin-change": {
    mode: "function",
    entry: { python: "coin_change", javascript: "coinChange", java: "coinChange", cpp: "coinChange" },
    types: { params: ["int[]", "int"], returns: "int" },
    signature: "Input: coins, a list of positive denominations, and amount (0 or more). Output: the fewest coins that make amount, or -1 if impossible.",
    starter: {
      python: `def coin_change(coins: list[int], amount: int) -> int:\n    pass\n`,
      javascript: `/**\n * @param {number[]} coins\n * @param {number} amount\n * @return {number}\n */\nfunction coinChange(coins, amount) {\n}\n`,
      java: `class Solution {\n    public int coinChange(int[] coins, int amount) {\n        return 0;\n    }\n}\n`,
      cpp: `class Solution {\npublic:\n    int coinChange(vector<int>& coins, int amount) {\n        return 0;\n    }\n};\n`,
    },
    compare: "exact",
    tests: [
      {args:  [[1,  2,  5],  11],  expected:  3},
      {args:  [[2],  3],  expected:  -1},
      {args:  [[1],  0],  expected:  0},
      {args:  [[1,  3,  4],  6],  expected:  2,  hidden:  true},
      {args:  [[2,  5,  10,  1],  27],  expected:  4,  hidden:  true},
      {args:  [[186,  419,  83,  408],  6249],  expected:  20,  hidden:  true},
      {args:  [[3,  7],  5],  expected:  -1,  hidden:  true},
    ],
  },
};

/** TypeScript uses the JavaScript names; C uses the C++ names, LeetCode style. */
function complete(spec: HandWrittenSpec): CodingSpec {
  const withEntries = {
    ...spec,
    entry: { ...spec.entry, typescript: spec.entry.javascript, c: spec.entry.cpp },
    starter: { ...spec.starter, typescript: "", c: "" },
  };
  return { ...withEntries, starter: { ...spec.starter, typescript: typescriptStarter(withEntries), c: cStarter(withEntries) } };
}

export const CODING_SPECS: Record<string, CodingSpec> = Object.fromEntries(
  Object.entries(HAND_WRITTEN).map(([id, spec]) => [id, complete(spec)]),
);
