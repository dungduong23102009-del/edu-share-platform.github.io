import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { QuizResult, QuizView, QuizHistory } from "./types";
export async function quizCommand<T>(
  client: SupabaseClient<Database>,
  action: string,
  id: string,
  payload: Json = {},
): Promise<T> {
  const { data, error } = await client
    .rpc("quiz_command", { p_action: action, p_id: id, p_payload: payload })
    .abortSignal(new AbortController().signal);
  if (error)
    throw new Error(
      error.code === "P0002"
        ? "NOT_FOUND"
        : error.code === "22023"
          ? "INVALID_STATE"
          : "QUIZ_UNAVAILABLE",
    );
  return data as T;
}
export const loadQuiz = (client: SupabaseClient<Database>, id: string) =>
  quizCommand<QuizView>(client, "load", id);
export const loadResult = (client: SupabaseClient<Database>, id: string) =>
  quizCommand<QuizResult>(client, "result", id);
export const loadHistory = (client: SupabaseClient<Database>) =>
  quizCommand<QuizHistory[]>(
    client,
    "history",
    "00000000-0000-0000-0000-000000000000",
  );
