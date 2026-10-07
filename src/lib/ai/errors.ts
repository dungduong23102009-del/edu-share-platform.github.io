export type AnalysisErrorCategory =
  | "missing_key"
  | "invalid_key"
  | "quota_exceeded"
  | "timeout"
  | "invalid_output"
  | "corrupt_document"
  | "empty_document"
  | "unsupported_content"
  | "download_failed"
  | "save_failed"
  | "permission_denied"
  | "transient_error";
export class AnalysisError extends Error {
  readonly category: AnalysisErrorCategory;
  constructor(category: AnalysisErrorCategory) {
    super(category);
    this.category = category;
  }
}
export function analysisError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  const value = error && typeof error === "object" ? error : {};
  const status =
    "status" in value ? value.status : "code" in value ? value.code : undefined;
  let message =
    "message" in value && typeof value.message === "string"
      ? value.message
      : "";
  // The interactions SDK may nest provider details below a generic HTTP error.
  // Inspect only for classification; never return or log this private payload.
  let nested: unknown = value;
  for (let depth = 0; depth < 4; depth++) {
    if (!nested || typeof nested !== "object" || !("error" in nested)) break;
    nested = nested.error;
    if (
      nested &&
      typeof nested === "object" &&
      "message" in nested &&
      typeof nested.message === "string"
    )
      message += ` ${nested.message}`;
  }
  if (/GEMINI_KEY_MISSING/.test(message))
    return new AnalysisError("missing_key");
  if (/API.?key.*(?:invalid|not valid)|API_KEY_INVALID/i.test(message))
    return new AnalysisError("invalid_key");
  if (status === 429) return new AnalysisError("quota_exceeded");
  if (status === 403) return new AnalysisError("permission_denied");
  if (/timeout|timed out|abort/i.test(message))
    return new AnalysisError("timeout");
  if (/EMPTY_ANALYSIS/.test(message))
    return new AnalysisError("empty_document");
  if (
    /INVALID_STRUCTURED_OUTPUT/.test(message) ||
    ("name" in value && value.name === "ZodError") ||
    error instanceof SyntaxError
  )
    return new AnalysisError("invalid_output");
  if (status === 400) return new AnalysisError("unsupported_content");
  return new AnalysisError("transient_error");
}
export function analysisErrorMessage(category: string | null) {
  const messages: Record<string, string> = {
    missing_key:
      "Dịch vụ phân tích chưa được cấu hình. Hãy liên hệ người quản lý ứng dụng.",
    invalid_key:
      "Dịch vụ phân tích chưa kết nối được. Hãy liên hệ người quản lý ứng dụng.",
    quota_exceeded:
      "Dịch vụ phân tích đã đạt giới hạn. Vui lòng chờ trước khi thử lại.",
    timeout:
      "Phân tích mất quá nhiều thời gian. Hãy thử lại hoặc chọn tài liệu ngắn hơn.",
    invalid_output:
      "Kết quả trích xuất chưa đủ tin cậy. Hãy thử lại hoặc chọn tài liệu rõ hơn.",
    corrupt_document:
      "File có thể bị hỏng. Hãy mở và xuất lại tài liệu trước khi thử lại.",
    empty_document:
      "Tài liệu chưa có nội dung đọc được. Hãy chọn file có văn bản rõ ràng.",
    unsupported_content:
      "Nội dung tài liệu chưa đọc được đầy đủ. Hãy thử xuất sang PDF rõ hơn.",
    download_failed:
      "Chưa thể đọc file đã tải lên. Hãy kiểm tra kết nối rồi thử lại.",
    save_failed:
      "Chưa thể lưu kết quả phân tích. Tài liệu gốc vẫn được giữ lại.",
  };
  return (
    (category && messages[category]) ||
    "Dịch vụ phân tích đang gián đoạn. Hãy thử lại sau."
  );
}
