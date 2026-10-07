import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";
import { applicationOrigin } from "@/lib/supabase/origin";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies, headers) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });
  let authenticated = false;
  let unavailable = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    authenticated = !!data.user && !error;
    unavailable = !!error && (error.status ?? 0) >= 500;
  } catch {
    unavailable = true;
  }
  const path = request.nextUrl.pathname;
  const publicRoute =
    ["/login", "/register"].includes(path) || path.startsWith("/auth/");
  response.headers.set("Cache-Control", "private, no-store");
  if (!authenticated && !publicRoute && !path.startsWith("/api/")) {
    const destination = new URL("/login", applicationOrigin(request));
    if (
      request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))
    )
      destination.searchParams.set("reason", "session");
    if (unavailable) destination.searchParams.set("reason", "unavailable");
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  return response;
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/create/:path*",
    "/documents/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/practice/:path*",
    "/processing/:path*",
    "/topics/:path*",
    "/setup/:path*",
    "/quiz/:path*",
    "/result/:path*",
    "/review/:path*",
    "/login",
    "/register",
    "/auth/:path*",
  ],
};
