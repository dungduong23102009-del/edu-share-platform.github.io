import { AnswerReview } from "@/components/results";
import { requireUser } from "@/lib/supabase/queries";
import { loadResult } from "@/lib/quizzes/server";
import { RealAnswerReview } from "@/components/real-quiz-results";
import { UUID_PATTERN } from "@/lib/documents/validation";
import { notFound } from "next/navigation";
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ attemptId?: string }>;
}) {
  const { attemptId } = await searchParams;
  if (attemptId) {
    if (!UUID_PATTERN.test(attemptId)) notFound();
    const { client } = await requireUser();
    const result = await loadResult(client, attemptId).catch(() => null);
    if (!result) notFound();
    return <RealAnswerReview key={attemptId} result={result} />;
  }
  return <AnswerReview />;
}
