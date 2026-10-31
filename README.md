# pipterview ⋆⭒˚.⋆

**an extra view for your interviews.**

▶ **[Watch the demo video](https://www.youtube.com/watch?v=_IsdBJio0c0)**

![A practice interview with Pip: the chick sits across the table while the chat panel shows the conversation](docs/screenshots/interview-with-pip.png)

## What is it?

A 3D world to help tech students overcome interview anxiety.

![The pipterview home screen: a welcome card over a floating island, with behavioral, technical and resume quiz rounds](docs/screenshots/home.png)

## Why

As students in tech, we know getting chosen for an interview is like finding the pot of gold at the end of the rainbow.

But what happens when we're too lost, overwhelmed and anxious to know how to prepare?

Seeking help is hard, and starting is often the biggest mountain.

That's why we made **pipterview**: another set of eyes, ears and advice for the words you can't quite get out, the code you don't know how to write, the skills you can't explain.

To make interview prep less scary, and ultimately an everyday part of your life. Consistency over catastrophe.

## How it works

Add context about yourself, like your resume or target roles, and choose which type of interview (behavioral, technical, resume skills quiz) you want to practice.

Talk through it with Pip, building skills and seeing a summary of your performance after each session. Keep going to grow plants on your island garden, and when you get better at something (fewer filler words, less hedging, calmer going in), wildflowers bloom too.

**Start practising** takes you straight to the table. Before the first question, Pip checks in on how nervous you are, and if it's a lot, you can breathe together for a minute first. The Island panel shows how you're doing over time: your nerves settling, your filler words dropping.

Or wander the island first: walk with **WASD** or the arrow keys (Shift to run), or click (or tap) where you want to go, drag to look around and scroll to zoom. Say hi to the frog, the ducks and the koi (press 1, 2, 3 when you're by one), sit on a bench, and press **E** at the table when you're ready. On a phone there's a joystick.

![The island: a windmill, cottage, stream and pond, with you and Pip at a little table, ready to sit down](docs/screenshots/island.png)

Technical mocks happen in our own code editor, built on **Monaco Editor**, with Python running in the browser through **Pyodide** (the real Python interpreter compiled to WebAssembly). It includes a **test-harness generator** for Java, C++ and C, a grading layer, and **exact or any-order comparison** for questions with multiple correct answers.

## Made with

- Next.js 16, React 19, TypeScript
- Three.js + React Three Fiber
- Tailwind CSS
- Claude via the Anthropic SDK
- ElevenLabs

## Run it locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY, or set MOCK_AI=1 to run without one
npm run dev
```

Open http://localhost:3000 in Chrome or Edge (voice input needs the Web Speech API).

| Variable | |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `ELEVENLABS_API_KEY` | Optional, for Pip's voice (falls back to the browser voice) |
| `MOCK_AI=1` | Scripted interviewer, no key needed |

## Your data

Your island, stories and progress stay **in your browser**: no accounts, no cookies, no analytics. **Help → Your data** lets you download a backup, restore it in another browser, or delete everything. [What gets sent where](src/app/privacy/page.tsx) (also at `/privacy` in the app) explains what goes to Anthropic, Google's speech service and ElevenLabs.

## Known limitations

- Everything is stored **locally**, so a new browser starts fresh unless you restore a backup.
- Talking to the interviewer is still finicky, especially in a **back-and-forth conversation**. Sometimes we'd get cut off or talked over, not ideal when you're prepping for interviews.
- C, C++ and Java are turned off in the deployed app for safety: they run on a server, and **running other people's code needs a proper sandbox**. Until we add one, only Python, JavaScript and TypeScript run in the deployed app, straight in the browser.
- **API limits:** public users are rate-limited, so anyone can use the app, but not indefinitely.
- The 3D island is heavy for older laptops. It measures itself and steps down automatically, and **Sound & graphics → Lite** turns the effects off.

## For developers

```bash
npm run dev            # http://localhost:3000 (MOCK_AI=1 for a scripted interviewer, no key needed)
npm run check          # types, lint and unit tests (what CI runs, plus the build)
npm run eval:feedback  # grades the feedback against 48 hand-written answers; calls the real model, see evals/feedback
```

Every pull request runs CI (types, lint, tests and a production build). See [CONTRIBUTING.md](CONTRIBUTING.md) for how we work.

Where things live:

| | |
|---|---|
| `src/lib/interview/` | The interviewer: question bank, session flow, prompts, delivery habits |
| `src/lib/claude.ts` | Calls to Claude (interviewer turns and the feedback report) |
| `src/components/world/World.tsx` | The page: every screen, panel and prompt over the 3D scene |
| `src/components/world/WorldScene.tsx` | The 3D scene: camera, lights, and what's in it |
| `src/components/world/island.tsx`, `landscape.tsx`, `pond.tsx`, `village.tsx` | The island, its plants and sky, the pond and its creatures, the buildings and benches |
| `src/components/world/player.tsx`, `explore.ts` | Walking about as your chick |
| `src/components/world/effects.tsx`, `toon.ts`, `quality.ts` | The painted look (shaders and post-processing) and the automatic quality levels |
| `evals/feedback/` | The feedback eval: cases, grader and runner |

## What's next

- **System design interviews** as one of the selectable rounds.
- More customization, and more testing with real students: which interviews are hardest to prepare for, honest critique of the game-like idea, and whether it actually reduces friction-induced anxiety.
- **Community features,** so students can mock interview each other inside the 3D world.

---

thanks for checking out pipterview ٩(^ᗜ^ )و ´- until next time...
