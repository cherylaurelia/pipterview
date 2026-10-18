import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { InterviewRoom } from "@/components/InterviewRoom";
import { getInterviewType } from "@/lib/interview/catalog";
import { VISIBLE_INTERVIEW_TYPE_IDS, isInterviewTypeId, isVisibleInterviewTypeId } from "@/lib/interview/types";

export function generateStaticParams() {
  return VISIBLE_INTERVIEW_TYPE_IDS.map((type) => ({ type }));
}

export default function InterviewPage(props: PageProps<"/interview/[type]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <Room params={props.params} />
    </Suspense>
  );
}

async function Room({ params }: { params: PageProps<"/interview/[type]">["params"] }) {
  const { type } = await params;
  if (!isInterviewTypeId(type)) notFound();
  if (!isVisibleInterviewTypeId(type)) redirect("/"); // next.config.ts redirects these first; this is the backstop
  return <InterviewRoom typeId={type} label={getInterviewType(type).label} />;
}
