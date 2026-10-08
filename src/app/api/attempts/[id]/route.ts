import { apiResponse, apiUser, sameOrigin } from "@/lib/supabase/api";
import { UUID_PATTERN } from "@/lib/documents/validation";
import {
  boundedJson,
  progressSchema,
  retrySchema,
} from "@/lib/quizzes/request";
import { quizCommand } from "@/lib/quizzes/server";
type Context = { params: Promise<{ id: string }> };
async function handle(request: Request, context: Context, mutation: boolean) {
  if (mutation && !sameOrigin(request))
    return apiResponse({ error: "Yêu cầu không hợp lệ." }, 403);
  try {
    const { client, user } = await apiUser();
    if (!user) return apiResponse({ error: "Hãy đăng nhập lại." }, 401);
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id))
      return apiResponse({ error: "Không tìm thấy bài." }, 404);
    const action =
      new URL(request.url).searchParams.get("action") ||
      (mutation ? "progress" : "load");
    if (
      mutation
        ? !["progress", "submit", "retry"].includes(action)
        : !["load", "result"].includes(action)
    )
      return apiResponse({ error: "Yêu cầu không hợp lệ." }, 400);
    const payload = mutation
      ? (action === "retry" ? retrySchema : progressSchema).parse(
          await boundedJson(request),
        )
      : {};
    const result = await quizCommand<object>(client, action, id, payload);
    return apiResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return apiResponse(
      {
        error:
          message === "INVALID_STATE"
            ? "Bài chưa nộp hoặc không thể thay đổi."
            : "Chưa thể đọc hoặc lưu bài.",
      },
      message === "NOT_FOUND"
        ? 404
        : message === "INVALID_STATE"
          ? 409
          : error instanceof SyntaxError ||
              (error instanceof Error && error.name === "ZodError")
            ? 400
            : 503,
    );
  }
}
export const GET = (request: Request, context: Context) =>
  handle(request, context, false);
export const POST = (request: Request, context: Context) =>
  handle(request, context, true);
