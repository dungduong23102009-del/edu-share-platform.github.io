import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applicationOrigin } from "@/lib/supabase/origin";
import { logAuthFailure } from "@/lib/auth/server-log";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let success = false;
  try {
    const client = await createClient();
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");
    if (url.searchParams.get("error") === "access_denied") logAuthFailure("callback", { code: "oauth_access_denied", status: 400 });
    const result = code
      ? await client.auth.exchangeCodeForSession(code)
      : tokenHash && (type === "email" || type === "signup")
        ? await client.auth.verifyOtp({ token_hash: tokenHash, type })
        : null;
    if (result?.error) logAuthFailure("callback", result.error);
    if (!result && !url.searchParams.has("error")) logAuthFailure("callback", { code: "callback_code_missing", status: 400 });
    if (result && !result.error && result.data.session) {
      // Persist Supabase credentials only; discard unneeded Google provider tokens.
      const { access_token, refresh_token } = result.data.session;
      const cleanSession = await client.auth.setSession({
        access_token,
        refresh_token,
      });
      success = !cleanSession.error;
      if (cleanSession.error) logAuthFailure("callback", cleanSession.error);
    }
  } catch {
    logAuthFailure("callback", { code: "network_error", status: 503 });
  }
  // A fixed destination prevents open redirects via next/redirectTo parameters.
  const response = NextResponse.redirect(
    new URL(
      success ? "/dashboard" : "/login?reason=oauth",
      applicationOrigin(request),
    ),
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
