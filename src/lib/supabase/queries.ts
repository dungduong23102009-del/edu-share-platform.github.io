import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";
import type { Database } from "./database.types";

export type DocumentRecord = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentView = Pick<
  DocumentRecord,
  | "id"
  | "original_filename"
  | "mime_type"
  | "file_size"
  | "status"
  | "created_at"
>;
export interface ProfileView {
  displayName: string;
  initials: string;
  avatarUrl: string | null;
  email: string;
}

export const requireUser = cache(async () => {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { client, user: data.user };
});
export const loadProfile = cache(
  async (
    user: User,
    client: Awaited<ReturnType<typeof createClient>>,
  ): Promise<ProfileView> => {
    const { data } = await client
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    const displayName =
      data?.display_name || user.email?.split("@")[0] || "Người học";
    const initials = displayName
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
    let avatarUrl: string | null = null;
    try {
      const parsed = new URL(data?.avatar_url || "");
      if (
        parsed.protocol === "https:" &&
        (parsed.hostname === "googleusercontent.com" ||
          parsed.hostname.endsWith(".googleusercontent.com"))
      )
        avatarUrl = parsed.href;
    } catch {}
    return { displayName, initials, avatarUrl, email: user.email ?? "" };
  },
);
export async function loadDocuments() {
  const { client, user } = await requireUser();
  const recovery = await client
    .from("documents")
    .update({
      status: "failed",
      analysis_stage: "failed",
      analysis_error: "timeout",
    })
    .eq("user_id", user.id)
    .eq("status", "processing")
    .not("analysis_run_id", "is", null)
    .lte("analysis_expires_at", new Date().toISOString());
  const { data, error } = await client
    .from("documents")
    .select("id, original_filename, mime_type, file_size, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return {
    documents: data ?? [],
    error:
      error || recovery.error
        ? "Không thể đọc thư viện tài liệu. Hãy thử lại."
        : null,
  };
}
