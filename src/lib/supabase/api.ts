import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "./server";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const supplied = new URL(origin);
    const target = new URL(request.url);
    // Next may normalize request.url to localhost even when Host is 127.0.0.1.
    const host = request.headers.get("host") || target.host;
    if (supplied.host === host && supplied.protocol === target.protocol)
      return true;
    const configured = process.env.NEXT_PUBLIC_APP_URL;
    return !!configured && supplied.origin === new URL(configured).origin;
  } catch {
    return false;
  }
}
export function apiResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function apiUser() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  return { client, user: error ? null : data.user };
}
