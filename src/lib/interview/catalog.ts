import { CODING_SPECS } from "./coding";
import type { InterviewType, InterviewTypeId, RoleId, RubricDimension } from "./types";

/**
 * Interview types, question banks, and rubrics. Everything the interviewer
 * knows about a round lives here, so adding or reshaping a category is a data
 * change, not a code change.
 *
 * Writing a good question: the prompt must work out loud (no diagrams, no
 * syntax to read back). The depth is in the rest: what a strong answer
 * covers, a follow-up ladder that escalates, a hint ladder from nudge to big
 * hint, and the mistakes worth probing. That's what makes the interviewer
 * behave like a real one.
 */

export const ROLES: Record<RoleId, string> = {
  swe: "Software Engineer",
  pm: "Product Manager",
  data: "Data Scientist / Analyst",
  fde: "Forward Deployed Engineer",
  other: "Other tech role",
};

const BEHAVIORAL_HINTS = [
  "It can be from a class project, internship, club, hackathon, research, or a part-time job.",
  "Try one or two sentences of context, then spend most of your answer on what you personally did.",
  "End with the result: what changed because of what you did, and what you'd do differently.",
];

export const INTERVIEW_TYPES: Record<InterviewTypeId, InterviewType> = {
  technical: {
    id: "technical",
    label: "Technical",
    tagline: "Talk through a coding problem: approach, edge cases, complexity.",
    questionsPerSession: 2,
    maxFollowUps: 3,
    maxTurnsPerQuestion: 8,
    interviewerGuidance: `This is a coding round with a shared editor (Python, JavaScript, TypeScript, Java, C++, or C) that can run the problem's tests. Good flow: let them clarify and talk through an approach first; once the approach is sound, ask them to code it; then ask them to run the tests, trace a small example, and state the time and space complexity. Their latest code and test results are attached to their answers automatically whenever they change. Read them closely and refer to specifics, like a variable, a loop, or a failing test, but don't read code aloud. Probe understanding, not recall: if they jump straight to a textbook solution, ask why it works, have them walk an edge case, or change a constraint from the follow-up ladder. Point out bugs by asking questions that lead them there; never fix or write code for them, and never state the optimal solution. If they stall for more than a turn, give the next hint on the ladder rather than inventing a bigger one.`,
    questions: [
      {
        id: "two-sum",
        prompt:
          "Given an array of integers and a target number, return the indices of the two numbers that add up to the target.",
        difficulty: "easy",
        topics: ["arrays", "hash maps"],
        strongAnswer:
          "Clarifies whether there is exactly one solution, whether values repeat, and whether to return indices or values. States the O(n squared) double loop, then a single pass with a hash map from value to index, checking for target minus the current value before inserting it: O(n) time, O(n) space. Walks through a small example like 2, 7, 11, 15 with target 9.",
        followUps: [
          "What if the array is already sorted? Can you do it with less extra memory?",
          "What if there can be several valid pairs and I want all of them, without duplicates?",
          "What if the same large array is queried with many different targets?",
        ],
        hints: [
          "As you scan the array once, what would you want to remember about the numbers you've already seen?",
          "For each number, you know exactly which partner value would complete the pair. How could you check for it quickly?",
          "A hash map lets you check whether you've seen a value in constant time.",
        ],
        commonMistakes: [
          "Using the same element twice",
          "Sorting without noticing it loses the original indices",
          "Forgetting the extra space the hash map uses",
        ],
      },
      {
        id: "valid-parentheses",
        prompt:
          "Given a string made only of brackets, like round, square, and curly ones, decide whether every bracket is closed in the right order.",
        difficulty: "easy",
        topics: ["stacks", "strings"],
        strongAnswer:
          "Uses a stack: push opening brackets, and on a closing bracket check the top matches and pop. The string is valid if the stack is empty at the end. O(n) time, O(n) space. Handles an empty string, a closing bracket first, and leftover openers.",
        followUps: [
          "Why does a single counter work for one bracket type but not for three?",
          "How would you return the position of the first bracket that breaks the rule?",
          "What's the minimum number of brackets you'd have to delete to make the string valid?",
        ],
        hints: [
          "When you see a closing bracket, which earlier bracket does it have to match?",
          "The most recent unmatched opener is the one that must close first. What data structure gives you the most recent item?",
          "Try a stack: push openers and pop when you see a matching closer.",
        ],
        commonMistakes: [
          "Only counting brackets, which accepts strings like square-open, round-open, square-close, round-close",
          "Forgetting to check the stack is empty at the end",
          "Popping from an empty stack on a leading closer",
        ],
      },
      {
        id: "longest-substring",
        prompt: "Given a string, find the length of the longest substring without repeating characters.",
        difficulty: "medium",
        topics: ["strings", "sliding window", "hash maps"],
        strongAnswer:
          "Starts with checking every substring (O(n cubed) or O(n squared)), then a sliding window with a set or a map of each character's last index, moving the left edge past a repeat. O(n) time and O(k) space for the alphabet. Covers an empty string, all the same character, and all unique characters.",
        followUps: [
          "Walk me through your window on the string a, b, c, a, b, c, b, b.",
          "Can you jump the left pointer instead of moving it one step at a time? What do you store to do that?",
          "What if I want the substring itself, not just its length?",
        ],
        hints: [
          "Imagine a window over the string that never contains a repeat. What happens when you add a character that's already inside it?",
          "You only need to move the start of the window forward when a repeat enters. How far does it need to move?",
          "Track the last index you saw each character at, and move the start just past it.",
        ],
        commonMistakes: [
          "Moving the left pointer backward when the last-seen index is before the window",
          "Confusing substrings with subsequences",
          "Restarting the scan after each repeat, which goes back to O(n squared)",
        ],
      },
      {
        id: "merge-intervals",
        prompt:
          "You're given a list of time intervals, each with a start and an end. Merge all the intervals that overlap.",
        difficulty: "medium",
        topics: ["sorting", "arrays", "intervals"],
        strongAnswer:
          "Clarifies whether touching intervals like 1 to 2 and 2 to 3 count as overlapping and whether the input is sorted. Sorts by start, then sweeps: extend the current interval's end with the max, or start a new one. O(n log n) time for the sort. Covers an interval fully inside another.",
        followUps: [
          "Why do you take the maximum of the two ends instead of just the second interval's end?",
          "Now say the list is already merged and sorted, and I give you one new interval to insert. Can you beat n log n?",
          "How would you find the total time covered by at least one interval?",
        ],
        hints: [
          "Would it help to look at the intervals in some particular order?",
          "If they're sorted by start time, which interval could the next one possibly overlap with?",
          "Sort by start, then compare each interval only with the last one you've merged.",
        ],
        commonMistakes: [
          "Not handling an interval contained inside another",
          "Comparing every pair, which is O(n squared)",
          "Not asking whether touching endpoints should merge",
        ],
      },
      {
        id: "valid-bst",
        prompt: "How would you check whether a binary tree is a valid binary search tree?",
        difficulty: "medium",
        topics: ["trees", "recursion"],
        strongAnswer:
          "Recognizes the trap: each node must respect bounds from all its ancestors, not just its parent. Recurses passing a lower and upper bound, or does an in-order traversal and checks values strictly increase. O(n) time, O(h) space for the recursion. Asks how duplicates should be treated.",
        followUps: [
          "Can you give me a tree where checking each node against only its children gives the wrong answer?",
          "How does your space usage change for a very unbalanced tree? Could you avoid recursion?",
          "If exactly two nodes were swapped by mistake, how would you find them?",
        ],
        hints: [
          "Picture a node deep in the left subtree of the root. Besides its parent, which other node's value constrains it?",
          "Every node has a range of values it's allowed to take. How does that range change as you go left or right?",
          "Pass down a minimum and maximum allowed value, or use the fact that an in-order traversal of a valid tree is sorted.",
        ],
        commonMistakes: [
          "Only comparing a node with its direct children",
          "Using the in-order idea but allowing equal neighbors without asking about duplicates",
          "Hard-coding integer limits as the initial bounds",
        ],
      },
      {
        id: "number-of-islands",
        prompt:
          "Given a 2D grid of land and water, count the islands, where an island is land connected horizontally or vertically.",
        difficulty: "medium",
        topics: ["graphs", "BFS/DFS", "grids"],
        strongAnswer:
          "Scans every cell; on unvisited land, increments the count and flood-fills the whole island with DFS or BFS, marking cells visited. O(rows times columns) time; extra space for the visited set or the recursion. Mentions diagonal neighbors don't count and whether mutating the grid is allowed.",
        followUps: [
          "What happens with recursive DFS on a grid that's one enormous island? How would you fix it?",
          "Can you do it without modifying the input grid?",
          "Now land gets added one cell at a time and you need the island count after each addition. What changes?",
        ],
        hints: [
          "When you find a piece of land, how could you make sure you never count the rest of that island again?",
          "Think of the grid as a graph where neighboring land cells are connected. What algorithm visits everything connected to a starting cell?",
          "Flood-fill from each new land cell with DFS or BFS and mark what you visit.",
        ],
        commonMistakes: [
          "Counting diagonal neighbors",
          "Forgetting to mark cells visited, causing infinite loops or double counting",
          "Not noticing recursion depth limits on large grids",
        ],
      },
      {
        id: "top-k-frequent",
        prompt: "Given a list of numbers, return the k most frequent elements.",
        difficulty: "medium",
        topics: ["hash maps", "heaps", "sorting"],
        strongAnswer:
          "Counts with a hash map, then either sorts by count (O(n log n)), keeps a min-heap of size k (O(n log k)), or bucket-sorts by frequency (O(n)). Explains why the heap is a min-heap. Asks how to break ties and what happens when k equals the number of distinct values.",
        followUps: [
          "Why a min-heap of size k rather than a max-heap of everything?",
          "Can you get this to linear time?",
          "What if the numbers arrive as a stream too large to fit in memory?",
        ],
        hints: [
          "Before deciding which are most frequent, what do you need to know about each number?",
          "Once you have the counts, you don't need them fully sorted, just the top k. What structure keeps the best k cheaply?",
          "Consider a heap of size k, or buckets indexed by frequency.",
        ],
        commonMistakes: [
          "Using a max-heap of all elements without noticing the cost",
          "Ignoring ties",
          "Mixing up the counts with the values when returning",
        ],
      },
      {
        id: "best-time-stock",
        prompt:
          "You're given a list of a stock's prices, one per day. Find the maximum profit from buying on one day and selling on a later day, or zero if no profit is possible.",
        difficulty: "easy",
        topics: ["arrays", "greedy"],
        strongAnswer:
          "Notes that the sell day must come after the buy day. Brute force checks every pair, O(n squared). Better: one pass tracking the lowest price seen so far and the best profit if you sold today. O(n) time, O(1) space. Handles prices that only fall (answer zero).",
        followUps: [
          "Why does tracking only the minimum so far give the right answer?",
          "What if you could buy and sell as many times as you want?",
          "What if there's a fee on every sale?",
        ],
        hints: [
          "For each day, if you sold on that day, which buy day would be best?",
          "You only need one number from the past to answer that.",
          "Keep the lowest price seen so far and compare today's price against it.",
        ],
        commonMistakes: ["Subtracting the global min from the global max, ignoring order", "Returning a negative profit", "Nested loops without improving them"],
      },
      {
        id: "climbing-stairs",
        prompt: "You can climb a staircase one or two steps at a time. How many different ways are there to reach the top of a staircase with n steps?",
        difficulty: "easy",
        topics: ["dynamic programming", "recursion"],
        strongAnswer:
          "Sees that the ways to reach step n are the ways to reach n minus 1 plus the ways to reach n minus 2. Notes plain recursion is exponential, then memoizes or iterates with two variables: O(n) time, O(1) space. Gets the base cases right.",
        followUps: [
          "Why is the plain recursive version so slow?",
          "Can you do it with constant extra space?",
          "What if you could also take three steps at a time?",
        ],
        hints: [
          "Think about the very last move you make to reach the top.",
          "If your last move was one step or two steps, where were you right before?",
          "So the answer for n depends on the answers for n minus 1 and n minus 2.",
        ],
        commonMistakes: ["Wrong base cases", "Exponential recursion without memoization", "Not recognizing the Fibonacci pattern"],
      },
      {
        id: "product-except-self",
        prompt: "Given a list of numbers, return a list where each position holds the product of all the other numbers, without using division.",
        difficulty: "medium",
        topics: ["arrays", "prefix products"],
        strongAnswer:
          "Builds prefix products from the left and suffix products from the right, so each answer is the product of everything before it times everything after it. O(n) time; O(1) extra space if the output array holds the prefixes. Explains why division fails with zeros.",
        followUps: [
          "Why not just multiply everything and divide by each number?",
          "Can you do it with only the output array as extra space?",
          "What happens with one zero in the input? Two zeros?",
        ],
        hints: [
          "The answer for a position is the product of everything to its left times everything to its right.",
          "Could you compute 'everything to the left' for every position in one pass?",
          "Do one pass of prefix products from the left and one of suffix products from the right.",
        ],
        commonMistakes: ["Using division", "O(n squared) recomputation", "Off-by-one in the prefix and suffix boundaries"],
      },
      {
        id: "search-rotated",
        prompt:
          "A sorted list of distinct numbers has been rotated at some unknown point, like 4, 5, 6, 7, 0, 1, 2. Find the index of a target number, or return minus one, in better than linear time.",
        difficulty: "medium",
        topics: ["binary search", "arrays"],
        strongAnswer:
          "Uses a modified binary search: at each step one half is still sorted, so check whether the target lies in that sorted half and discard the other. O(log n) time. Handles no rotation, a single element, and a missing target.",
        followUps: [
          "How do you tell which half is sorted?",
          "How would you find the rotation point itself?",
          "What changes if duplicates are allowed?",
        ],
        hints: [
          "If you split the list in the middle, is at least one half guaranteed to be in order?",
          "Once you know which half is in order, you can check whether the target falls inside it.",
          "Compare the middle with the left end to decide which half is sorted.",
        ],
        commonMistakes: ["Linear scan", "Wrong comparisons at the boundaries (strict vs non-strict)", "Infinite loop from updating the pointers incorrectly"],
      },
      {
        id: "kth-largest",
        prompt: "Given a list of numbers and a number k, return the k-th largest number in the list.",
        difficulty: "medium",
        topics: ["heaps", "sorting", "quickselect"],
        strongAnswer:
          "Starts with sorting, O(n log n). Improves with a min-heap of size k, O(n log k), and can mention quickselect for average O(n). Clarifies that duplicates count separately.",
        followUps: [
          "Why a min-heap rather than a max-heap?",
          "Can you beat n log k on average?",
          "What if the numbers arrive as a stream and k stays fixed?",
        ],
        hints: [
          "Do you need the whole list sorted, or just the top k?",
          "What structure keeps the k biggest values seen so far cheaply?",
          "Keep a min-heap of size k: its smallest element is the answer.",
        ],
        commonMistakes: ["Using a max-heap of everything without noticing the cost", "Off-by-one between k-th largest and k-th smallest", "Dropping duplicates"],
      },
      {
        id: "daily-temperatures",
        prompt:
          "Given a list of daily temperatures, return for each day how many days you'd have to wait for a warmer temperature, or zero if there isn't one.",
        difficulty: "medium",
        topics: ["stacks", "monotonic stack"],
        strongAnswer:
          "Brute force looks ahead from each day, O(n squared). Better: a stack of indices with decreasing temperatures; when a warmer day arrives, pop every cooler day and record the distance. O(n) time and space, since each index is pushed and popped once.",
        followUps: [
          "Why is your stack solution linear even though there's a loop inside a loop?",
          "What do the indices left on the stack at the end mean?",
          "How would you find the next warmer day to the left instead?",
        ],
        hints: [
          "Which earlier days are still waiting for an answer when you reach a new day?",
          "When a warmer day arrives, it answers some of those waiting days at once.",
          "Keep a stack of indices that are still waiting, in decreasing temperature order.",
        ],
        commonMistakes: ["Storing temperatures instead of indices", "Using greater-or-equal instead of strictly warmer", "Assuming it's O(n squared) because of the nested loop"],
      },
      {
        id: "course-schedule",
        prompt:
          "There are n courses, numbered 0 to n minus 1, and a list of prerequisite pairs meaning 'to take course a you must first take course b'. Can you finish every course?",
        difficulty: "medium",
        topics: ["graphs", "topological sort", "cycle detection"],
        strongAnswer:
          "Models courses as a directed graph and recognizes the question is whether it has a cycle. Uses Kahn's algorithm (repeatedly take courses with no remaining prerequisites) or DFS with visiting/visited states. O(courses + prerequisites).",
        followUps: [
          "How would you return an actual order to take the courses in?",
          "Walk me through how your approach detects a cycle.",
          "What if some courses could be taken in parallel each semester? How many semesters at minimum?",
        ],
        hints: [
          "Draw the courses as a graph. When would it be impossible to finish?",
          "A course with no prerequisites left can be taken right away. What happens after you take it?",
          "Track how many prerequisites each course still has, and repeatedly take the ones at zero.",
        ],
        commonMistakes: ["Reversing the edge direction", "DFS without a separate 'currently visiting' state, missing cycles", "Forgetting courses with no edges"],
      },
      {
        id: "coin-change",
        prompt:
          "Given coin denominations and a target amount, return the fewest coins needed to make that amount, or minus one if it can't be made. You have unlimited coins of each kind.",
        difficulty: "hard",
        topics: ["dynamic programming"],
        strongAnswer:
          "Shows that greedy (largest coin first) fails, for example coins 1, 3, 4 and amount 6. Defines best of amount as one plus the minimum over coins of best of amount minus coin, filled bottom-up from zero. O(amount times coins) time, O(amount) space. Handles zero and impossible amounts.",
        followUps: [
          "Can you give me an example where always taking the largest coin fails?",
          "How would you return the actual coins used, not just the count?",
          "How would you count the number of ways to make the amount instead?",
        ],
        hints: [
          "Try always using the biggest coin with coins 1, 3, 4 and amount 6. Does it work?",
          "If you knew the best answer for every smaller amount, how would you get the answer for this one?",
          "Build a table from 0 up to the amount: each entry is one plus the best of the entries one coin smaller.",
        ],
        commonMistakes: ["Greedy largest-coin-first", "Not handling impossible amounts", "Initializing the table with zero instead of infinity"],
      },
      {
        id: "lru-cache",
        prompt:
          "Design a data structure for a least-recently-used cache, with get and put operations that both run in constant time.",
        difficulty: "hard",
        topics: ["hash maps", "linked lists", "design"],
        strongAnswer:
          "Combines a hash map from key to node with a doubly linked list ordered by recency. Get moves the node to the front; put inserts at the front and evicts from the tail when over capacity. Explains why each half is needed: the map for lookup, the doubly linked list for constant-time removal from the middle.",
        followUps: [
          "Why does the list need to be doubly linked?",
          "Walk me through exactly what happens on a put when the cache is full and the key is new.",
          "How would you make it safe to use from several threads at once?",
        ],
        hints: [
          "You need two things fast: finding a key, and knowing which key was used least recently. Can one structure do both?",
          "Something has to keep keys in order of use, and you need to move an item from the middle to the front quickly.",
          "Pair a hash map with a doubly linked list.",
        ],
        commonMistakes: [
          "Using an array or singly linked list, making removal O(n)",
          "Forgetting to update recency on get",
          "Forgetting to delete the evicted key from the map",
        ],
      },
    ],
    rubric: [
      {
        name: "Problem understanding",
        description: "Restates the problem, asks clarifying questions, and identifies constraints and edge cases before solving.",
        levels: [
          "Starts solving immediately and misreads or ignores key constraints.",
          "Asks a clarifying question only when stuck; misses important edge cases.",
          "Restates the problem and asks the key clarifying questions up front.",
          "Clarifies precisely, surfaces non-obvious edge cases, and uses them to shape the approach.",
        ],
      },
      {
        name: "Problem solving",
        description: "Starts from a working baseline, then improves it with a clear rationale; uses hints well.",
        levels: [
          "No workable approach, even with hints.",
          "Reaches a working approach only with significant hints.",
          "Gets a correct, reasonably efficient approach with at most a small nudge.",
          "Moves from baseline to optimal independently and explains why each step is better.",
        ],
      },
      {
        name: "Correctness",
        description: "The approach works, including on edge cases; walks through an example to verify.",
        levels: [
          "The approach is wrong for typical inputs.",
          "Works for the main case but breaks on edge cases they didn't catch.",
          "Correct, with most edge cases handled; verifies on an example when asked.",
          "Correct on all edge cases and proactively verifies by walking through an example.",
        ],
      },
      {
        name: "Complexity analysis",
        description: "States time and space complexity correctly and explains trade-offs between approaches.",
        levels: [
          "No complexity analysis, or it's wrong.",
          "Gives time complexity when asked, with errors or missing space.",
          "Correct time and space complexity for their approach.",
          "Correct analysis for several approaches and a clear explanation of the trade-off.",
        ],
      },
      {
        name: "Implementation",
        description: "Turns the approach into clean, working code and tests it.",
        levels: [
          "No working code, or code that doesn't match the described approach.",
          "Partially working code with significant bugs, or pseudocode only.",
          "Working code for the main cases, reasonably clean; most tests pass.",
          "Clean, correct code that passes the tests, with edge cases handled and verified by running it.",
        ],
      },
      {
        name: "Communication",
        description: "Thinks out loud in a structured way an interviewer can follow; concise.",
        levels: [
          "Long silences or a stream of thought that's hard to follow.",
          "Understandable but disorganized; the interviewer has to pull information out.",
          "Explains the plan before diving in and narrates key decisions.",
          "Clear, structured, and concise throughout; checks in with the interviewer at the right moments.",
        ],
      },
    ],
  },

  behavioral: {
    id: "behavioral",
    label: "Behavioral",
    tagline: "Tell stories about teamwork, ownership, and growth.",
    questionsPerSession: 3,
    maxFollowUps: 2,
    maxTurnsPerQuestion: 5,
    interviewerGuidance: `Look for specific, real stories told in a STAR-like shape (situation, task, action, result). Probe for what the candidate personally did when they say "we", for concrete outcomes or numbers, and for what they learned. Student experience counts: class projects, internships, clubs, hackathons, research, part-time jobs. If an answer is hypothetical ("I would..."), ask for a real example. If they can't think of a story, give the next hint on the ladder.`,
    questions: [
      {
        id: "proudest-project",
        prompt: "Tell me about a project you're most proud of.",
        difficulty: "easy",
        topics: ["ownership", "impact"],
        strongAnswer:
          "Picks a project with real stakes, explains the goal in a sentence or two, then focuses on their own contribution: the hardest technical or people problem and how they solved it. Ends with a concrete result (users, performance, a grade, a shipped feature) and one thing they'd do differently.",
        followUps: [
          "What part of that was specifically yours?",
          "What was the hardest problem you hit, and how did you get past it?",
          "How do you know it worked? What changed because of it?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Describing the project's features instead of their own contribution",
          "Saying 'we' throughout",
          "No result or measure of success",
        ],
      },
      {
        id: "why-this-role",
        prompt: "Why are you interested in this kind of role, and why now?",
        difficulty: "easy",
        topics: ["motivation"],
        strongAnswer:
          "Connects a specific past experience to the role's day-to-day work, shows they understand what the job actually involves, and explains what they want to learn next. Specific, not generic praise.",
        followUps: [
          "What part of the day-to-day work are you most excited about, and what part do you expect to find hard?",
          "What have you done so far to test whether you'd enjoy this work?",
          "Where do you want to be in two or three years?",
        ],
        hints: [
          "Think about a moment in a class, project, or job when you realized you liked this kind of work.",
          "Try connecting something you've already done to what this role does every day.",
        ],
        commonMistakes: [
          "Generic answers like 'I'm passionate about technology'",
          "Focusing only on pay, prestige, or perks",
          "Not knowing what the role actually does",
        ],
      },
      {
        id: "conflict",
        prompt: "Tell me about a time you disagreed with a teammate. How did you handle it?",
        difficulty: "medium",
        topics: ["teamwork", "communication"],
        strongAnswer:
          "A real disagreement with something at stake. Shows they listened to understand the other side, used data or a small experiment where possible, reached a decision, and kept the working relationship intact. Reflects on what they learned about working with people.",
        followUps: [
          "What did your teammate believe, and why did they think that?",
          "What would you have done if they still hadn't agreed?",
          "Looking back, was there anything you could have done earlier to avoid the disagreement?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Claiming they've never disagreed with anyone",
          "Making the other person the villain",
          "A story where the resolution was the manager stepping in, with no action from them",
        ],
      },
      {
        id: "failure",
        prompt: "Tell me about a time you failed or made a mistake.",
        difficulty: "medium",
        topics: ["self-awareness", "growth"],
        strongAnswer:
          "A real failure with consequences, owned without excuses. Explains what they did to recover, the specific lesson, and evidence they applied it later.",
        followUps: [
          "What did you do in the moment, once you realized it had gone wrong?",
          "What specifically do you do differently now?",
          "Has the same situation come up since? What happened?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "A disguised strength ('I worked too hard')",
          "Blaming others or circumstances",
          "A vague lesson with no evidence it was applied",
        ],
      },
      {
        id: "learn-fast",
        prompt: "Tell me about a time you had to learn something new very quickly.",
        difficulty: "medium",
        topics: ["learning", "adaptability"],
        strongAnswer:
          "Explains why speed mattered, how they structured the learning (what they prioritized, which resources, who they asked), how they knew they were ready, and the outcome.",
        followUps: [
          "How did you decide what to learn first and what to skip?",
          "Who did you ask for help, and how?",
          "How did you know you'd learned enough to deliver?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Listing what they learned without how",
          "No outcome",
          "Picking something that wasn't actually under time pressure",
        ],
      },
      {
        id: "tight-deadline",
        prompt: "Tell me about a time you had a tight deadline or too many things to do at once.",
        difficulty: "medium",
        topics: ["prioritization", "communication"],
        strongAnswer:
          "Shows explicit prioritization: what they did first and why, what they cut or negotiated, and how they communicated trade-offs to others before the deadline, not after. Ends with the result and what they'd change.",
        followUps: [
          "How did you decide what to drop or delay?",
          "Who did you tell, and when?",
          "What would you do differently if it happened again?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "The answer is just 'I worked all night'",
          "No prioritization logic",
          "Telling stakeholders only after missing the deadline",
        ],
      },
      {
        id: "initiative",
        prompt: "Tell me about a time you went beyond what was asked of you.",
        difficulty: "medium",
        topics: ["ownership", "initiative"],
        strongAnswer:
          "Noticed a problem nobody owned, acted without being told, brought others along where needed, and produced a measurable benefit.",
        followUps: [
          "How did you notice the problem in the first place?",
          "Did anyone push back? How did you get buy-in?",
          "What happened after you were done? Did it stick?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Describing normal job duties as initiative",
          "Doing it alone without telling anyone",
          "No measurable benefit",
        ],
      },
      {
        id: "tell-me-about-yourself",
        prompt: "Walk me through your background and what brings you here today.",
        difficulty: "easy",
        topics: ["communication", "motivation"],
        strongAnswer:
          "A 60 to 90 second arc rather than a resume recital: where they are now, one or two experiences that show what they're good at (each with a concrete detail), and why that leads to this role. Ends by handing the conversation back.",
        followUps: [
          "Which of those experiences taught you the most, and why?",
          "What's something that isn't on your resume that I should know about you?",
          "What kind of team do you do your best work on?",
        ],
        hints: [
          "Try present, past, future: what you're doing now, one or two things you've done, and what you want next.",
          "Pick the one experience you'd most like to be asked about, and make sure it's in there.",
        ],
        commonMistakes: [
          "Reading the resume line by line",
          "Going on for more than two minutes",
          "A life story with no link to the role",
        ],
      },
      {
        id: "critical-feedback",
        prompt: "Tell me about a time you got critical feedback. What did you do with it?",
        difficulty: "medium",
        topics: ["self-awareness", "growth"],
        strongAnswer:
          "Real, specific feedback from a mentor, manager, professor, or teammate. Describes how they took it in the moment without getting defensive, the concrete change they made, and evidence the change stuck or was noticed.",
        followUps: [
          "How did you react when you first heard it?",
          "What exactly did you change, and how did you check it was working?",
          "Have you ever disagreed with feedback you were given? What did you do?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Feedback that is really praise in disguise",
          "No concrete change in behavior",
          "Getting defensive or blaming the person who gave it",
        ],
      },
      {
        id: "ambiguity",
        prompt: "Tell me about a time you had to make progress without clear instructions.",
        difficulty: "medium",
        topics: ["ambiguity", "ownership"],
        strongAnswer:
          "Explains what was unclear and why it mattered, how they reduced the ambiguity (asking the right person, writing down assumptions, building a small version first), the decision they made and why, and how they adjusted once they learned more.",
        followUps: [
          "What assumptions did you make, and how did you check them?",
          "Who did you go to for clarity, and what did you ask them?",
          "What would you have done if your first guess had turned out wrong?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Waiting to be told what to do",
          "Charging ahead without checking any assumptions",
          "No outcome",
        ],
      },
      {
        id: "lead-without-authority",
        prompt: "Tell me about a time you got a group to go with your idea when you weren't the one in charge.",
        difficulty: "medium",
        topics: ["leadership", "influence"],
        strongAnswer:
          "Shows influence without a title: understood what others cared about, made a clear case (often with a prototype, data, or a small trial), handled objections, and reached a decision. Credits the team and states the outcome.",
        followUps: [
          "Who was hardest to convince, and what finally changed their mind?",
          "What did you do when someone pushed back?",
          "How did you keep things moving once the group agreed?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Being the official leader and calling it influence",
          "Getting their way through pressure or by going around people",
          "Taking all the credit",
        ],
      },
      {
        id: "helped-teammate",
        prompt: "Tell me about a time you helped a teammate who was struggling.",
        difficulty: "easy",
        topics: ["teamwork", "empathy"],
        strongAnswer:
          "Noticed someone was stuck, offered help in a way that respected them (pairing, unblocking, sharing context) instead of taking over, balanced it with their own work, and the teammate or project ended up better off.",
        followUps: [
          "How did you notice they were struggling?",
          "How did you balance helping them with your own work?",
          "What would you have done if they hadn't wanted your help?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Simply doing the work for them",
          "A story that is really about their own heroics",
          "No outcome for the teammate",
        ],
      },
      {
        id: "disagree-and-commit",
        prompt: "Tell me about a time a decision went against what you wanted. What did you do?",
        difficulty: "medium",
        topics: ["teamwork", "maturity"],
        strongAnswer:
          "Made their case clearly and respectfully before the decision, accepted it once it was made, committed to making it work, and reflects honestly on whether the decision turned out to be right.",
        followUps: [
          "How did you make your case before the decision was made?",
          "What did committing to it look like in practice?",
          "Looking back, who was right?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Quietly not doing it, or sulking",
          "Re-arguing after the decision was made",
          "A story with nothing at stake",
        ],
      },
      {
        id: "user-impact",
        prompt: "Tell me about something you built or improved for other people to use. How did you know it helped them?",
        difficulty: "medium",
        topics: ["impact", "user focus"],
        strongAnswer:
          "Starts from a real need, explains how they learned what people needed (talking to users, data, feedback), what they built or changed because of it, and how they measured that it helped. Mentions something they changed after seeing it used.",
        followUps: [
          "How did you find out what people actually needed?",
          "What did you learn once people started using it?",
          "If you had another month on it, what would you change?",
        ],
        hints: BEHAVIORAL_HINTS,
        commonMistakes: [
          "Describing the technology instead of the people using it",
          "No evidence that it helped",
          "Assuming what users wanted without checking",
        ],
      },
      {
        id: "hardest-bug",
        prompt: "Tell me about the hardest technical problem or bug you've had to solve.",
        difficulty: "medium",
        topics: ["problem solving", "technical depth"],
        strongAnswer:
          "A specific problem explained so a non-expert can follow it, a systematic approach (reproduce, narrow down, form and test hypotheses), the root cause, the fix, and what they did so it wouldn't happen again, like a test or a check.",
        followUps: [
          "How did you narrow it down? What did you rule out first?",
          "What was the actual root cause?",
          "What did you change so it wouldn't happen again?",
        ],
        hints: [
          "Think of a bug that took you more than a day, or one whose cause surprised you.",
          "Walk through it in order: what you saw, what you tried, and what it turned out to be.",
        ],
        commonMistakes: [
          "So much jargon it's hard to follow",
          "A lucky guess with no method behind it",
          "Stopping at the fix, with no prevention or lesson",
        ],
      },
    ],
    rubric: [
      {
        name: "Structure",
        description: "Answers follow a clear situation, task, action, result arc without rambling.",
        levels: [
          "Hard to follow; no clear story.",
          "A story is there, but the setup dominates or the result is missing.",
          "A clear arc with brief setup and most time spent on actions.",
          "Tight, well-paced stories that land on a clear result every time.",
        ],
      },
      {
        name: "Ownership",
        description: "Makes their personal contribution clear (\"I\" not just \"we\") and takes responsibility.",
        levels: [
          "Can't say what they personally did.",
          "Mostly 'we'; their role only emerges under probing.",
          "Clear about their own actions and decisions.",
          "Clear ownership, including of mistakes, and credits others accurately.",
        ],
      },
      {
        name: "Impact",
        description: "Describes concrete outcomes, ideally with numbers or a clear before and after.",
        levels: [
          "No outcome mentioned.",
          "Vague outcomes ('it went well').",
          "Concrete outcomes for most stories.",
          "Specific, quantified outcomes tied directly to their actions.",
        ],
      },
      {
        name: "Self-awareness",
        description: "Reflects honestly on mistakes and what they learned or would change.",
        levels: [
          "Defensive, or blames others.",
          "Acknowledges issues only when pushed; generic lessons.",
          "Honest reflection with a specific lesson.",
          "Insightful reflection with evidence the lesson changed their behavior.",
        ],
      },
      {
        name: "Communication",
        description: "Concise, specific, and easy to follow; answers the question that was asked.",
        levels: [
          "Off-topic or very long-winded.",
          "On-topic but wordy; needs redirecting.",
          "Concise and on-topic.",
          "Crisp and engaging; adapts to follow-ups smoothly.",
        ],
      },
    ],
  },

  "system-design": {
    id: "system-design",
    label: "System Design",
    tagline: "Scope and sketch a system, then reason about trade-offs.",
    questionsPerSession: 1,
    maxFollowUps: 6,
    maxTurnsPerQuestion: 12,
    interviewerGuidance: `This is a new-grad level design round: expect sound fundamentals, not senior-level depth. Let the candidate drive. Good flow: clarify requirements and scale, sketch the main components and APIs, choose a data model, then go deeper on one or two areas. Ask one probing question at a time, working down the follow-up ladder. If they jump straight into components, ask what requirements they're designing for.
The candidate has a whiteboard and a notes panel. Their latest diagram (an image plus a text summary of components and connections) and notes are attached to their answers automatically whenever they change. Refer to their diagram concretely, like "the arrow from your API servers to the cache". Once requirements are clear, if nothing is drawn yet, invite them to sketch the high-level design.`,
    questions: [
      {
        id: "url-shortener",
        prompt: "Let's design a URL shortener, something like bit.ly.",
        difficulty: "medium",
        topics: ["APIs", "storage", "caching", "ID generation"],
        strongAnswer:
          "Clarifies scale and features (custom aliases, expiry, analytics). Defines create and redirect APIs. Generates IDs with a counter encoded in base 62 or a hash with collision handling. Stores the mapping in a key-value store, caches hot links because reads far outnumber writes, and chooses a redirect status code deliberately.",
        followUps: [
          "How do you generate the short code, and what happens if two requests collide?",
          "Reads outnumber writes by a lot. How does that shape your design?",
          "How would you add click analytics without slowing down redirects?",
          "What happens when one link goes viral?",
          "How do link expiration and deletion work?",
        ],
        hints: [
          "Before components, what are the two main things a user does with this system?",
          "Think about how often links are created versus clicked.",
          "Consider a key-value store for the mapping, with a cache in front for popular links.",
        ],
        commonMistakes: [
          "Jumping into databases before requirements",
          "Random IDs with no collision plan",
          "No caching for a read-heavy system",
        ],
      },
      {
        id: "rate-limiter",
        prompt: "Let's design a rate limiter for a public API.",
        difficulty: "medium",
        topics: ["algorithms", "distributed state", "APIs"],
        strongAnswer:
          "Clarifies what to limit by (user, API key, IP) and the limits. Compares fixed window, sliding window, and token bucket. Places it at the gateway or as middleware, keeps counters in a shared store like Redis so limits hold across servers, and returns a 429 with retry information.",
        followUps: [
          "Compare a fixed window with a token bucket. When would each be unfair?",
          "You have twenty API servers. Where do the counters live?",
          "What should happen if your counter store goes down: fail open or fail closed?",
          "How would you give paying customers higher limits?",
        ],
        hints: [
          "Who or what are you limiting, and over what time period?",
          "Think about how you'd count requests in a time window, and what happens at the window's edge.",
          "Consider a token bucket per user with counts in a shared store.",
        ],
        commonMistakes: [
          "Keeping counters in each server's memory",
          "Not saying what the client sees when limited",
          "Ignoring the burst at fixed window boundaries",
        ],
      },
      {
        id: "chat-app",
        prompt: "Let's design a simple one-to-one chat app.",
        difficulty: "hard",
        topics: ["real-time", "storage", "delivery"],
        strongAnswer:
          "Clarifies scale, message history, and online status. Uses persistent connections such as WebSockets for real-time delivery, stores messages with per-conversation ordering, handles offline users with stored messages and push notifications, and discusses scaling connection servers and routing a message to the right one.",
        followUps: [
          "How does a message get from my phone to yours if we're connected to different servers?",
          "What happens if you're offline when I send it?",
          "How do you keep messages in the right order?",
          "How would you add read receipts?",
        ],
        hints: [
          "Start with what happens when one user sends one message. What has to happen for it to show up on the other phone?",
          "Think about whether the client should keep asking for new messages, or the server should push them.",
          "Consider persistent connections, plus storing messages so offline users get them later.",
        ],
        commonMistakes: [
          "Polling with no discussion of cost",
          "No plan for offline delivery",
          "Ignoring message ordering",
        ],
      },
      {
        id: "news-feed",
        prompt: "Let's design the home feed for a small social media app.",
        difficulty: "hard",
        topics: ["data modeling", "fan-out", "caching", "pagination"],
        strongAnswer:
          "Models users, posts, and follows. Compares building feeds on read (query followed users' posts) with fan-out on write (push post IDs into followers' feeds), caches feeds, and paginates with a cursor. Discusses the celebrity problem as a stretch.",
        followUps: [
          "Compare building the feed when it's read with precomputing it when a post is written.",
          "What happens when someone with a million followers posts?",
          "How do you paginate a feed that keeps changing?",
          "How would you add ranking instead of pure time order?",
        ],
        hints: [
          "What data do you need to store first: think users, posts, and who follows whom.",
          "When I open the app, how do you figure out which posts to show me?",
          "Consider precomputing each user's feed when people they follow post.",
        ],
        commonMistakes: [
          "No data model",
          "Only one approach with no trade-off discussed",
          "Offset pagination on a constantly changing feed",
        ],
      },
      {
        id: "leaderboard",
        prompt: "Let's design the leaderboard for an online game with millions of players.",
        difficulty: "medium",
        topics: ["data structures", "caching", "scale"],
        strongAnswer:
          "Clarifies what the leaderboard shows (global top 100, a player's own rank, friends, daily versus all-time) and how often scores change. Proposes an API for submitting scores and reading ranks. Uses a sorted structure such as a sorted set keyed by score for fast top-N and rank lookups, explains how scores get there (directly, or through a queue when writes spike), and handles daily resets and ties. Discusses sharding or approximation once one structure is too big.",
        followUps: [
          "How would you return a single player's exact rank quickly?",
          "Scores spike at the end of every match. How do you handle that write load?",
          "How do daily and weekly leaderboards work alongside the all-time one?",
          "What happens when the leaderboard is too big for one machine?",
          "How would you stop players from submitting fake scores?",
        ],
        hints: [
          "Start with the two things players do: submit a score and look at rankings.",
          "Which data structure keeps items sorted and lets you ask for the top N or a rank quickly?",
          "Think about what happens when thousands of matches end in the same minute.",
        ],
        commonMistakes: [
          "Sorting the whole table on every read",
          "Ignoring ties and resets",
          "Trusting scores sent straight from the game client",
        ],
      },
      {
        id: "notifications",
        prompt: "Let's design a notification system that sends push, email, and text messages for an app.",
        difficulty: "medium",
        topics: ["queues", "reliability", "APIs"],
        strongAnswer:
          "Clarifies the types of notification, volume, and how fast they must arrive. Other services call a notification API; requests go onto a queue so spikes don't overwhelm senders; workers per channel call providers such as an email service or a push gateway; user preferences and opt-outs are checked before sending. Covers retries with backoff, deduplication so nobody gets the same message twice, rate limits per user, and tracking delivery status.",
        followUps: [
          "Why put a queue between the API and the senders?",
          "An email provider goes down for ten minutes. What happens?",
          "How do you make sure someone doesn't get the same notification twice?",
          "How do user preferences and quiet hours fit in?",
          "How would you send a message to every user at once without falling over?",
        ],
        hints: [
          "Who sends notifications into this system, and who receives them?",
          "What should happen when there are suddenly a million notifications to send?",
          "Think about what to do when sending fails part-way.",
        ],
        commonMistakes: [
          "Calling providers directly and synchronously from the API",
          "No retry or deduplication plan",
          "Forgetting user preferences and opt-outs",
        ],
      },
    ],
    rubric: [
      {
        name: "Requirements",
        description: "Clarifies functional and non-functional requirements and rough scale before designing.",
        levels: [
          "No requirements; starts drawing boxes.",
          "Lists features but skips scale or non-functional needs.",
          "Clarifies core features and rough scale.",
          "Prioritizes requirements and uses scale estimates to drive decisions.",
        ],
      },
      {
        name: "High-level design",
        description: "Proposes sensible components, APIs, and data flow that meet the requirements.",
        levels: [
          "Missing or incoherent components.",
          "Plausible components, but the data flow is unclear.",
          "A coherent design with clear APIs and data flow.",
          "A clean, well-justified design the candidate can walk through end to end.",
        ],
      },
      {
        name: "Data modeling",
        description: "Chooses an appropriate storage approach and schema, and justifies it.",
        levels: [
          "No data model.",
          "Names a database without justifying it.",
          "A reasonable schema and storage choice with a justification.",
          "A schema designed around the access patterns, with alternatives considered.",
        ],
      },
      {
        name: "Trade-offs",
        description: "Discusses alternatives, bottlenecks, and failure modes; adapts when pushed.",
        levels: [
          "No alternatives or bottlenecks considered.",
          "Mentions trade-offs only when asked, superficially.",
          "Identifies main bottlenecks and compares a couple of options.",
          "Proactively weighs alternatives and failure modes, and adapts the design under pressure.",
        ],
      },
      {
        name: "Communication",
        description: "Drives the discussion with a clear structure and checks in with the interviewer.",
        levels: [
          "Passive or disorganized; needs constant prompting.",
          "Some structure, but loses the thread.",
          "Drives the discussion with a clear structure.",
          "Leads confidently, signposts, and checks in at the right moments.",
        ],
      },
    ],
  },
};

