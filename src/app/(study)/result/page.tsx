import { ResultSummary } from "@/components/results";
import { requireUser } from "@/lib/supabase/queries";
import { loadResult } from "@/lib/quizzes/server";
import { RealQuizResult } from "@/components/real-quiz-results";
import { UUID_PATTERN } from "@/lib/documents/validation";
import { notFound } from "next/navigation";
export default async function ResultPage({
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
    return <RealQuizResult key={attemptId} result={result} />;
  }
  return <ResultSummary />;
}
