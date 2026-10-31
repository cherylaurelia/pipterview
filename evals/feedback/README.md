# Feedback eval

Checks that the feedback report (`generateFeedback` in `src/lib/claude.ts`) ranks answers the way a real interviewer would. Run it before and after changing the feedback prompt, the rubric, or the model.

## Cases

`cases.json`: 13 bank questions, each answered at three known levels (strong, average, weak), plus 3 non-answers. Review them in `CASES.md` (regenerate with `node evals/feedback/cases-to-md.mjs`, which also validates the cases against the bank).

- Hand-written, so cleaner than real speech-to-text. Replace some with real practice transcripts over time.
- Technical cases are voice-only transcripts with no code, so they'll score 1 on the newer Implementation rubric item at every level. The ordering checks still work, but add code to some technical cases to test that item.
- `length-trap` cases (short strong answers, long weak ones) stop a "longer is better" grader from passing.

## Grading

Plain code checks, no AI judge:

| Metric | Pass when |
|---|---|
| Score ordering (per question) | Every strong case's mean rubric score > the average case's > every weak case's |
| Recommendation ordering | strong ≥ average ≥ weak on the hire scale, and strong > weak |
| Floor | Non-answers score ≤ 1.5 on average and get `no_hire` or `strong_no_hire` |
| Evidence grounding | Every quoted phrase (4+ words) in the feedback's evidence actually appears in the candidate's words |
| Format | Every rubric dimension and the question's review are present |

Also recorded per case: latency, tokens, and cost. Each case runs twice to measure run-to-run noise.

Resolution: with 13 question groups × 2 runs, the ordering pass rate is only good to roughly ±20 points, so treat it as a smoke test for big regressions, not a fine-grained score.

## Running it

The grader is `grade.ts` (plain code, unit-tested in `grade.test.ts`, which runs with the normal `npm test`). The runner, `run.eval.ts`, only runs on demand, because it calls the real model:

```bash
npm run eval:feedback                                   # every case, twice (EVAL_RUNS=2): about 96 feedback reports
EVAL_RUNS=1 EVAL_ONLY=two-sum npm run eval:feedback     # one question's cases, once: cheap, for a quick check
MOCK_AI=1 EVAL_RUNS=1 npm run eval:feedback             # free dry run of the pipeline (mock feedback, so the grades mean nothing)
```

Each run writes a Markdown report and the raw results (JSON) to `results/` (gitignored; copy a report into a PR when you change the prompt, rubric or model). The run fails only if a report is malformed (missing a rubric dimension or the question's review); the other checks are reported, not enforced, since with 13 question groups they're a smoke test, not a fine-grained score. The report ends with the run's total tokens (input, output and cache), from the same usage the server logs for every call (`claude usage {...}` lines).

