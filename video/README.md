# The launch clip

A 20-second portrait clip (1080×1350, 30 fps) for social posts, made with [Remotion](https://www.remotion.dev) from real screens of the app. It's its own project, with its own dependencies, so the app doesn't carry them.

```bash
cd video
npm install
npm run studio   # preview and tweak it in the browser
npm run render   # writes out/pipterview-launch.mp4
npm run still    # writes out/poster.png (the end card), for a thumbnail
npm run typecheck
```

The shots, their timing and their captions are in `SHOTS` at the top of `src/Launch.tsx`.

## The screens

`public/screens/*.jpg` are screenshots of the app at 1400×900 and 1.5× pixel density, taken with `MOCK_AI=1` so no API calls are made:

- `home.jpg`: the home card over the island
- `chat.jpg`: a behavioural round, after one typed answer and Pip's follow-up
- `code.jpg`: a technical round with the editor open
- `sunset.jpg`: the sunset after "I'm done"

The report is left out on purpose: in mock mode its feedback is placeholder text. When the island or the panels change, retake the screens so the clip stays true to the app:

1. From the repo root: `npx next build`, then `MOCK_AI=1 npx next start -p 3011`.
2. Open http://localhost:3011 in Chrome with DevTools' device toolbar set to 1400×900 and a device pixel ratio of 1.5. Clear the site's storage so you start fresh, then choose "Skip the tour".
3. `home.jpg`: the home card as it first appears.
4. `chat.jpg`: "Start practising", "Skip" on the check-in, then "I'll type instead". Send one answer (the one used: "In my last internship our team disagreed about whether to rewrite a flaky service…") and wait for Pip's follow-up.
5. `sunset.jpg`: "I'm done" there, then "Watch the sunset" on the report.
6. `code.jpg`: start fresh again, choose the Technical round, then "Skip" and "I'll type instead"; the editor opens with the problem.
7. Capture each with DevTools' "Capture screenshot" (it saves a PNG) and convert it to JPEG under the same name in `video/public/screens/`, for example `sips -s format jpeg -s formatOptions 93 shot.png --out video/public/screens/chat.jpg` on macOS. Then run `npm run render` from `video/`.

## License

Remotion is free for individuals and companies of up to three people; larger teams need a [company license](https://www.remotion.dev/license).
