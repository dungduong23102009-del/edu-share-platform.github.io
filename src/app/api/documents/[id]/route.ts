import { apiResponse, apiUser, sameOrigin } from "@/lib/supabase/api";
import { DOCUMENT_BUCKET, UUID_PATTERN } from "@/lib/documents/validation";

export async function DELETE(
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
    const { data, error } = await client
      .from("documents")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error)
      return apiResponse(
        { error: "Không thể xóa tài liệu. Hãy thử lại." },
        503,
      );
    if (!data) return apiResponse({ success: true });
    const removed = await client.storage
      .from(DOCUMENT_BUCKET)
      .remove([data.storage_path]);
    if (removed.error)
      return apiResponse(
        { error: "Không thể xóa file. Tài liệu vẫn được giữ lại." },
        503,
      );
    const deleted = await client
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    return deleted.error
      ? apiResponse({ error: "Không thể xóa tài liệu. Hãy thử lại." }, 503)
      : apiResponse({ success: true });
  } catch {
    return apiResponse({ error: "Không thể xóa tài liệu. Hãy thử lại." }, 503);
  }
}
