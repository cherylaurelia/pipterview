import type { Metadata } from "next";
import World from "@/components/world/World";

export const metadata: Metadata = {
  title: "Pip · Interview practice",
};

/** The island is the app: pick a round, sit down with Pip, practise out loud. */
export default function Home() {
  return <World />;
}
