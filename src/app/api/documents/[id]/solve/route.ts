import { after } from "next/server";
import { apiResponse, apiUser, sameOrigin } from "@/lib/supabase/api";
import { UUID_PATTERN } from "@/lib/documents/validation";
import { claudeConfig } from "@/lib/ai/config";
import { prepareQuestions } from "@/lib/documents/prepare-questions";
import { runDocumentSolver } from "@/lib/documents/solver";
export const runtime = "nodejs";
export const maxDuration = 240;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return apiResponse({ error: "Yêu cầu không hợp lệ." }, 403);
  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return apiResponse({ error: "Không tìm thấy tài liệu." }, 404);
  try {
    const { client, user } = await apiUser();
    if (!user) return apiResponse({ error: "Hãy đăng nhập lại." }, 401);
    const document = await client
      .from("documents")
      .select("id,status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (document.error)
      return apiResponse({ error: "Chưa thể đọc tài liệu." }, 503);
    if (!document.data)
      return apiResponse({ error: "Không tìm thấy tài liệu." }, 404);
    if (document.data.status !== "ready")
      return apiResponse(
        { error: "Hãy chờ phân tích tài liệu hoàn tất." },
        409,
      );
    let regenerate = false;
    if (request.body) {
      const reader = request.body.getReader();
      let bytes = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 1024) {
          await reader.cancel();
          return apiResponse({ error: "Yêu cầu không hợp lệ." }, 400);
        }
        chunks.push(value);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw) {
        const fields: unknown = JSON.parse(raw);
        if (
          !fields ||
          typeof fields !== "object" ||
          Array.isArray(fields) ||
          Object.keys(fields).some((key) => key !== "regenerate") ||
          ("regenerate" in fields && typeof fields.regenerate !== "boolean")
        )
          return apiResponse({ error: "Yêu cầu không hợp lệ." }, 400);
        regenerate = "regenerate" in fields && fields.regenerate === true;
      }
    }
    const analysis = await client
      .from("document_analyses")
      .select("current_run_id")
      .eq("document_id", id)
      .single();
    if (analysis.error)
      return apiResponse({ error: "Chưa có kết quả phân tích." }, 409);
    await prepareQuestions(client, id, analysis.data.current_run_id);
    // Missing/invalid config cannot create a processing job.
    try {
      claudeConfig();
    } catch {
      return apiResponse(
        { error: "Dịch vụ tạo đáp án chưa được cấu hình. Hãy thử lại sau." },
        503,
      );
    }
    const claimed = await client.rpc("claim_document_solver", {
      p_document_id: id,
      p_regenerate: regenerate,
    });
    if (claimed.error)
      return apiResponse({ error: "Chưa thể bắt đầu tạo đáp án." }, 503);
    const claim = claimed.data as {
      action: string;
      runId?: string;
      questionIds?: string[];
    };
    if (claim.action === "limit")
      return apiResponse(
        { error: "Hãy chờ lượt tạo đáp án hiện tại hoàn tất." },
        429,
      );
    if (claim.action === "not_found")
      return apiResponse({ error: "Không tìm thấy tài liệu." }, 404);
    if (claim.action === "not_ready")
      return apiResponse(
        { error: "Hãy chờ phân tích tài liệu hoàn tất." },
        409,
      );
    if (claim.action === "started" && claim.runId && claim.questionIds) {
      const runId = claim.runId;
      const ids = claim.questionIds;
      after(() => runDocumentSolver(client, id, runId, ids));
    }
    return apiResponse(
      { status: claim.action === "ready" ? "ready" : "processing" },
      claim.action === "ready" ? 200 : 202,
    );
  } catch (error) {
    return apiResponse(
      {
        error:
          error instanceof SyntaxError
            ? "Yêu cầu không hợp lệ."
            : "Chưa thể tạo đáp án. Kết quả đọc tài liệu vẫn được giữ.",
      },
      error instanceof SyntaxError ? 400 : 503,
    );
  }
}
