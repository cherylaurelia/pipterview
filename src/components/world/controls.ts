/** A pointer that moved more than a few pixels between press and release was a drag (looking around), not a click. */
export const isDrag = (delta: number) => delta > 6;
