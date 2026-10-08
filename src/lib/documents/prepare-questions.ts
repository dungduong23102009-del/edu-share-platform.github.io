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
          ) && rawChoices.length <= 4;
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
  let changed = false;
  // Normalize previously saved rows locally without calling AI or replacing its answers.
  for (const previous of existing.data) {
    if (previous.solver_status === "processing") continue;
    const question = source.data.find(
      (item) => item.id === previous.question_id,
    );
    if (!question) continue;
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
      question.answer_origin === "source" && question.correct_answer !== null;
    const hasAI = !hasSource && previous.ai_model !== null;
    const choices = hasAI ? (previous.choices as string[]) : prepared.choices;
    const correctChoice = hasSource
      ? sourceCorrectChoice(question.correct_answer, choices)
      : previous.correct_choice;
    if (
      hasAI &&
      !prepared.choices.every((choice, index) => choices[index] === choice)
    )
      prepared.parsingWarnings.push(
        "Lựa chọn AI khác lựa chọn nguồn; cần đối chiếu.",
      );
    const supported =
      ["multiple_choice", "calculation", "short_answer"].includes(
        prepared.originalType,
      ) && rawChoices.length <= 4;
    const status = hasSource
      ? "not_needed"
      : hasAI
        ? previous.solver_status
        : prepared.parsingWarnings.length
          ? "needs_review"
          : !supported
            ? "unsupported"
            : ["unsupported", "needs_review"].includes(previous.solver_status)
              ? "pending"
              : previous.solver_status;
    const validation = validateQuizQuestion({
      ...prepared,
      choices,
      correctChoice,
      answerOrigin: hasSource ? "source" : previous.answer_origin,
      confidence: hasSource
        ? question.extraction_confidence
        : previous.ai_confidence,
      explanation: previous.explanation,
      status,
    });
    const update = {
      question_text: prepared.questionText,
      raw_question_text: prepared.rawQuestionText,
      raw_choices: prepared.rawChoices,
      original_type: prepared.originalType,
      choices,
      correct_choice: correctChoice,
      correct_answer: hasSource
        ? question.correct_answer
        : previous.correct_answer,
      answer_origin: hasSource ? "source" : previous.answer_origin,
      parsing_warnings: prepared.parsingWarnings,
      solver_status: status,
      quiz_ready: validation.quizReady,
      needs_review: validation.needsReview,
    };
    if (
      !Object.entries(update).some(
        ([key, value]) =>
          JSON.stringify(previous[key as keyof typeof previous]) !==
          JSON.stringify(value),
      )
    )
      continue;
    const saved = await client
      .from("question_solutions")
      .update(update)
      .eq("question_id", previous.question_id)
      .eq("document_id", documentId)
      .eq("updated_at", previous.updated_at)
      .neq("solver_status", "processing");
    if (saved.error) throw new Error("QUESTION_PREPARATION_FAILED");
    changed = true;
  }
  if (pending.length) {
    const inserted = await client
      .from("question_solutions")
      .upsert(pending, { onConflict: "question_id", ignoreDuplicates: true });
    if (inserted.error) throw new Error("QUESTION_PREPARATION_FAILED");
  }
  if (pending.length || changed) {
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
