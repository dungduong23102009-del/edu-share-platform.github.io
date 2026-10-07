import "server-only";
import { GoogleGenAI } from "@google/genai";
import { geminiConfig, GEMINI_TIMEOUT_MS } from "./config";
import {
  documentAnalysisJsonSchema,
  validateAnalysis,
  type DocumentAnalysis,
} from "./schemas";
import { DOCUMENT_ANALYSIS_INSTRUCTION } from "./prompts";
import { analysisError, AnalysisError } from "./errors";
import { extractDocx } from "./docx";
import type { AIProvider, AnalysisInput } from "./provider";

export class GeminiProvider implements AIProvider {
  readonly model: string;
  private readonly client: GoogleGenAI;
  constructor() {
    const config = geminiConfig();
    this.model = config.model;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }
  async analyzeDocument({
    bytes,
    format,
    signal,
    onStage,
  }: AnalysisInput): Promise<DocumentAnalysis> {
    let fileName: string | undefined;
    let uri: string | undefined;
    let text: string | undefined;
    const warnings: string[] = [];
    try {
      await onStage("reading");
      if (format === "DOCX") {
        const extracted = await extractDocx(bytes);
        text = extracted.text;
        warnings.push(...extracted.warnings);
      } else {
        try {
          let file = await this.client.files.upload({
            file: new Blob([Buffer.from(bytes)], { type: "application/pdf" }),
            config: {
              mimeType: "application/pdf",
              displayName: "study-document.pdf",
              abortSignal: signal,
              httpOptions: { timeout: 30000 },
            },
          });
          fileName = file.name;
          for (let poll = 0; file.state === "PROCESSING" && poll < 25; poll++) {
            signal.throwIfAborted();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            file = await this.client.files.get({
              name: fileName!,
              config: { abortSignal: signal, httpOptions: { timeout: 10000 } },
            });
          }
          if (file.state === "FAILED" || !file.uri)
            throw new AnalysisError("corrupt_document");
          if (file.state === "PROCESSING") throw new AnalysisError("timeout");
          uri = file.uri;
        } catch (error) {
          const value = error && typeof error === "object" ? error : {};
          const status =
            "status" in value
              ? value.status
              : "code" in value
                ? value.code
                : undefined;
          // Inline PDF is also native document understanding. It needs no external file URI.
          if (status !== 404) throw error;
          if (process.env.NODE_ENV === "development")
            console.info("[analysis] files_api_unavailable_using_inline_pdf");
        }
      }
      await onStage("extracting");
      for (let attempt = 0; attempt < 2; attempt++) {
        signal.throwIfAborted();
        try {
          const result = await this.client.interactions.create(
            {
              model: this.model,
              system_instruction: DOCUMENT_ANALYSIS_INSTRUCTION,
              store: false,
              input:
                format === "PDF"
                  ? [
                      {
                        type: "document",
                        ...(uri
                          ? { uri }
                          : { data: Buffer.from(bytes).toString("base64") }),
                        mime_type: "application/pdf",
                      },
                      {
                        type: "text",
                        text: "Trích xuất nội dung từ PDF nguồn theo schema; không giải hoặc tạo câu hỏi.",
                      },
                    ]
                  : [
                      {
                        type: "text",
                        text: `Đây là văn bản DOCX nguồn (không có số trang):\n${JSON.stringify({ sourceText: text })}`,
                      },
                    ],
              response_format: {
                type: "text",
                mime_type: "application/json",
                schema: documentAnalysisJsonSchema,
              },
              generation_config: { max_output_tokens: 16384, temperature: 0 },
            },
            { timeout: GEMINI_TIMEOUT_MS, maxRetries: 0, signal },
          );
          const analysis = validateAnalysis(
            JSON.parse(result.output_text || ""),
            format,
            text,
          );
          analysis.warnings = [
            ...new Set([...warnings, ...analysis.warnings]),
          ].slice(0, 100);
          return analysis;
        } catch (error) {
          const failure = analysisError(error);
          if (
            attempt === 1 ||
            !["invalid_output", "transient_error"].includes(failure.category)
          )
            throw failure;
          // One bounded retry only; quota and credential failures are never retried.
        }
      }
      throw new AnalysisError("invalid_output");
    } catch (error) {
      throw analysisError(error);
    } finally {
      if (fileName) {
        try {
          await this.client.files.delete({
            name: fileName,
            config: { httpOptions: { timeout: 10000 } },
          });
        } catch {
          if (process.env.NODE_ENV === "development")
            console.info("[analysis] temporary_file_cleanup_failed");
        }
      }
    }
  }
}
