# Contributing

## How we work

1. **Branch** from `main` (`feat/…`, `fix/…`, `docs/…`).
2. **Commit** with [conventional commits](https://www.conventionalcommits.org): `feat(world): …`, `fix(api): …`, `docs: …`, `test: …`, `chore: …`. Say what changed and why in plain words.
3. **Open a pull request** with the same kind of title, and a short description: what, why, and how you checked it (screenshots for anything visual).
4. **CI** checks types, lint, unit tests and a production build on every PR. Run `npm run check` before pushing to catch most of it locally.
5. **Merge** with a merge commit once CI is green and someone else has had a look.

## Running things

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY, or MOCK_AI=1 to run with no key
npm run dev
```

Never commit `.env.local` or paste API keys into issues, PRs or chats.

## Changing the interviewer or the feedback

Prompts, the rubric and the model all change what feedback people get. Before and after such a change, run the feedback eval (`npm run eval:feedback`, see `evals/feedback/README.md`) and put the report in the PR. It calls the real model, so start small: `EVAL_RUNS=1 EVAL_ONLY=two-sum`.

## The 3D world

The scene is React Three Fiber on three.js (WebGL 2), with custom shaders for the painted look. Keep it light: instanced meshes for anything there are many of, merged geometry for static clusters, and check the effect on the automatic quality levels (`quality.ts`). If you add something people can walk into, teach `walkable()` (in `island.tsx`) about it, and add a test to `explore.test.ts`.
