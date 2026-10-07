import type { DocumentAnalysis } from "./schemas";
export interface AnalysisInput {
  bytes: Uint8Array;
  format: "PDF" | "DOCX";
  signal: AbortSignal;
  onStage: (stage: "reading" | "extracting") => Promise<void>;
}
export interface AIProvider {
  readonly model: string;
  analyzeDocument(input: AnalysisInput): Promise<DocumentAnalysis>;
}
