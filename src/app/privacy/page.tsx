import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy · pipterview" };

// Plain words on what pipterview keeps and what it sends where. Keep this in step with the code: if a new service or a
// new kind of stored data is added, it belongs here.

const SECTIONS: [string, React.ReactNode][] = [
  [
    "What stays on your computer",
    <>
      Everything pipterview remembers lives only in your browser: your island and what you&apos;ve grown, your story bank, your
      practice history (scores, nerves check-ins, delivery habits), your resume text if you add one, and your settings. There
      are no accounts, no cookies and no analytics. You can download, restore or delete all of it from <b>Help → Your data</b>.
    </>,
  ],
  [
    "What gets sent to run an interview",
    <>
      To ask questions and write your feedback, what you say (as text), the code or whiteboard you&apos;re working on, and your
      resume text if you added one are sent to <b>Anthropic</b>&apos;s Claude API. pipterview&apos;s server doesn&apos;t keep any of
      it afterwards, except question ratings you choose to give (below).
    </>,
  ],
  [
    "Rating a question",
    <>
      If you rate a question in your feedback (was it realistic, was it too easy or too hard), that rating, the question&apos;s
      wording and any comment you write are saved on the server, to improve the question bank. For a question tailored to your
      resume, the wording can mention things from it, so leave the rating out if you&apos;d rather not share that.
    </>,
  ],
  [
    "Your voice",
    <>
      Speech-to-text happens in your browser. In Chrome, that means your audio goes to <b>Google</b>&apos;s speech service to be
      turned into text; pipterview only ever sees the text. You can always type instead.
    </>,
  ],
  [
    "Pip's voice",
    <>
      If the natural voice is switched on, the sentences Pip says are sent to <b>ElevenLabs</b> to be spoken. Otherwise your
      browser&apos;s own voice is used, and nothing leaves your computer for that.
    </>,
  ],
  [
    "Keeping things fair",
    <>
      To stop one visitor using up the service, the server counts requests per IP address for an hour, in memory only. It
      isn&apos;t stored or linked to anything else.
    </>,
  ],
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f3ead9] px-4 py-10 text-[#3d2a1c]">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-[13.5px] font-bold text-[#b0702a] hover:underline">
          ← Back to the island
        </Link>
        <h1 className="mt-4 text-[30px] font-bold tracking-tight">What gets sent where</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#6b5640]">The short version: your progress stays with you, and your answers are only sent out to run the interview.</p>
        <div className="mt-6 space-y-4">
          {SECTIONS.map(([title, body]) => (
            <section key={title} className="rounded-[20px] bg-[#fff8ec] px-5 py-4 ring-1 ring-[#f0dfc2]">
              <h2 className="text-[16px] font-bold">{title}</h2>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#4a3424]">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
