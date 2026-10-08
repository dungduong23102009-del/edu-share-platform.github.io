import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSolverProvider } from "@/lib/ai/registry";
import { claudeErrorCategory } from "@/lib/ai/claude-provider";
import { SOLVER_SETTINGS } from "@/lib/ai/solver-settings";
import { documentAnalysisSchema } from "@/lib/ai/schemas";
import {
  solverInputSchema,
  validateSolvedBatch,
  type SolverInput,
} from "@/lib/ai/solver-schemas";

export async function runDocumentSolver(
  client: SupabaseClient<Database>,
  documentId: string,
  runId: string,
  ids: string[],
) {
  const started = Date.now();
  const signal = AbortSignal.timeout(SOLVER_SETTINGS.workerTimeoutMs);
  let failure: string | null = null;
  let model: string | null = null;
  let batchCount = 0;
  try {
    const provider = getSolverProvider();
    model = provider.model;
    await provider.healthCheck(); // A small check before any question reaches the gateway.
    const records = await client
      .from("question_solutions")
      .select("*")
      .eq("document_id", documentId)
      .eq("solver_run_id", runId)
      .eq("solver_status", "processing")
      .in("question_id", ids);
    const source = await client
      .from("questions")
      .select("id, correct_answer, answer_origin, topic_id, source_excerpt")
      .eq("document_id", documentId)
      .in("id", ids);
    const analysisRecord = await client
      .from("document_analyses")
      .select("raw_analysis, current_run_id")
      .eq("document_id", documentId)
      .single();
    const topics = await client
      .from("topics")
      .select("id,title")
      .eq("document_id", documentId);
    if (records.error || source.error || analysisRecord.error || topics.error)
      throw new Error("SOLVER_READ_FAILED");
    const analysis = documentAnalysisSchema.parse(
      analysisRecord.data.raw_analysis,
    );
    const jobs = records.data.filter((solution) => {
      const original = source.data.find(
        (item) => item.id === solution.question_id,
      );
      return (
        original &&
        original.correct_answer === null &&
        original.answer_origin === "not_provided" &&
        solution.analysis_run_id === analysisRecord.data.current_run_id
      );
    });
    const batches: (typeof jobs)[] = [];
    let current: typeof jobs = [];
    let size = 0;
    for (const job of jobs) {
      const length =
        job.question_text.length + JSON.stringify(job.choices).length + 3100;
      if (
        current.length &&
        (current.length >= SOLVER_SETTINGS.batchSize ||
          size + length > SOLVER_SETTINGS.batchCharacters)
      ) {
        batches.push(current);
        current = [];
        size = 0;
      }
      current.push(job);
      size += length;
    }
    if (current.length) batches.push(current);
    batchCount = batches.length;
    let nextBatch = 0;
    let stopScheduling = false;
    async function consume() {
      while (!stopScheduling && nextBatch < batches.length) {
        const batch = batches[nextBatch++];
        const batchStarted = Date.now();
        try {
          signal.throwIfAborted();
          const inputs: SolverInput[] = batch.map((job, index) => {
            const original = source.data!.find(
              (item) => item.id === job.question_id,
            )!;
            const topic =
              topics.data!.find((item) => item.id === original.topic_id)
                ?.title || null;
            const theory = analysis.theoryPoints
              .filter((point) => point.topicTitle === topic)
              .slice(0, 2)
              .map((point) => point.content)
              .join("\n")
              .slice(0, 2500);
            // Only these fields, with request-local aliases: no user/profile/tokens/file metadata.
            return solverInputSchema.parse({
              id: `q${index + 1}`,
              questionText: job.question_text,
              choices: job.choices,
              originalType: job.original_type,
              topic,
              relevantTheory: theory || null,
              sourceExcerpt: original.source_excerpt,
            });
          });
          const response = await provider.solveBatch(inputs, signal);
          const results = validateSolvedBatch(
            { results: response.results },
            inputs,
          );
          const saved = await client.rpc("complete_question_solutions_v2", {
            p_document_id: documentId,
            p_run_id: runId,
            p_model: response.model || provider.model,
            p_results: results.map((result) => ({
              ...result,
              id: batch[inputs.findIndex((item) => item.id === result.id)]
                .question_id,
            })),
          });
          if (saved.error || saved.data !== batch.length)
            throw new Error("SOLVER_SAVE_FAILED");
          if (process.env.NODE_ENV === "development")
            console.info(
              "[solver]",
              JSON.stringify({
                provider: provider.name,
                model: provider.model,
                reportedModel: response.model || provider.model,
                questionCount: batch.length,
                durationMs: Date.now() - batchStarted,
                status: "saved",
                usage: response.usage,
              }),
            );
        } catch (error) {
          const category = claudeErrorCategory(error);
          failure = category;
          if (category !== "invalid_output") stopScheduling = true;
          const failed = await client
            .from("question_solutions")
            .update({ solver_status: "solver_failed", solver_error: category })
            .eq("document_id", documentId)
            .eq("solver_run_id", runId)
            .eq("solver_status", "processing")
            .in(
              "question_id",
              batch.map((item) => item.question_id),
            );
          if (failed.error) failure = "save_failed";
        }
      }
    }
    await Promise.all(
      Array.from(
        { length: Math.min(SOLVER_SETTINGS.concurrency, batches.length) },
        () => consume(),
      ),
    );
  } catch (error) {
    failure = claudeErrorCategory(error);
  } finally {
    const finished = await client.rpc("finish_document_solver", {
      p_document_id: documentId,
      p_run_id: runId,
      p_error: failure || undefined,
    });
    if (finished.error) failure = "save_failed";
    if (process.env.NODE_ENV === "development")
      console.info(
        "[solver]",
        JSON.stringify({
          provider: "claude",
          model,
          questionCount: ids.length,
          batchCount,
          durationMs: Date.now() - started,
          status: failure ? "failed" : "ready",
          errorCategory: failure,
        }),
      );
  }
}
