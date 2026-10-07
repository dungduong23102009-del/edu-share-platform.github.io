import { createHash } from "node:crypto";
import { apiUser, apiResponse, sameOrigin } from "@/lib/supabase/api";
import {
  DOCUMENT_BUCKET,
  DOCX_MIME,
  MAX_FILE_SIZE,
  PDF_MIME,
  UUID_PATTERN,
  sanitizeFilename,
  validateContent,
  validateMetadata,
} from "@/lib/documents/validation";

export const runtime = "nodejs";
const uploadError = "Không thể tải tài liệu lên. Hãy thử lại.";

async function boundedFormData(request: Request) {
  const maximum = MAX_FILE_SIZE + 128 * 1024;
  if (Number(request.headers.get("content-length")) > maximum || !request.body)
    return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return apiResponse({ error: "Yêu cầu không hợp lệ." }, 403);
  try {
    const { client, user } = await apiUser();
    if (!user)
      return apiResponse(
        { error: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại." },
        401,
      );
    const form = await boundedFormData(request);
    if (!form)
      return apiResponse(
        { error: "Tài liệu vượt quá 20 MB. Hãy chọn file nhỏ hơn." },
        413,
      );
    const file = form.get("file");
    const id = form.get("document_id");
    if (
      !(file instanceof File) ||
      typeof id !== "string" ||
      !UUID_PATTERN.test(id)
    )
      return apiResponse({ error: "Hãy chọn tài liệu PDF hoặc DOCX." }, 400);
    const metadataError = validateMetadata(file);
    if (metadataError) return apiResponse({ error: metadataError }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentError = validateContent(file.name, bytes);
    if (contentError) return apiResponse({ error: contentError }, 400);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const path = `${user.id}/${id}/${sanitizeFilename(file.name)}`;
    const mime = file.name.toLowerCase().endsWith(".pdf")
      ? PDF_MIME
      : DOCX_MIME;
    const existing = await client
      .from("documents")
      .select("id, file_sha256, storage_path, status, analysis_run_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing.error) return apiResponse({ error: uploadError }, 503);
    if (
      existing.data &&
      (existing.data.file_sha256 !== checksum ||
        existing.data.storage_path !== path)
    )
      return apiResponse(
        { error: "Tài liệu đã thay đổi. Hãy chọn lại file rồi tải lên." },
        409,
      );
    if (
      existing.data?.analysis_run_id ||
      existing.data?.status === "uploaded" ||
      existing.data?.status === "ready"
    )
      return apiResponse({ id });
    if (!existing.data) {
      const inserted = await client.from("documents").insert({
        id,
        user_id: user.id,
        original_filename: file.name,
        storage_path: path,
        mime_type: mime,
        file_size: file.size,
        file_sha256: checksum,
        status: "processing",
      });
      if (inserted.error)
        return apiResponse(
          { error: uploadError },
          inserted.error.code === "23505" ? 409 : 503,
        );
    }
    const storage = client.storage.from(DOCUMENT_BUCKET);
    const upload = await storage.upload(path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: "0",
    });
    if (upload.error) {
      // A retry after a lost response may find the exact same object already saved.
      const saved = await storage.exists(path);
      if (!saved.data || saved.error) {
        await client
          .from("documents")
          .update({ status: "failed" })
          .eq("id", id)
          .eq("user_id", user.id);
        return apiResponse({ error: uploadError }, 503);
      }
      const stored = await storage.download(path);
      if (
        stored.error ||
        !stored.data ||
        createHash("sha256")
          .update(new Uint8Array(await stored.data.arrayBuffer()))
          .digest("hex") !== checksum
      )
        return apiResponse({ error: uploadError }, 409);
    }
    const updated = await client
      .from("documents")
      .update({ status: "uploaded" })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (updated.error) return apiResponse({ error: uploadError }, 503);
    return apiResponse({ id }, 201);
  } catch {
    return apiResponse({ error: uploadError }, 503);
  }
}
