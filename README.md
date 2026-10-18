# pipterview ⋆⭒˚.⋆

**an extra view for your interviews.**

A cozy 3D world that helps tech students get past interview anxiety, one practice round at a time.

---

## What is it?

A 3D practice island where you do mock interviews out loud with **Pip**, a friendly interviewer, instead of a chat box, a scary stranger or an uncanny avatar.

## Why

As students in tech, we know getting picked for an interview feels like finding the pot of gold at the end of the rainbow.

But what happens when you're too lost, overwhelmed and anxious to know how to prepare?

Seeking help is hard, and starting is often the biggest mountain.

That's why we made **pipterview**: another set of eyes, ears and advice for the words you can't quite get out, the code you don't know how to write, and the skills you can't explain.

To make interview prep less scary, and ultimately an everyday part of your life. **Consistency over catastrophe.**

## How it works

1. **Add context about yourself** (optional): your resume or the roles you're targeting.
2. **Pick a round:** behavioral, technical, or a resume skills quiz.
3. **Talk it through with Pip,** out loud or by typing. Pip asks follow-ups, gives hints and adapts when you're stuck.
4. **Get a summary of how you did** after each session.
5. **Grow your island.** Every finished session plants something new in your island garden.

### The coding environment

Technical mocks happen in our own coding environment, built on **Monaco** (the editor inside VS Code):

- **Python** runs in the browser through **Pyodide**, the real Python interpreter compiled to WebAssembly.
- **JavaScript and TypeScript** run in a sandboxed Web Worker with a time limit.
- **Java, C++ and C** compile and run on the server (local only, see limitations).
- A **test-harness generator** turns one problem definition into runnable tests in every language, with hidden test cases and **exact or any-order comparison** for questions with more than one correct answer.

## Made with

- Next.js 16, React 19, TypeScript
- Three.js + React Three Fiber
- Tailwind CSS
- Claude via the Anthropic SDK
- ElevenLabs (voice), Web Speech API (speech recognition)
- Monaco Editor, Pyodide (WebAssembly)
- Zod, Vitest, Vercel

## Designed for

Students recruiting for tech internships.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY, or MOCK_AI=1 to run without one
npm run dev
npm test
```

Open http://localhost:3000 in Chrome or Edge (voice input needs the Web Speech API; any browser can type answers). Java needs a JDK on the machine running the server (`brew install openjdk@21`); C++ needs clang or g++.

### Environment

| Variable | |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `MOCK_AI=1` | Scripted interviewer and placeholder feedback; no key or credits needed. |
| `CLAUDE_MODEL` | Optional model override (default `claude-opus-5-5`). |
| `ELEVENLABS_API_KEY` | Optional natural voice for Pip; falls back to the browser voice. |
| `ELEVENLABS_VOICE_ID` | Optional voice for Pip. |
| `ELEVENLABS_SPEED` | Optional speaking speed, `0.7` to `1.2` (default `1`). |
| `LOCAL_CODE_RUNNER=1` | Allow the Java/C++/C runner in production. Only do this behind a real sandbox. |
| `RATE_LIMIT=off` | Turn off the per-visitor rate limit on paid API routes. |

## Known limitations

- **Everything is stored locally,** for ease of access, so a new browser starts fresh.
- **Talking can still be finicky,** especially in a fast back-and-forth: you can occasionally get cut off or talked over. Push-to-talk avoids this, and typing always works.
- **Java, C++ and C are off in the deployed app.** They run on a server, and running strangers' code needs a proper sandbox. Until we add one, the deployed app runs Python, JavaScript and TypeScript, straight in the browser.
- **API limits:** public visitors are rate-limited, so anyone can use the app, just not indefinitely.

## Particularly proud of

- Bringing Pip to life as a 3D mascot with React Three Fiber and Three.js.
- Designing the Pip logo and the icons by hand.
- Spending real time scoping down, so the app tells one clear story.
- The coding environment, the part we were most nervous about: six languages, with errors and test runs for all of them.

## What's next

- **System design interviews** as a selectable round.
- **More customization,** plus more thorough testing with real students: which interviews are hardest to prepare for, honest critique of the game-like approach, and whether it really reduces friction-induced anxiety.
- **Community features,** so students can mock interview each other inside the 3D world.

---

thanks for checking out pipterview ٩(^ᗜ^ )و ´- until next time...
