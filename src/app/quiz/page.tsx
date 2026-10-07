import { QuizPlayer } from "@/components/quiz-player";
import { requireUser } from "@/lib/supabase/queries";
export default async function QuizPage() {
  await requireUser();
  return <QuizPlayer />;
}
