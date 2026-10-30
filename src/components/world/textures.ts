import * as THREE from "three";

/** A soft round dot (bright centre fading to clear), for clouds, mist and fireflies. */
export function softDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A lily pad seen from above: a round leaf with a notch cut out, a darker rim and veins running out from the middle. */
export function lilyPadTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 124);
  grad.addColorStop(0, "#9bd765");
  grad.addColorStop(0.75, "#6fbb4b");
  grad.addColorStop(1, "#4f9a3d");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(128, 128, 122, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(60, 110, 40, 0.45)";
  g.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.3;
    g.beginPath();
    g.moveTo(128, 128);
    g.quadraticCurveTo(128 + Math.cos(a + 0.1) * 60, 128 + Math.sin(a + 0.1) * 60, 128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112);
    g.stroke();
  }
  // the notch, from the middle out to the edge
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.moveTo(128, 128);
  g.arc(128, 128, 130, -0.2, 0.2);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
