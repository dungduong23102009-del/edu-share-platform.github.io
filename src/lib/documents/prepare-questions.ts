import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  normalizeQuestion,
  sourceCorrectChoice,
  validateQuizQuestion,
} from "@/lib/ai/question-validation";

export async function prepareQuestions(
  client: SupabaseClient<Database>,
  documentId: string,
  analysisRunId: string,
) {
  const existing = await client
    .from("question_solutions")
    .select("*")
    .eq("document_id", documentId)
    .eq("analysis_run_id", analysisRunId)
    .order("created_at")
    .order("question_id");
  if (existing.error) throw new Error("QUESTION_READ_FAILED");
  const source = await client
    .from("questions")
    .select("*")
    .eq("document_id", documentId)
    .eq("analysis_run_id", analysisRunId)
    .order("created_at")
    .order("id");
  if (source.error) throw new Error("QUESTION_READ_FAILED");
  const preparedIds = new Set(existing.data.map((item) => item.question_id));
  const pending: Database["public"]["Tables"]["question_solutions"]["Insert"][] =
    source.data
      .filter((item) => !preparedIds.has(item.id))
      .map((question) => {
        const rawChoices =
          Array.isArray(question.choices) &&
          question.choices.every((value) => typeof value === "string")
            ? (question.choices as string[])
            : [];
        const prepared = normalizeQuestion({
          questionText: question.question_text,
          choices: rawChoices,
          sourceExcerpt: question.source_excerpt,
        });
        const hasSource =
          question.answer_origin === "source" &&
          question.correct_answer !== null;
        const correctChoice = hasSource
          ? sourceCorrectChoice(question.correct_answer, prepared.choices)
          : null;
        const origin = hasSource ? "source" : "none";
        const validation = validateQuizQuestion({
          ...prepared,
          correctChoice,
          answerOrigin: origin,
          confidence: question.extraction_confidence,
        });
        const supported =
          ["multiple_choice", "calculation", "short_answer"].includes(
            prepared.originalType,
          ) && [0, 4].includes(rawChoices.length);
        return {
          question_id: question.id,
          document_id: documentId,
          analysis_run_id: analysisRunId,
          question_text: prepared.questionText,
          raw_question_text: prepared.rawQuestionText,
          choices: prepared.choices,
          raw_choices: prepared.rawChoices,
          original_type: prepared.originalType,
          correct_answer: hasSource ? question.correct_answer : null,
          correct_choice: correctChoice,
          answer_origin: origin,
          quiz_ready: validation.quizReady,
          needs_review: validation.needsReview,
          parsing_warnings: prepared.parsingWarnings,
          solver_status: hasSource
            ? "not_needed"
            : prepared.parsingWarnings.length
              ? "needs_review"
              : !supported
                ? "unsupported"
                : "pending",
        };
      });
  if (pending.length) {
    const inserted = await client
      .from("question_solutions")
      .upsert(pending, { onConflict: "question_id", ignoreDuplicates: true });
    if (inserted.error) throw new Error("QUESTION_PREPARATION_FAILED");
    const refreshed = await client
      .from("question_solutions")
      .select("*")
      .eq("document_id", documentId)
      .eq("analysis_run_id", analysisRunId)
      .order("created_at")
      .order("question_id")
      // Re-read after the insert instead of React reusing the earlier GET in this render.
      .abortSignal(new AbortController().signal);
    if (refreshed.error) throw new Error("QUESTION_READ_FAILED");
    return { solutions: refreshed.data, sourceQuestions: source.data };
  }
  return { solutions: existing.data, sourceQuestions: source.data };
}
