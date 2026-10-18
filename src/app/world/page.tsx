import type { Metadata } from "next";
import World from "@/components/world/World";

export const metadata: Metadata = {
  title: "extraview · 3D practice world",
};

export default function WorldPage() {
  return <World />;
}
