import { z } from "zod";

const page = z.number().int().positive().max(1000).nullable();
const excerpt = z.string().trim().min(1).max(600).nullable();
const topicTitle = z.string().trim().min(1).max(200).nullable();
export const documentAnalysisSchema = z.strictObject({
  documentTitle: z.string().trim().min(1).max(300).nullable(),
  documentType: z.enum(["question_answer", "theory", "mixed"]),
  language: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(1).max(2000),
  topics: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(200),
        summary: z.string().trim().max(1000).nullable(),
        sourcePages: z.array(z.number().int().positive().max(1000)).max(1000),
      }),
    )
    .max(50),
  sourceQuestions: z
    .array(
      z.strictObject({
        questionText: z.string().trim().min(1).max(8000),
        choices: z.array(z.string().trim().min(1).max(2000)).max(6),
        explicitAnswer: z.string().trim().min(1).max(2000).nullable(),
        answerOrigin: z.enum(["source", "not_provided"]),
        answerSourceExcerpt: excerpt,
        topicTitle,
        sourcePage: page,
        sourceExcerpt: excerpt,
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(500),
  theoryPoints: z
    .array(
      z.strictObject({
        content: z.string().trim().min(1).max(3000),
        topicTitle,
        sourcePage: page,
        sourceExcerpt: excerpt,
      }),
    )
    .max(500),
  warnings: z.array(z.string().trim().min(1).max(500)).max(100),
});
export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;
// Gemini accepts a JSON Schema subset. Keep stricter length/semantic validation in Zod.
function geminiSchema(node: Record<string, unknown>): Record<string, unknown> {
  const union = node.anyOf as Record<string, unknown>[] | undefined;
  if (union?.length === 2 && union.some((part) => part.type === "null")) {
    const other = union.find((part) => part.type !== "null")!;
    return { ...geminiSchema(other), type: [other.type, "null"] };
  }
  const result: Record<string, unknown> = {};
  for (const key of [
    "type",
    "enum",
    "required",
    "additionalProperties",
    "description",
  ]) {
    if (node[key] !== undefined) result[key] = node[key];
  }
  if (node.properties)
    result.properties = Object.fromEntries(
      Object.entries(
        node.properties as Record<string, Record<string, unknown>>,
      ).map(([key, value]) => [key, geminiSchema(value)]),
    );
  if (node.items)
    result.items = geminiSchema(node.items as Record<string, unknown>);
  return result;
}
export const documentAnalysisJsonSchema = geminiSchema(
  z.toJSONSchema(documentAnalysisSchema),
);
const normalized = (text: string) =>
  text.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");

export function validateAnalysis(
  value: unknown,
  format: "PDF" | "DOCX",
  sourceText?: string,
): DocumentAnalysis {
  const analysis = documentAnalysisSchema.parse(value);
  const warning = (text: string) => {
    if (!analysis.warnings.includes(text)) analysis.warnings.push(text);
  };
  const titles = new Map<string, string>();
  analysis.topics = analysis.topics.filter((topic) => {
    const key = normalized(topic.title);
    if (titles.has(key)) {
      warning("Một số chủ đề trùng tên đã được gộp.");
      return false;
    }
    titles.set(key, topic.title);
    return true;
  });
  if (
    !analysis.topics.length ||
    (!analysis.sourceQuestions.length && !analysis.theoryPoints.length)
  )
    throw new Error("EMPTY_ANALYSIS");
  for (const [index, question] of analysis.sourceQuestions.entries()) {
    if (question.choices.length === 1)
      throw new Error("INVALID_STRUCTURED_OUTPUT");
    if (
      question.answerOrigin === "not_provided" &&
      (question.explicitAnswer !== null ||
        question.answerSourceExcerpt !== null)
    )
      throw new Error("INVALID_STRUCTURED_OUTPUT");
    if (
      question.answerOrigin === "source" &&
      (!question.explicitAnswer || !question.answerSourceExcerpt)
    )
      throw new Error("INVALID_STRUCTURED_OUTPUT");
    if (
      format === "DOCX" &&
      question.answerOrigin === "source" &&
      sourceText &&
      !normalized(sourceText).includes(
        normalized(question.answerSourceExcerpt!),
      )
    )
      throw new Error("INVALID_STRUCTURED_OUTPUT");
    if (
      new Set(question.choices.map(normalized)).size !== question.choices.length
    )
      warning(
        `Câu ${index + 1} có lựa chọn trùng nhau; nội dung nguồn được giữ nguyên.`,
      );
    if (question.confidence < 0.6)
      warning(
        `Câu ${index + 1} có độ tin cậy trích xuất thấp, cần kiểm tra nguồn.`,
      );
    if (question.choices.length && question.explicitAnswer) {
      const answer = normalized(question.explicitAnswer);
      const label = /^[a-f]$/.test(answer) ? answer.charCodeAt(0) - 97 : -1;
      if (
        !question.choices.some((choice) => normalized(choice) === answer) &&
        !(label >= 0 && label < question.choices.length)
      )
        warning(
          `Đáp án nguồn của câu ${index + 1} chưa khớp lựa chọn; đáp án được giữ nguyên để kiểm tra.`,
        );
    }
  }
  for (const item of [...analysis.sourceQuestions, ...analysis.theoryPoints]) {
    if (item.topicTitle) {
      const match = titles.get(normalized(item.topicTitle));
      if (!match)
        warning(
          "Một số nội dung chưa được liên kết với chủ đề; cần kiểm tra nguồn.",
        );
      item.topicTitle = match || null;
    }
    if (format === "DOCX") {
      if (item.sourcePage !== null)
        warning("Số trang Word chưa xác minh đã được bỏ qua.");
      item.sourcePage = null;
    }
  }
  if (format === "DOCX")
    for (const topic of analysis.topics) topic.sourcePages = [];
  // Warnings added by semantic checks must also satisfy the persistence contract.
  analysis.warnings = [...new Set(analysis.warnings)].slice(0, 100);
  return documentAnalysisSchema.parse(analysis);
}
