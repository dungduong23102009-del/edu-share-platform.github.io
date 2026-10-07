import { createClient } from "@/lib/supabase/server";
import { sameOrigin, apiResponse } from "@/lib/supabase/api";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return apiResponse({ error: "Yêu cầu không hợp lệ." }, 403);
  try {
    const { error } = await (
      await createClient()
    ).auth.signOut({ scope: "local" });
    return error
      ? apiResponse({ error: "Không thể đăng xuất. Hãy thử lại." }, 503)
      : apiResponse({ success: true });
  } catch {
    return apiResponse({ error: "Không thể đăng xuất. Hãy thử lại." }, 503);
  }
}
