import { apiResponse, apiUser } from "@/lib/supabase/api";
import { UUID_PATTERN } from "@/lib/documents/validation";
import { loadDocumentAnalysis } from "@/lib/documents/load-analysis";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return apiResponse({ error: "Không tìm thấy tài liệu." }, 404);
  try {
    const { client, user } = await apiUser();
    if (!user) return apiResponse({ error: "Hãy đăng nhập lại." }, 401);
    const view = await loadDocumentAnalysis(client, user.id, id);
    return view
      ? apiResponse(view)
      : apiResponse({ error: "Không tìm thấy tài liệu." }, 404);
  } catch {
    return apiResponse(
      { error: "Chưa thể đọc kết quả phân tích. Hãy thử lại." },
      503,
    );
  }
}
