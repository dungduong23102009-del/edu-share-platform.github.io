import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getDocumentProvider } from "@/lib/ai/registry";
import { GEMINI_MODEL } from "@/lib/ai/config";
import { AnalysisError, analysisError } from "@/lib/ai/errors";
import { DOCUMENT_BUCKET, PDF_MIME, validateContent } from "./validation";

export async function runDocumentAnalysis(
  client: SupabaseClient<Database>,
  document: Database["public"]["Tables"]["documents"]["Row"],
  runId: string,
) {
  const started = Date.now();
  const signal = AbortSignal.timeout(180000);
  let category: string | null = null;
  let success = false;
  try {
    const provider = getDocumentProvider();
    const result = await client.storage
      .from(DOCUMENT_BUCKET)
      .download(document.storage_path);
    if (result.error || !result.data)
      throw new AnalysisError("download_failed");
    const bytes = new Uint8Array(await result.data.arrayBuffer());
    if (
      bytes.length !== document.file_size ||
      createHash("sha256").update(bytes).digest("hex") !==
        document.file_sha256 ||
      validateContent(document.original_filename, bytes)
    )
      throw new AnalysisError("corrupt_document");
    const onStage = async (stage: "reading" | "extracting" | "saving") => {
      const updated = await client
        .from("documents")
        .update({ analysis_stage: stage })
        .eq("id", document.id)
        .eq("user_id", document.user_id)
        .eq("analysis_run_id", runId)
        .eq("status", "processing")
        .select("id");
      if (updated.error || !updated.data?.length)
        throw new AnalysisError("save_failed");
    };
    const analysis = await provider.analyzeDocument({
      bytes,
      format: document.mime_type === PDF_MIME ? "PDF" : "DOCX",
      signal,
      onStage,
    });
    signal.throwIfAborted();
    await onStage("saving");
    const saved = await client.rpc("complete_document_analysis", {
      p_document_id: document.id,
      p_run_id: runId,
      p_model: provider.model,
      p_analysis: analysis,
    });
    if (saved.error || !saved.data) throw new AnalysisError("save_failed");
    success = true;
  } catch (error) {
    category = analysisError(error).category;
    // Compare the nonce so a late worker cannot overwrite a newer analysis.
    const failed = await client
      .from("documents")
      .update({
        status: "failed",
        analysis_stage: "failed",
        analysis_error: category,
        analysis_expires_at: null,
      })
      .eq("id", document.id)
      .eq("user_id", document.user_id)
      .eq("analysis_run_id", runId)
      .eq("status", "processing");
    if (failed.error && process.env.NODE_ENV === "development")
      console.info("[analysis] failure_status_save_failed", document.id);
  } finally {
    if (process.env.NODE_ENV === "development")
      console.info(
        "[analysis]",
        JSON.stringify({
          documentId: document.id,
          model: GEMINI_MODEL,
          durationMs: Date.now() - started,
          success,
          errorCategory: category,
        }),
      );
  }
}
