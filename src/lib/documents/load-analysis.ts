import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { documentAnalysisSchema } from "@/lib/ai/schemas";
import { prepareQuestions } from "./prepare-questions";

export async function loadDocumentAnalysis(
  client: SupabaseClient<Database>,
  userId: string,
  id: string,
) {
  const expired = await client.rpc("expire_document_analysis", {
    p_document_id: id,
  });
  if (expired.error) throw new Error("ANALYSIS_READ_FAILED");
  const document = await client
    .from("documents")
    .select(
      "id, original_filename, status, analysis_stage, analysis_error, analysis_started_at",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (document.error) throw new Error("ANALYSIS_READ_FAILED");
  if (!document.data) return null;
  const expiredSolver = await client.rpc("expire_document_solver", {
    p_document_id: id,
  });
  if (expiredSolver.error) throw new Error("SOLVER_READ_FAILED");
  const result = await client
    .from("document_analyses")
    .select("current_run_id, raw_analysis, model, updated_at")
    .eq("document_id", id)
    .maybeSingle();
  if (result.error) throw new Error("ANALYSIS_READ_FAILED");
  const parsed = result.data
    ? documentAnalysisSchema.safeParse(result.data.raw_analysis)
    : null;
  const topics = result.data
    ? await client
        .from("topics")
        .select("id, title, summary, source_pages")
        .eq("document_id", id)
        .eq("analysis_run_id", result.data.current_run_id)
        .order("sort_order")
    : null;
  if (topics?.error || (parsed && !parsed.success))
    throw new Error("ANALYSIS_READ_FAILED");
  const prepared = result.data
    ? await prepareQuestions(client, id, result.data.current_run_id)
    : { solutions: [], sourceQuestions: [] };
  const job = await client
    .from("document_solver_jobs")
    .select("status,error,analysis_run_id")
    .eq("document_id", id)
    .maybeSingle();
  if (job.error) throw new Error("SOLVER_READ_FAILED");
  return {
    document: document.data,
    analysis: parsed?.success ? parsed.data : null,
    topics: topics?.data || [],
    solutions: prepared.solutions,
    sourceQuestions: prepared.sourceQuestions,
    solverJob:
      job.data?.analysis_run_id === result.data?.current_run_id
        ? job.data
        : null,
  };
}
export type AnalysisView = NonNullable<
  Awaited<ReturnType<typeof loadDocumentAnalysis>>
>;
