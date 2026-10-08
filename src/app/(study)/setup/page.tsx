import { QuizSetup } from "@/components/quiz-setup";
import { DocumentQuizSetup } from "@/components/document-quiz-setup";
import { loadDocumentAnalysis } from "@/lib/documents/load-analysis";
import { requireUser } from "@/lib/supabase/queries";
import { UUID_PATTERN } from "@/lib/documents/validation";
import { validateQuizQuestion } from "@/lib/ai/question-validation";
import { notFound } from "next/navigation";
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string; topics?: string }>;
}) {
  const { documentId, topics } = await searchParams;
  if (documentId) {
    if (!UUID_PATTERN.test(documentId)) notFound();
    const selected = topics?.split(",") || [];
    if (
      selected.some((topic) => !UUID_PATTERN.test(topic)) ||
      selected.length > 50
    )
      notFound();
    const { client, user } = await requireUser();
    const view = await loadDocumentAnalysis(client, user.id, documentId);
    if (!view || view.document.status !== "ready") notFound();
    const questions = view.solutions.filter((solution) => {
      const source = view.sourceQuestions.find(
        (item) => item.id === solution.question_id,
      );
      const allowed =
        !selected.length ||
        (!!source?.topic_id && selected.includes(source.topic_id));
      const checked = validateQuizQuestion({
        questionText: solution.question_text,
        choices: solution.choices as string[],
        correctChoice: solution.correct_choice,
        answerOrigin: solution.answer_origin,
        explanation: solution.explanation,
        confidence:
          solution.answer_origin === "source"
            ? (source?.extraction_confidence ?? null)
            : solution.ai_confidence,
        originalType: solution.original_type,
        parsingWarnings: solution.parsing_warnings as string[],
        status:
          solution.solver_status === "processing" && solution.quiz_ready
            ? "solved"
            : solution.solver_status,
      });
      return allowed && solution.quiz_ready && checked.quizReady;
    });
    return (
      <DocumentQuizSetup
        key={documentId}
        documentId={documentId}
        documentName={view.document.original_filename}
        available={questions.length}
        topicIds={selected}
      />
    );
  }
  return <QuizSetup />;
}
