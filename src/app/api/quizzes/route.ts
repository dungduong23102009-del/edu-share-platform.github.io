import { randomInt } from "node:crypto";
import { apiResponse, apiUser, sameOrigin } from "@/lib/supabase/api";
import { loadDocumentAnalysis } from "@/lib/documents/load-analysis";
import { validateQuizQuestion } from "@/lib/ai/question-validation";
import { boundedJson, createQuizSchema } from "@/lib/quizzes/request";
import { quizCommand } from "@/lib/quizzes/server";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return apiResponse({ error: "Yêu cầu không hợp lệ." }, 403);
  try {
    const { client, user } = await apiUser();
    if (!user) return apiResponse({ error: "Hãy đăng nhập lại." }, 401);
    const input = createQuizSchema.parse(await boundedJson(request));
    const view = await loadDocumentAnalysis(client, user.id, input.documentId);
    if (!view) return apiResponse({ error: "Không tìm thấy tài liệu." }, 404);
    if (view.document.status !== "ready")
      return apiResponse({ error: "Hãy chờ phân tích hoàn tất." }, 409);
    const eligible = view.solutions
      .filter((s) => {
        const q = view.sourceQuestions.find((x) => x.id === s.question_id);
        if (
          !q ||
          (input.topicIds.length &&
            (!q.topic_id || !input.topicIds.includes(q.topic_id)))
        )
          return false;
        return (
          s.quiz_ready &&
          validateQuizQuestion({
            questionText: s.question_text,
            choices: s.choices as string[],
            correctChoice: s.correct_choice,
            explanation: s.explanation,
            confidence:
              s.answer_origin === "source"
                ? q.extraction_confidence
                : s.ai_confidence,
            answerOrigin: s.answer_origin,
            originalType: s.original_type,
            parsingWarnings: s.parsing_warnings as string[],
            status: s.solver_status,
          }).quizReady
        );
      })
      .map((s) => s.question_id);
    if (input.random)
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }
    const chosen = eligible.slice(0, input.count === "all" ? 500 : input.count);
    if (!chosen.length)
      return apiResponse({ error: "Chưa có câu đủ điều kiện." }, 409);
    const result = await quizCommand<{ quizId: string; attemptId: string }>(
      client,
      "create",
      input.id,
      {
        documentId: input.documentId,
        questionIds: chosen,
        topicIds: input.topicIds,
      },
    );
    return apiResponse(result, 201);
  } catch (error) {
    return apiResponse(
      { error: "Chưa thể tạo bài. Hãy kiểm tra các câu hoặc thử lại." },
      error instanceof SyntaxError ||
        (error instanceof Error && error.name === "ZodError")
        ? 400
        : 503,
    );
  }
}
