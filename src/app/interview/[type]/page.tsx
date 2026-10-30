import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InterviewRoom } from "@/components/InterviewRoom";
import { getInterviewType } from "@/lib/interview/catalog";
import { INTERVIEW_TYPE_IDS, isInterviewTypeId } from "@/lib/interview/types";

export function generateStaticParams() {
  return INTERVIEW_TYPE_IDS.map((type) => ({ type }));
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
  return <InterviewRoom typeId={type} label={getInterviewType(type).label} />;
}
