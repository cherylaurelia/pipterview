import { loadFont as loadCedarville } from "@remotion/google-fonts/CedarvilleCursive";
import { loadFont as loadTuffy } from "@remotion/google-fonts/Tuffy";
import type { ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// pipterview's launch clip: a calm, warm 20 seconds from real screens of the app (captured in mock mode; see
// video/README.md), in the app's own colours and type. Pip says hello, then the four moments of a round: the island
// you start from, the conversation, the code, and the sunset at the end.

const { fontFamily: tuffy } = loadTuffy("normal", { weights: ["400", "700"] });
const { fontFamily: script } = loadCedarville();

export const FPS = 30;
const s = (seconds: number) => Math.round(seconds * FPS);

const CREAM = "#f4ead9", INK = "#3d2a1c", CARAMEL = "#8a5a1c", BUTTER = "#ffc95c";

/** Each shot: when it starts, how long it lasts, and what it says. Shots overlap by `FADE` for the fade between them. */
const FADE = s(0.5);
const SHOTS = [
  { at: 0, for: s(3.2) },
  { at: s(2.7), for: s(4), screen: "home", line: "Practise interviews out loud,", sub: "with Pip, on a floating island.", from: [1, 1.06], focus: [50, 40] },
  { at: s(6.2), for: s(4.2), screen: "chat", line: "A real conversation.", sub: "Follow-ups and all, at your pace.", from: [1.02, 1.12], focus: [100, 35] },
  { at: s(9.9), for: s(3.9), screen: "code", line: "Code it, and talk it through.", sub: "Pip sees your code each time you answer.", from: [1.02, 1.1], focus: [92, 30] },
  { at: s(13.3), for: s(3.6), screen: "sunset", line: "Then a sunset, and kind feedback.", sub: "Your island grows with every round.", from: [1.08, 1], focus: [50, 55] },
  { at: s(16.4), for: s(3.6) },
] as const;
export const LENGTH = s(20);

/**
 * 0 → 1 → 0 over a shot: where two shots overlap, the old one fades out in the first half and the new one in over the
 * second, so it passes through the cream for a moment rather than stacking two captions (the first shot doesn't fade
 * in, the last doesn't fade out).
 */
function useShotOpacity(duration: number, first: boolean, last: boolean) {
  const f = useCurrentFrame();
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const fadeIn = first ? 1 : interpolate(f, [FADE / 2, FADE], [0, 1], clamp);
  const fadeOut = last ? 1 : interpolate(f, [duration - FADE, duration - FADE / 2], [1, 0], clamp);
  return Math.min(fadeIn, fadeOut);
}

function Title() {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 11, mass: 0.7 } });
  const bob = Math.sin(f / 9) * 6;
  const lineIn = (delay: number) => ({
    opacity: interpolate(f, [delay, delay + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(f, [delay, delay + 12], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px)`,
  });
  return (
    <AbsoluteFill style={{ background: CREAM, alignItems: "center", justifyContent: "center", gap: 36 }}>
      <Img src={staticFile("pip.png")} style={{ width: 300, transform: `scale(${pop}) translateY(${bob}px)` }} />
      <div style={{ textAlign: "center", fontFamily: tuffy, color: INK }}>
        <div style={{ fontSize: 76, fontWeight: 700, ...lineIn(s(0.6)) }}>Interviews are scary.</div>
        <div style={{ fontFamily: script, fontSize: 64, color: CARAMEL, marginTop: 18, ...lineIn(s(1.4)) }}>practice doesn&apos;t have to be.</div>
      </div>
    </AbsoluteFill>
  );
}

/** A screen of the app in a soft card, slowly pushing in (or easing out) on what matters, under its caption. */
function Screen({ screen, line, sub, from, focus, duration }: { screen: string; line: string; sub: string; from: readonly [number, number]; focus: readonly [number, number]; duration: number }) {
  const f = useCurrentFrame();
  const t = interpolate(f, [0, duration], [0, 1], { easing: Easing.inOut(Easing.quad) });
  const zoom = from[0] + (from[1] - from[0]) * t;
  const words = interpolate(f, [s(0.2), s(0.7)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: CREAM, padding: "120px 56px 0", fontFamily: tuffy, color: INK }}>
      <div style={{ opacity: words, transform: `translateY(${(1 - words) * 14}px)` }}>
        <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.1 }}>{line}</div>
        <div style={{ fontSize: 36, color: CARAMEL, marginTop: 14 }}>{sub}</div>
      </div>
      <div style={{ marginTop: 64, height: 820, borderRadius: 36, overflow: "hidden", boxShadow: "0 30px 70px rgba(70,45,20,0.25)", border: "6px solid #fffaf1" }}>
        <Img src={staticFile(`screens/${screen}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focus[0]}% ${focus[1]}%`, transform: `scale(${zoom})`, transformOrigin: `${focus[0]}% ${focus[1]}%` }} />
      </div>
    </AbsoluteFill>
  );
}

function EndCard() {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const rise = spring({ frame: f, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ background: CREAM, alignItems: "center", justifyContent: "center", fontFamily: tuffy, color: INK, textAlign: "center" }}>
      <Img src={staticFile("pip.png")} style={{ width: 220, transform: `translateY(${(1 - rise) * 40}px)`, opacity: rise }} />
      <div style={{ fontSize: 110, fontWeight: 700, marginTop: 28, opacity: rise }}>pipterview</div>
      <div style={{ fontFamily: script, fontSize: 58, color: CARAMEL, marginTop: 6, opacity: rise }}>an extra view for your interviews.</div>
      <div style={{ marginTop: 70, padding: "22px 44px", borderRadius: 999, background: BUTTER, fontSize: 40, fontWeight: 700, opacity: interpolate(f, [s(0.8), s(1.3)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        github.com/cherylaurelia/pipterview
      </div>
    </AbsoluteFill>
  );
}

function Shot({ index, children }: { index: number; children: ReactNode }) {
  const opacity = useShotOpacity(SHOTS[index].for, index === 0, index === SHOTS.length - 1);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export function Launch() {
  return (
    <AbsoluteFill style={{ background: CREAM }}>
      {SHOTS.map((shot, i) => (
        <Sequence key={i} from={shot.at} durationInFrames={shot.for}>
          <Shot index={i}>
            {i === 0 ? <Title /> : "screen" in shot ? <Screen {...shot} duration={shot.for} /> : <EndCard />}
          </Shot>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
