# The launch clip

A 20-second portrait clip (1080×1350, 30 fps) for social posts, made with [Remotion](https://www.remotion.dev) from real screens of the app. It's its own project, with its own dependencies, so the app doesn't carry them.

```bash
cd video
npm install
npm run studio   # preview and tweak it in the browser
npm run render   # writes out/pipterview-launch.mp4
npm run still    # writes out/poster.png (the end card), for a thumbnail
```

The shots, their timing and their captions are in `SHOTS` at the top of `src/Launch.tsx`.

## The screens

`public/screens/*.jpg` are screenshots of the app at 1400×900 and 1.5× pixel density, taken with `MOCK_AI=1` so no API calls are made:

- `home.jpg`: the home card over the island
- `chat.jpg`: a behavioural round, after one typed answer and Pip's follow-up
- `code.jpg`: a technical round with the editor open
- `sunset.jpg`: the sunset after "I'm done"

The report is left out on purpose: in mock mode its feedback is placeholder text. When the island or the panels change, retake the screens the same way so the clip stays true to the app.

## License

Remotion is free for individuals and companies of up to three people; larger teams need a [company license](https://www.remotion.dev/license).
