import { supabaseConfig } from "@/lib/supabase/config";
import { apiResponse } from "@/lib/supabase/api";
import { logAuthFailure } from "@/lib/auth/server-log";

export async function GET() {
  try {
    const { url, key } = supabaseConfig();
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("auth_settings");
    const settings: { external?: { google?: boolean } } = await response.json();
    const google = settings.external?.google === true;
    if (!google) logAuthFailure("google", { code: "provider_disabled", status: 400 });
    return apiResponse({ google });
  } catch {
    logAuthFailure("google", { code: "network_error", status: 503 });
    return apiResponse({ error: "Không thể kết nối đăng nhập Google. Hãy thử lại." }, 503);
  }
}
