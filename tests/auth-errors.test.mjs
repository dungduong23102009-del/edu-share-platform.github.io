import { test } from "node:test";
import assert from "node:assert/strict";
const { authErrorMessage, safeAuthDiagnostic } = await import(
  new URL("../src/lib/auth/errors.ts", import.meta.url).href
);

test("auth messages distinguish email quota, unconfirmed email and incorrect credentials", () => {
  assert.match(authErrorMessage("signup", "over_email_send_rate_limit", 429), /giới hạn/);
  assert.match(authErrorMessage("login", "email_not_confirmed", 400), /xác nhận email/);
  assert.match(authErrorMessage("login", "invalid_credentials", 400), /Email hoặc mật khẩu/);
  assert.match(authErrorMessage("signup", "unknown_error", 429), /chờ/);
});

test("auth diagnostics never reflect raw messages, credentials or session fields", () => {
  const secret = "Confidential-password-APIkey-accessToken-refreshToken@example.com";
  const diagnostic = safeAuthDiagnostic("signup", {
    code: "over_email_send_rate_limit", status: 429, message: secret,
    password: secret, access_token: secret, refresh_token: secret, secret,
  });
  assert.deepEqual(diagnostic, {
    operation: "signup", code: "over_email_send_rate_limit", status: 429,
    message: "email rate limit exceeded",
  });
  assert.ok(!JSON.stringify(diagnostic).includes(secret));
  assert.equal(safeAuthDiagnostic("signup", {
    code: "unexpected_failure", status: 500, message: `Database error saving new user ${secret}`,
  }).message, "Database error saving/updating user");
  assert.equal(safeAuthDiagnostic("login", { code: secret, status: 999 }).code, "unknown_error");
});
