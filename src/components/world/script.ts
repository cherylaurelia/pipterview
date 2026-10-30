// The kinds of prep you can pick in the 3D world.

export const PREP_TYPES = ["behavioral", "technical", "resume"] as const;
export type PrepType = (typeof PREP_TYPES)[number];

export const PREP_LABELS: Record<PrepType, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  resume: "Resume quiz",
};

/** Fallback editor contents until the question's own starter code arrives. */
export const STARTER_CODE = `def two_sum(nums, target):
    # Write your solution here
    pass


print(two_sum([2, 7, 11, 15], 9))  # expect [0, 1]
`;

/** The guide's name: shown on screen, and what the interviewer calls itself out loud. Change it here. */
export const GUIDE_NAME = "Pip";
