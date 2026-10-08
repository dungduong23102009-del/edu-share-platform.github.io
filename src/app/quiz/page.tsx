import { QuizPlayer } from "@/components/quiz-player";
import { requireUser } from "@/lib/supabase/queries";
import { RealQuizPlayer } from "@/components/real-quiz-player";
import { loadQuiz } from "@/lib/quizzes/server";
import { UUID_PATTERN } from "@/lib/documents/validation";
import { notFound, redirect } from "next/navigation";
export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ attemptId?: string }>;
}) {
  const { client } = await requireUser();
  const { attemptId } = await searchParams;
  if (attemptId) {
    if (!UUID_PATTERN.test(attemptId)) notFound();
    const quiz = await loadQuiz(client, attemptId).catch(() => null);
    if (!quiz) notFound();
    if (quiz.completedAt) redirect(`/result?attemptId=${attemptId}`);
    return <RealQuizPlayer key={attemptId} quiz={quiz} />;
  }
  return <QuizPlayer />;
}
