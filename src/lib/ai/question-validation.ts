import { SOLVER_SETTINGS } from "./solver-settings.ts";

export const ORIGINAL_TYPES = [
  "multiple_choice",
  "true_false",
  "short_answer",
  "calculation",
  "theory",
  "unknown",
] as const;
export type OriginalType = (typeof ORIGINAL_TYPES)[number];
const comparable = (value: string) =>
  value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
export const CHOICE_KEYS = ["A", "B", "C", "D"] as const;
export type ChoiceKey = (typeof CHOICE_KEYS)[number];

export function normalizeQuestion(input: {
  questionText: string;
  choices: string[];
  sourceExcerpt?: string | null;
  originalType?: string | null;
}) {
  const rawQuestionText = input.questionText;
  const rawChoices = [...input.choices];
  const choices = rawChoices.map((choice, index) =>
    choice
      .replace(
        new RegExp(`^\\s*${String.fromCharCode(65 + index)}[.)：:]\\s+`),
        "",
      )
      .trim(),
  );
  let questionText = rawQuestionText.trim();
  const warnings: string[] = [];
  const markers = [...questionText.matchAll(/(?:^|\s)([A-F])[.)：:]\s+/g)];
  // Remove only a complete trailing choice block which matches every source choice.
  // A variable such as A or Q, or an unmatched fragment, is never guessed away.
  if (choices.length >= 2 && markers.length >= choices.length) {
    const tail = markers.slice(-choices.length);
    const exact = tail.every((marker, index) => {
      const end = tail[index + 1]?.index ?? questionText.length;
      const text = questionText.slice(marker.index! + marker[0].length, end);
      return (
        marker[1] === String.fromCharCode(65 + index) &&
        comparable(text) === comparable(choices[index])
      );
    });
    if (exact) questionText = questionText.slice(0, tail[0].index).trim();
  }
  if (
    /(?:^|\s)A[.)：:]\s+[\s\S]*(?:^|\s)B[.)：:]\s+[\s\S]*(?:^|\s)C[.)：:]\s+/m.test(
      questionText,
    )
  )
    warnings.push(
      "Lựa chọn còn lẫn trong câu hỏi; cần đối chiếu tài liệu gốc.",
    );
  const sourceSymbols =
    input.sourceExcerpt?.match(/ΔU|≥|≤|→|⇌|±|°C|10⁻³|m\/s²|√|∫|[=<>]/g) || [];
  const parsedText = [questionText, ...choices].join(" ");
  if (sourceSymbols.some((symbol) => !parsedText.includes(symbol)))
    warnings.push(
      "Ký hiệu trong câu hỏi khác trích dẫn nguồn; cần kiểm tra, không tự sửa.",
    );
  let originalType: OriginalType =
    ORIGINAL_TYPES.includes(input.originalType as OriginalType) &&
    input.originalType !== "unknown"
      ? (input.originalType as OriginalType)
      : "unknown";
  if (originalType === "unknown") {
    if (
      choices.length === 2 &&
      choices.every((choice) => /^(đúng|sai|true|false)$/i.test(choice))
    )
      originalType = "true_false";
    else if (choices.length >= 2) originalType = "multiple_choice";
    else if (
      /\b(calculate|compute)\b|tính|bao nhiêu|giải phương trình/i.test(
        questionText,
      )
    )
      originalType = "calculation";
    else if (/\?|nêu|trình bày|định nghĩa|define|explain/i.test(questionText))
      originalType = "short_answer";
  }
  return {
    questionText,
    choices,
    rawQuestionText,
    rawChoices,
    originalType,
    parsingWarnings: warnings,
  };
}
export function sourceCorrectChoice(
  answer: string | null,
  choices: string[],
): ChoiceKey | null {
  if (!answer || choices.length !== 4) return null;
  const trimmed = answer.trim();
  if (/^[A-D]$/i.test(trimmed)) return trimmed.toUpperCase() as ChoiceKey;
  const matches = choices.flatMap((choice, index) =>
    comparable(choice) === comparable(answer) ? [index] : [],
  );
  return matches.length === 1 ? CHOICE_KEYS[matches[0]] : null;
}
export function validateQuizQuestion(input: {
  questionText: string;
  choices: string[];
  correctChoice: string | null;
  explanation?: string | null;
  confidence: number | null;
  answerOrigin: string | null;
  originalType: string;
  parsingWarnings?: string[];
  status?: string;
}) {
  const errors: string[] = [];
  if (!input.questionText.trim()) errors.push("Câu hỏi rỗng.");
  if (
    input.choices.length !== 4 ||
    input.choices.some((choice) => !choice.trim())
  )
    errors.push("Cần đủ bốn lựa chọn.");
  if (new Set(input.choices.map(comparable)).size !== input.choices.length)
    errors.push("Lựa chọn trùng nhau.");
  if (!CHOICE_KEYS.includes(input.correctChoice as ChoiceKey))
    errors.push("Chưa có đáp án hợp lệ.");
  if (
    !["multiple_choice", "calculation", "short_answer"].includes(
      input.originalType,
    )
  )
    errors.push("Dạng câu hỏi chưa được hỗ trợ.");
  if (
    input.parsingWarnings?.length ||
    /(?:^|\s)A[.)：:]\s+[\s\S]*(?:^|\s)B[.)：:]\s+[\s\S]*(?:^|\s)C[.)：:]\s+/m.test(
      input.questionText,
    )
  )
    errors.push("Cần kiểm tra parsing hoặc ký hiệu.");
  if (
    input.confidence === null ||
    !Number.isFinite(input.confidence) ||
    input.confidence < SOLVER_SETTINGS.minimumConfidence ||
    input.confidence > 1
  )
    errors.push("Độ tin cậy chưa đủ.");
  if (
    input.answerOrigin === "ai_derived" &&
    (!input.explanation?.trim() || input.status !== "solved")
  )
    errors.push("Cần đáp án AI đã giải và lời giải ngắn.");
  if (!["source", "document", "ai_derived"].includes(input.answerOrigin || ""))
    errors.push("Chưa xác định nguồn đáp án.");
  return {
    quizReady: !errors.length,
    needsReview:
      !!errors.length ||
      (input.confidence !== null &&
        input.confidence < SOLVER_SETTINGS.cautionConfidence),
    errors,
  };
}
