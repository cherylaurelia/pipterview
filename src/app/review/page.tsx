import type { Metadata } from "next";
import Link from "next/link";
import { ReviewBoard } from "@/components/ReviewBoard";
import { INTERVIEW_TYPES } from "@/lib/interview/catalog";
import { INTERVIEW_TYPE_IDS } from "@/lib/interview/types";

export const metadata: Metadata = { title: "Question review · Pip" };

/** For mentors, recruiters, and anyone who has run real interviews. */
export default function ReviewPage() {
  return (
    <main className="min-h-screen bg-slate-50/60 px-4 py-12 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← Back
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Question review</h1>
          <p className="max-w-2xl leading-relaxed text-slate-600">
            If you&apos;ve interviewed candidates, tell us whether these match what real interviewers ask new grads. Each
            question shows exactly what the AI interviewer sees: what a strong answer covers, the follow-ups it escalates
            through, and the hints it gives.
          </p>
        </header>
        <ReviewBoard types={INTERVIEW_TYPE_IDS.map((id) => INTERVIEW_TYPES[id])} />
      </div>
    </main>
  );
}
