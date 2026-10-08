import { RealHistory } from "@/components/real-quiz-results";
import { requireUser } from "@/lib/supabase/queries";
import { loadHistory } from "@/lib/quizzes/server";
import { HistoryPage } from "@/components/library";
export default async function HistoryRoute({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { client } = await requireUser();
  const { demo } = await searchParams;
  if (demo === "1" && process.env.NODE_ENV === "development")
    return <HistoryPage />;
  return <RealHistory attempts={await loadHistory(client)} />;
}
