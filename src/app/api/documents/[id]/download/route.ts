import { NextResponse } from "next/server";
import { apiResponse, apiUser } from "@/lib/supabase/api";
import { DOCUMENT_BUCKET, UUID_PATTERN } from "@/lib/documents/validation";

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
    const { data, error } = await client
      .from("documents")
      .select("storage_path, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error)
      return apiResponse({ error: "Không thể mở tài liệu. Hãy thử lại." }, 503);
    if (!data || !["uploaded", "ready"].includes(data.status))
      return apiResponse({ error: "Không tìm thấy tài liệu." }, 404);
    const signed = await client.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(data.storage_path, 60);
    if (signed.error)
      return apiResponse({ error: "Không thể mở tài liệu. Hãy thử lại." }, 503);
    return NextResponse.redirect(signed.data.signedUrl, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return apiResponse({ error: "Không thể mở tài liệu. Hãy thử lại." }, 503);
  }
}
