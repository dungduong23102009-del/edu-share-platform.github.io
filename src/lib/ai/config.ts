import "server-only";

export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
export const GEMINI_TIMEOUT_MS = 90000;

export const CLAUDE_DEFAULT_MODEL = "claude-sonnet-5";
export const CLAUDE_DEFAULT_BASE_URL = "https://gpt.teamsoclo.site/v1";
export const CLAUDE_TIMEOUT_MS = 60000;

export function claudeConfig() {
  const apiKey = process.env.THIRD_PARTY_CLAUDE_API_KEY?.trim();
  if (!apiKey) throw new Error("CLAUDE_KEY_MISSING");
  const url = new URL(
    process.env.THIRD_PARTY_CLAUDE_BASE_URL?.trim() || CLAUDE_DEFAULT_BASE_URL,
  );
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.replace(/\/$/, "").endsWith("/v1")
  )
    throw new Error("CLAUDE_BASE_URL_INVALID");
  return {
    apiKey,
    baseURL: url.href.replace(/\/$/, ""),
    model: process.env.THIRD_PARTY_CLAUDE_MODEL?.trim() || CLAUDE_DEFAULT_MODEL,
  };
}

export function geminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_KEY_MISSING");
  return { apiKey, model: GEMINI_MODEL };
}
