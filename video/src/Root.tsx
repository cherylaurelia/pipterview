import { Composition } from "remotion";
import { FPS, Launch, LENGTH } from "./Launch";

export function Root() {
  // portrait, as social feeds show it; 20 seconds
  return <Composition id="Launch" component={Launch} durationInFrames={LENGTH} fps={FPS} width={1080} height={1350} />;
}
