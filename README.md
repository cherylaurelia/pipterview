# Steady

Interview practice for nervous candidates. Undergrads and new grads going after SWE, PM, data, FDE, and other tech roles talk to an AI interviewer out loud, starting gentle and building up to real pressure, and get honest, kind feedback.

Built for the **well-being track**: the product applies gradual exposure to interview anxiety.
- **Pressure levels** (gentle → standard → realistic) change how the interviewer behaves, whether there's a clock, and how quickly hints come.
- **Check-ins** before and after each session track nerves over time on the progress page.
- **Breathing exercise** before starting and whenever you pause; **"ask for a moment to think"** normalizes a real-interview habit.
- **Feedback** leads with strengths, frames weaknesses as next steps, says "readiness" instead of hire/no-hire, and coaches delivery (pace, filler words, rambling) where nerves show first.

## Run it

```bash
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY, or MOCK_AI=1 to run without one
npm run dev
npm test                      # unit tests (flow logic, delivery stats, coding specs, Java/C++ drivers)
```

Open http://localhost:3000 in Chrome or Edge (voice input needs the Web Speech API; any browser can type answers). Java needs a JDK on the machine running the server (`brew install openjdk@21`); C++ needs clang or g++.

In a Superset workspace, setup installs dependencies and copies `.env.local` from the main checkout, and the **Run** button starts the dev server on a free per-workspace port (see `.superset/`).

## How it works

```
hold to talk ─▶ speech-to-text ─▶ POST /api/interview/turn ─▶ Claude ─▶ text-to-speech
 (browser)       (Web Speech)       (flow + prompt)                     (speechSynthesis)
```

- **Voice loop** — `src/lib/voice/`. `usePushToTalk` wraps browser speech recognition. Hands-free by default: the mic opens when Alex finishes and an answer sends after a pause (longer in gentle mode) or on "that's my answer"; push-to-talk is a toggle. `speak` reads lines aloud sentence by sentence; talking interrupts it. Both are behind small interfaces so a hosted STT/TTS service can replace them.
- **Interviewer logic** — `src/lib/interview/`.
  - `catalog.ts`: interview types, question banks, rubrics, and pacing. Edit this to change the categories or questions.
  - `flow.ts`: the state machine (opening → questions with follow-ups → "any questions for me?" → done). The server decides where the interview is; each turn the model picks one allowed action (`clarify`, `hint`, `follow_up`, `next_question`, `end_interview`) and writes what to say.
  - `prompts.ts`: the interviewer persona, per-turn directives, and the feedback prompt and schema.
- **Claude calls** — `src/lib/claude.ts`. Structured output for every turn and for the feedback report. Per-turn directives are mid-conversation system messages, so the conversation only ever grows by appending.
- **Workspaces** — `src/components/workspace/`. Technical rounds get a Monaco editor in Python, JavaScript, Java, or C++, run against each problem's visible and hidden tests. Python and JavaScript run in the browser (`public/workers/`); Java and C++ compile and run on the server (`src/lib/server/`, dev-only by default because it executes candidate code). Specs live in `src/lib/interview/coding.ts`. System design rounds get an Excalidraw whiteboard with a component palette plus notes. The latest code and test results, or the diagram (image plus a text summary) and notes, go to the interviewer with each answer that changed them, and to the feedback report at the end.
- **3D scene** — `src/components/scene/`. Placeholder boxes for the table and the two characters. Each piece is its own component, driven by an `activity` prop (`idle`, `speaking`, `listening`, `thinking`), so the designed models can replace them one at a time.

## Environment

| Variable | |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key. |
| `MOCK_AI=1` | Scripted interviewer and placeholder feedback; no key or credits needed. |
| `CLAUDE_MODEL` | Optional model override (default `claude-opus-5-5`). |
| `ELEVENLABS_API_KEY` | Optional natural interviewer voice; falls back to the browser voice. |
| `LOCAL_CODE_RUNNER=1` | Allow the Java/C++ runner in production. Only do this behind a real sandbox. |
