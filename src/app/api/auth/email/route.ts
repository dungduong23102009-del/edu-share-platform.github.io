import { createClient } from "@/lib/supabase/server";
import { apiResponse, sameOrigin } from "@/lib/supabase/api";
import { applicationOrigin } from "@/lib/supabase/origin";
import { authErrorMessage, safeAuthDiagnostic } from "@/lib/auth/errors";
import { logAuthFailure } from "@/lib/auth/server-log";

const MAX_AUTH_BODY = 4096;
async function readCredentials(request: Request): Promise<unknown> {
  if (!request.body || Number(request.headers.get("content-length")) > MAX_AUTH_BODY) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_AUTH_BODY) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return apiResponse({ error: "Yêu cầu không hợp lệ." }, 403);
  let operation: "signup" | "login" = "login";
  try {
    const fields = await readCredentials(request);
    if (!fields || typeof fields !== "object" || !("mode" in fields) || !("email" in fields) || !("password" in fields) || typeof fields.email !== "string" || typeof fields.password !== "string" || !["signup", "login"].includes(String(fields.mode))) return apiResponse({ error: "Hãy điền email và mật khẩu hợp lệ." }, 400);
    operation = fields.mode === "signup" ? "signup" : "login";
    const email = fields.email.trim();
    const password = fields.password;
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length > 128 || password.length < (operation === "signup" ? 8 : 1)) return apiResponse({ error: "Hãy điền email và mật khẩu hợp lệ. Mật khẩu đăng ký cần ít nhất 8 ký tự." }, 400);
    const client = await createClient();
    const result = operation === "signup"
      ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${applicationOrigin(request)}/auth/callback` } })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) {
      const diagnostic = safeAuthDiagnostic(operation, result.error);
      logAuthFailure(operation, result.error);
      return apiResponse({ error: authErrorMessage(operation, diagnostic.code, diagnostic.status), code: diagnostic.code }, diagnostic.status && diagnostic.status >= 400 ? diagnostic.status : 503);
    }
    // Supabase writes SSR cookies. Passwords and sessions never enter the JSON response.
    return apiResponse({ success: true, confirmationRequired: !result.data.session });
  } catch {
    logAuthFailure(operation, { code: "network_error", status: 503 });
    return apiResponse({ error: authErrorMessage(operation, "network_error"), code: "network_error" }, 503);
  }
}
