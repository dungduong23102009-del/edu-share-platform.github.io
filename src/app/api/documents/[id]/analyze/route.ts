import { after } from "next/server";
import { apiResponse, apiUser, sameOrigin } from "@/lib/supabase/api";
import { UUID_PATTERN } from "@/lib/documents/validation";
import { runDocumentAnalysis } from "@/lib/documents/analysis";

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
    const result = await client
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (result.error)
      return apiResponse({ error: "Chưa thể đọc tài liệu. Hãy thử lại." }, 503);
    if (!result.data)
      return apiResponse({ error: "Không tìm thấy tài liệu." }, 404);
    // The small request has one boolean option; never read an unbounded body.
    let reprocess = false;
    if (request.body) {
      const reader = request.body.getReader();
      let text = "";
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024) {
          await reader.cancel();
          return apiResponse({ error: "Yêu cầu không hợp lệ." }, 400);
        }
        text += new TextDecoder().decode(value);
      }
      if (text) {
        const fields: unknown = JSON.parse(text);
        if (
          !fields ||
          typeof fields !== "object" ||
          Array.isArray(fields) ||
          ("reprocess" in fields && typeof fields.reprocess !== "boolean")
        )
          return apiResponse({ error: "Yêu cầu không hợp lệ." }, 400);
        reprocess = "reprocess" in fields && fields.reprocess === true;
      }
    }
    const claimed = await client.rpc("claim_document_analysis", {
      p_document_id: id,
      p_reprocess: reprocess,
    });
    if (claimed.error)
      return apiResponse(
        { error: "Chưa thể bắt đầu phân tích. Hãy thử lại." },
        503,
      );
    const claim = claimed.data as { action: string; runId?: string };
    if (claim.action === "not_found")
      return apiResponse({ error: "Không tìm thấy tài liệu." }, 404);
    if (claim.action === "limit")
      return apiResponse(
        {
          error:
            "Bạn đang phân tích nhiều tài liệu. Hãy chờ tài liệu hiện tại hoàn tất.",
        },
        429,
      );
    if (claim.action === "started" && claim.runId) {
      const document = result.data;
      const runId = claim.runId;
      after(() => runDocumentAnalysis(client, document, runId));
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
            : "Chưa thể bắt đầu phân tích. Hãy thử lại.",
      },
      error instanceof SyntaxError ? 400 : 503,
    );
  }
}
