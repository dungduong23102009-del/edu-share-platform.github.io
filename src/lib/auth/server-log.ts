import "server-only";
import { safeAuthDiagnostic, type AuthOperation } from "./errors";

export function logAuthFailure(operation: AuthOperation, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.info("[auth]", JSON.stringify(safeAuthDiagnostic(operation, error)));
  }
}
