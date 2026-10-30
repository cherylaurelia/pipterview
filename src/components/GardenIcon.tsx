import Image from "next/image";
import type { GardenItemId } from "@/lib/garden";

// Each island item's drawing, in the same order as GARDEN_ITEMS.
const ICONS: Record<GardenItemId, string> = {
  flowerbed: "01-flower-bed",
  sunflowers: "02-sunflowers",
  lanternpost: "03-lantern-post",
  cherry: "04-cherry-blossom-tree",
  bench: "05-bench",
  beehive: "06-beehive",
  ducks: "07-ducks-on-the-pond",
  mushrooms: "08-mushroom-ring",
  birdhouse: "09-birdhouse",
  scarecrow: "10-scarecrow",
  balloon: "11-hot-air-balloon",
  apple: "12-apple-tree",
};

/** An island item's icon: full colour once grown, a faded grey version while it's still to come. */
export function GardenIcon({ id, size = 32, grown = true, className = "" }: { id: GardenItemId; size?: number; grown?: boolean; className?: string }) {
  return (
    <Image
      src={`/design/island/${ICONS[id]}.svg`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 ${grown ? "" : "opacity-35 grayscale"} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
