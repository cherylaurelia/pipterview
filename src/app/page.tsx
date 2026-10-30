import Link from "next/link";
import { ProgressSnapshot } from "@/components/ProgressSnapshot";
import { Logo } from "@/components/ui";
import { INTERVIEW_TYPES } from "@/lib/interview/catalog";
import { INTERVIEW_TYPE_IDS, type InterviewTypeId } from "@/lib/interview/types";

const ROUND_DETAILS: Record<InterviewTypeId, { minutes: number; what: string }> = {
  behavioral: { minutes: 25, what: "Stories about teamwork, mistakes, and what you've built" },
  technical: { minutes: 35, what: "Code in a real editor (Python, JavaScript, Java, C++) with tests" },
  "system-design": { minutes: 45, what: "Sketch on a whiteboard, then talk through trade-offs" },
};

const STEPS = [
  {
    title: "Start gentle",
    body: "A warm interviewer, extra hints, no clock. Your first reps should feel safe.",
  },
  {
    title: "Build up",
    body: "Turn up the pressure as you get comfortable. Each session is a little closer to the real thing.",
  },
  {
    title: "Watch the nerves fade",
    body: "Check in before and after each session and see your anxiety go down as your scores go up.",
  },
];

export default function Home() {
  return (
    <main className="flex-1 bg-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/progress" className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Progress
          </Link>
          <Link href="/review" className="rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            For mentors
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6 sm:pt-16">
        <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-100">
          For students and new grads in tech
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
          Interview nerves are normal. Practice until they fade.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          Steady is a mock interviewer you talk to out loud. Start with a gentle, low-stakes session, build up to real
          pressure at your own pace, and get honest, kind feedback on what to practice next.
        </p>
        <div className="mt-8 max-w-2xl">
          <ProgressSnapshot />
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Choose a round</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {INTERVIEW_TYPE_IDS.map((id) => {
              const type = INTERVIEW_TYPES[id];
              const details = ROUND_DETAILS[id];
              return (
                <li key={id}>
                  <Link
                    href={`/interview/${id}`}
                    className="group flex h-full flex-col rounded-2xl bg-white p-6 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 hover:ring-teal-300"
                  >
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">{type.label}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{details.what}</p>
                    <p className="mt-6 flex items-center justify-between text-sm">
                      <span className="text-slate-500">~{details.minutes} min</span>
                      <span className="font-medium text-teal-700 group-hover:text-teal-800">Start →</span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">How it helps with interview anxiety</h2>
        <ol className="mt-6 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-600 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-slate-500">
          This is gradual exposure: facing a feared situation in small, manageable steps, which is one of the most
          reliable ways to reduce anxiety. Steady is a practice tool, not therapy. If interview anxiety feels
          overwhelming, your campus counseling or career center can help.
        </p>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6">
          <span>Works best in Chrome or Edge. You can always type instead of talking.</span>
          <Link href="/review" className="hover:text-slate-800">
            Interviewed people before? Help review the questions →
          </Link>
        </div>
      </footer>
    </main>
  );
}
