import "server-only";
import { GeminiProvider } from "./gemini-provider";
import { ClaudeProvider } from "./claude-provider";
import type { AIProvider } from "./provider";
import type { SolverProvider } from "./solver-schemas";

export function getDocumentProvider(): AIProvider {
  if ((process.env.AI_DOCUMENT_PROVIDER?.trim() || "gemini") !== "gemini")
    throw new Error("DOCUMENT_PROVIDER_UNSUPPORTED");
  return new GeminiProvider();
}
export function getSolverProvider(): SolverProvider {
  if ((process.env.AI_SOLVER_PROVIDER?.trim() || "claude") !== "claude")
    throw new Error("SOLVER_PROVIDER_UNSUPPORTED");
  return new ClaudeProvider();
}
