import { unzipSync } from "fflate";

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const PDF_MIME = "application/pdf";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const DOCUMENT_BUCKET = "study-documents";
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateMetadata(
  file: Pick<File, "name" | "size" | "type">,
): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["pdf", "docx"].includes(extension))
    return "Định dạng chưa được hỗ trợ. Hãy chọn tài liệu PDF hoặc DOCX.";
  if (!file.size) return "Tài liệu đang trống. Hãy chọn một file có nội dung.";
  if (file.size > MAX_FILE_SIZE)
    return "Tài liệu vượt quá 20 MB. Hãy chọn file nhỏ hơn.";
  if (file.name.length > 255)
    return "Tên tài liệu quá dài. Hãy rút ngắn tên file.";
  const expected = extension === "pdf" ? PDF_MIME : DOCX_MIME;
  if (
    file.type &&
    file.type !== expected &&
    file.type !== "application/octet-stream"
  )
    return "Loại file không khớp với phần mở rộng PDF hoặc DOCX.";
  return null;
}
export function validateContent(
  name: string,
  bytes: Uint8Array,
): string | null {
  if (name.toLowerCase().endsWith(".pdf")) {
    const start = new TextDecoder().decode(bytes.subarray(0, 1024));
    const end = new TextDecoder().decode(
      bytes.subarray(Math.max(0, bytes.length - 2048)),
    );
    return /^%PDF-\d\.\d/.test(start) && end.includes("%%EOF")
      ? null
      : "File không có cấu trúc PDF hợp lệ.";
  }
  if (
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 3 ||
    bytes[3] !== 4
  )
    return "File không có cấu trúc DOCX hợp lệ.";
  try {
    let documentFound = false;
    const parts = unzipSync(bytes, {
      filter(entry) {
        if (entry.name === "word/document.xml" && entry.originalSize > 0)
          documentFound = true;
        return (
          entry.name === "[Content_Types].xml" && entry.originalSize <= 65536
        );
      },
    });
    const contentTypes = new TextDecoder().decode(
      parts["[Content_Types].xml"] ?? new Uint8Array(),
    );
    return documentFound &&
      contentTypes.includes("/word/document.xml") &&
      contentTypes.includes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
      )
      ? null
      : "File không phải tài liệu Word DOCX hợp lệ.";
  } catch {
    return "Không thể đọc định dạng DOCX. Hãy chọn file khác.";
  }
}
export function sanitizeFilename(name: string) {
  const extension = name.toLowerCase().endsWith(".pdf") ? "pdf" : "docx";
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 100);
  return `${base || "tai-lieu"}.${extension}`;
}
export function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
export const statusLabels: Record<DocumentRecordStatus, string> = {
  uploaded: "Đã tải lên",
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  failed: "Xử lý thất bại",
};
type DocumentRecordStatus = "uploaded" | "processing" | "ready" | "failed";
export function documentStatus(status: string) {
  return statusLabels[status as DocumentRecordStatus] ?? "Chưa xác định";
}
