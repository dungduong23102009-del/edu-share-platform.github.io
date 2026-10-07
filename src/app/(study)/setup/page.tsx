import { QuizSetup } from "@/components/quiz-setup";
import { DocumentQuizSetup } from "@/components/document-quiz-setup";
import { loadDocumentAnalysis } from "@/lib/documents/load-analysis";
import { requireUser } from "@/lib/supabase/queries";
import { UUID_PATTERN } from "@/lib/documents/validation";
import {
  validateQuizQuestion,
  CHOICE_KEYS,
} from "@/lib/ai/question-validation";
import type { Question } from "@/lib/types";
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
    const questions: Question[] = view.solutions
      .filter((solution) => {
        const source = view.sourceQuestions.find(
          (item) => item.id === solution.question_id,
        );
        const allowed =
          !selected.length ||
          !source?.topic_id ||
          selected.includes(source.topic_id);
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
      })
      .map((solution) => {
        const source = view.sourceQuestions.find(
          (item) => item.id === solution.question_id,
        )!;
        return {
          id: solution.question_id,
          topicId: source.topic_id || "unassigned",
          prompt: solution.question_text,
          choices: (solution.choices as string[]).map((text, index) => ({
            id: CHOICE_KEYS[index],
            text,
          })),
          correctId: solution.correct_choice!,
          explanation:
            solution.explanation ||
            `Đáp án ${solution.correct_answer} được ghi trong tài liệu nguồn.`,
          page: source.source_page,
          source: solution.answer_origin === "source" ? "document" : "ai",
          origin: solution.answer_origin === "source" ? "source" : "ai_derived",
        };
      });
    return (
      <DocumentQuizSetup
        key={documentId}
        documentId={documentId}
        title={view.analysis?.documentTitle || view.document.original_filename}
        documentName={view.document.original_filename}
        questions={questions}
      />
    );
  }
  return <QuizSetup />;
}
