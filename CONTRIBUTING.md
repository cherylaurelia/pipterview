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

The scene is React Three Fiber on three.js (WebGL 2), with custom shaders for the painted look. Keep it light: instanced meshes for anything there are many of, merged geometry for static clusters, and check the effect on the automatic quality levels (`quality.ts`). If you add something people can walk into, teach the matching collision helper about it, and add a test to `explore.test.ts`: `walkable()` (in `island.tsx`) for water, buildings and the island's edge, `slideRoundPlants()` (in `landscape.tsx`) for trees and bushes, and `canStand()` / `setSeat()` (in `explore.ts`) for benches.

### Furniture in sand3d

The table, chairs, benches, cottage, windmill (and its sails) and dock are [sand3d](https://github.com/Sandflow-ai/sand3d) programs in `models/` (one file per model, its function named after it), exported to `public/models/*.glb` and loaded by `models.tsx`. To change one, edit its program and run `npm run models` (needs [uv](https://docs.astral.sh/uv/), which fetches Python 3.13 and sand3d with Blender's `bpy` on first run, about 750 MB; gltfpack then simplifies and compresses each file); `npm run models chair` builds one. Commit the program and its GLB together. Give every part a material whose colour is in the program (`s3d.material(part, "oak", color="#a77a4f")`): the world draws each part in the toon material of that colour. Code can pick a part out by its name to draw it its own way: the table's `top` glows on hover, the cottage's `walls` and `glass` get the painted look and the glow at dusk, and `pale(...)` lifts the shadows on pale parts. Anything that moves or glows on its own (the sails, lanterns, smoke) stays a separate model or stays in TSX. sand3d's `at` sets the rotation it's given rather than adding to it, so give the full angle in one call (`rx=90 + lean`). sand3d works in millimetres with Z up; the export is in metres with Y up, so a program's +Y is the world's -Z.

## The launch clip

`video/` is a separate [Remotion](https://www.remotion.dev) project that renders a 20-second clip from real screens of the app. See `video/README.md`; the app's typecheck, lint and CI leave it out.
