import type { Metadata } from "next";
import { Cedarville_Cursive, Overpass_Mono, Tuffy } from "next/font/google";
import "./globals.css";

// Brand type: Tuffy for everything, Overpass Mono for code and numbers, Cedarville Cursive for handwritten accents.
const tuffy = Tuffy({ variable: "--font-tuffy", weight: ["400", "700"], style: ["normal", "italic"], subsets: ["latin"] });
const overpassMono = Overpass_Mono({ variable: "--font-overpass-mono", subsets: ["latin"] });
const cedarville = Cedarville_Cursive({ variable: "--font-cedarville", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "pipterview ⋆⭒˚.⋆ an extra view for your interviews",
  description:
    "Mock interviews out loud with Pip, on a cozy little island. For students in tech who know they should prep but can't bring themselves to start.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${tuffy.variable} ${overpassMono.variable} ${cedarville.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white text-slate-900">{children}</body>
    </html>
  );
}
