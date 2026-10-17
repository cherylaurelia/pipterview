import type { Metadata } from "next";
import Link from "next/link";
import { ProgressView } from "@/components/ProgressView";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Your progress · Steady" };

export default function ProgressPage() {
  return (
    <main className="min-h-screen bg-slate-50/60">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
            Practice →
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your progress</h1>
          <p className="text-slate-600">Scores and nerves across your practice sessions. Stored only in this browser.</p>
        </div>
        <ProgressView />
      </div>
    </main>
  );
}