/**
 * The technical rubric is built for engineers. Product and data candidates
 * are judged on the reasoning their roles actually use.
 */
const ROLE_TECHNICAL_RUBRICS: Partial<Record<RoleId, RubricDimension[]>> = {
  pm: [
    {
      name: "Problem understanding",
      description: "Clarifies the goal, users, and constraints before proposing anything.",
      levels: [
        "Jumps in without understanding the problem.",
        "Clarifies only when prompted.",
        "Restates the problem and asks the key questions up front.",
        "Frames the problem crisply and uses constraints to focus the discussion.",
      ],
    },
    {
      name: "Structured reasoning",
      description: "Breaks the problem down and reasons step by step toward an approach.",
      levels: [
        "No clear approach.",
        "An approach emerges, but with gaps and backtracking.",
        "A clear, logical approach with reasonable steps.",
        "A clean breakdown that an engineer could act on.",
      ],
    },
    {
      name: "Technical fluency",
      description: "Understands how the solution would work technically, without needing to write production code.",
      levels: [
        "Misunderstands basic technical concepts involved.",
        "Uses technical terms loosely or incorrectly.",
        "Explains the technical approach accurately at a high level.",
        "Discusses technical details and limits with confidence and accuracy.",
      ],
    },
    {
      name: "Trade-offs",
      description: "Weighs options, costs, and edge cases, and explains the choice.",
      levels: [
        "No alternatives considered.",
        "Mentions trade-offs only when asked.",
        "Compares a couple of options with a reasoned choice.",
        "Proactively weighs trade-offs, including user impact and edge cases.",
      ],
    },
    {
      name: "Communication",
      description: "Explains clearly to a mixed technical audience.",
      levels: [
        "Hard to follow.",
        "Understandable but disorganized.",
        "Clear and structured.",
        "Crisp, structured, and adapts to the listener.",
      ],
    },
  ],
  data: [
    {
      name: "Problem understanding",
      description: "Clarifies the data, its shape, and edge cases before solving.",
      levels: [
        "Starts without understanding the data.",
        "Clarifies only when stuck.",
        "Asks about the data's shape and edge cases up front.",
        "Surfaces non-obvious data issues (nulls, duplicates, skew) and plans around them.",
      ],
    },
    {
      name: "Approach",
      description: "Chooses a sound method and improves it with a clear rationale.",
      levels: [
        "No workable approach.",
        "A working approach only with big hints.",
        "A correct, reasonable approach with little help.",
        "Moves from baseline to an efficient approach and explains why.",
      ],
    },
    {
      name: "Correctness",
      description: "The result is right, including on edge cases; checks it on an example.",
      levels: [
        "Wrong for typical inputs.",
        "Right in the main case only.",
        "Correct with most edge cases handled.",
        "Correct on all edge cases and verified.",
      ],
    },
    {
      name: "Data reasoning",
      description: "Thinks about scale, efficiency, and what the numbers mean.",
      levels: [
        "No consideration of scale or interpretation.",
        "Notices scale or interpretation only when asked.",
        "Considers efficiency and sanity-checks results.",
        "Reasons about scale, efficiency, and interpretation fluently.",
      ],
    },
    {
      name: "Communication",
      description: "Explains the approach and results clearly.",
      levels: [
        "Hard to follow.",
        "Understandable but disorganized.",
        "Clear and structured.",
        "Crisp and well-structured throughout.",
      ],
    },
  ],
};

/** The rubric a session is scored against, which depends on the round and, for technical rounds, the role. */
export function rubricFor(typeId: InterviewTypeId, role?: RoleId): RubricDimension[] {
  if (typeId === "technical" && role && ROLE_TECHNICAL_RUBRICS[role]) return ROLE_TECHNICAL_RUBRICS[role];
  return INTERVIEW_TYPES[typeId].rubric;
}

// Technical questions get starter code and tests for the editor.
for (const question of INTERVIEW_TYPES.technical.questions) {
  question.coding = CODING_SPECS[question.id];
}

export function getInterviewType(id: InterviewTypeId): InterviewType {
  return INTERVIEW_TYPES[id];
}
