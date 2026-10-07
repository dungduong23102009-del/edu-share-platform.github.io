import "server-only";
import mammoth from "mammoth";
import { unzipSync } from "fflate";
import { AnalysisError } from "./errors.ts";

export async function extractDocx(bytes: Uint8Array) {
  let total = 0;
  try {
    // Inspect ZIP metadata without decompressing parts, preventing oversized OOXML expansion.
    unzipSync(bytes, {
      filter(entry) {
        total += entry.originalSize;
        if (entry.originalSize > 16 * 1024 * 1024 || total > 64 * 1024 * 1024)
          throw new AnalysisError("unsupported_content");
        return false;
      },
    });
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = result.value.trim();
    if (text.replace(/\s/g, "").length < 20)
      throw new AnalysisError("empty_document");
    if (text.length > 250000) throw new AnalysisError("unsupported_content");
    return {
      text,
      warnings: [
        "Tài liệu Word có thể chứa hình ảnh hoặc công thức chưa được đọc đầy đủ. PDF sẽ cho kết quả tốt hơn.",
      ],
    };
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    throw new AnalysisError("corrupt_document");
  }
}
