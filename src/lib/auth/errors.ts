export type AuthOperation = "signup" | "login" | "google" | "callback";

const messages: Record<string, string> = {
  over_email_send_rate_limit: "Dịch vụ gửi email đã đạt giới hạn. Vui lòng chờ trước khi đăng ký lại.",
  over_request_rate_limit: "Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại.",
  email_not_confirmed: "Hãy xác nhận email trước khi đăng nhập.",
  invalid_credentials: "Email hoặc mật khẩu chưa đúng. Nếu chưa có tài khoản, hãy đăng ký trước.",
  email_address_invalid: "Địa chỉ email chưa hợp lệ. Hãy dùng email đang hoạt động.",
  email_address_not_authorized: "Chưa thể gửi email xác nhận đến địa chỉ này. Hãy thử lại sau khi dịch vụ email được cấu hình.",
  weak_password: "Mật khẩu chưa đáp ứng yêu cầu bảo mật. Hãy dùng mật khẩu mạnh hơn.",
  signup_disabled: "Ứng dụng chưa mở đăng ký tài khoản. Hãy thử lại sau.",
  email_provider_disabled: "Đăng nhập bằng email chưa sẵn sàng. Hãy thử lại sau.",
  provider_disabled: "Đăng nhập Google chưa sẵn sàng. Hãy thử lại sau.",
  captcha_failed: "Chưa thể xác minh yêu cầu. Hãy tải lại trang và thử lại.",
  network_error: "Không thể kết nối dịch vụ đăng nhập. Hãy thử lại.",
};

export function authErrorMessage(
  operation: AuthOperation,
  code: string,
  status?: number,
) {
  if (messages[code]) return messages[code];
  if (status === 429) return messages.over_request_rate_limit;
  if (operation === "signup")
    return "Không thể tạo tài khoản lúc này. Hãy thử lại sau.";
  if (operation === "google" || operation === "callback")
    return "Không thể đăng nhập với Google. Hãy thử lại.";
  return "Không thể đăng nhập lúc này. Hãy thử lại.";
}

const diagnosticMessages: Record<string, string> = {
  over_email_send_rate_limit: "email rate limit exceeded",
  over_request_rate_limit: "request rate limit exceeded",
  email_not_confirmed: "Email not confirmed",
  invalid_credentials: "Invalid login credentials",
  email_address_invalid: "Email address is invalid",
  email_address_not_authorized: "Email address not authorized",
  weak_password: "Password does not meet security requirements",
  signup_disabled: "Signups not allowed for this instance",
  email_provider_disabled: "Email provider is disabled",
  provider_disabled: "Google provider is disabled",
  captcha_failed: "CAPTCHA verification failed",
  network_error: "Auth service unavailable",
  callback_code_missing: "Callback code is missing",
  oauth_access_denied: "OAuth access denied",
};

export function safeAuthDiagnostic(operation: AuthOperation, error: unknown) {
  const value = error && typeof error === "object" ? error : {};
  const suppliedCode = "code" in value && typeof value.code === "string"
    ? value.code
    : "network_error";
  const code = /^[a-z_]{1,64}$/.test(suppliedCode) ? suppliedCode : "unknown_error";
  const status = "status" in value && typeof value.status === "number" &&
    value.status >= 100 && value.status <= 599 ? value.status : undefined;
  // Log fixed descriptions, never the raw error object or reflected credentials.
  const databaseFailure = "message" in value &&
    typeof value.message === "string" &&
    /^Database error (saving|updating) (new )?user/i.test(value.message);
  return {
    operation, code, status,
    message: databaseFailure
      ? "Database error saving/updating user"
      : diagnosticMessages[code] || "Auth request failed",
  };
}
