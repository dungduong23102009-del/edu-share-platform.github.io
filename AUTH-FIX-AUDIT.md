# Auth fix — 2026-10-07

Chỉ sửa Auth; không triển khai feature mới, không đổi RLS, không tắt email
confirmation, không đổi phần mềm hay cấu hình hệ thống.

## Root cause được xác minh

- Supabase Auth logs ngày 2026-10-07: `/signup` lúc 10:05:09 và 10:07:17 UTC
  trả 429 `over_email_send_rate_limit` / `email rate limit exceeded`.
- `/token` lúc 10:04:47 và 10:07:07 UTC trả 400 `invalid_credentials`.
  Mã này không phân biệt email chưa có tài khoản với mật khẩu sai.
- Auth settings đọc trực tiếp trả HTTP 200: email=true, signup enabled=true,
  email confirmation=true, Google=false. Không có lỗi kết nối hay thiếu env.
- Database có hai tài khoản fixture đã xác nhận và hai profile tương ứng.
  Trigger `study_quiz_auth_profile` đang bật; profiles RLS=true. Không thấy
  bằng chứng profile trigger làm hỏng các request signup bị giới hạn email.
- Log Next.js ghi hydration mismatch với `__processed_*`, `bis_register` và
  `bis_skin_checked` do tiện ích trình duyệt chèn DOM. Những thuộc tính này
  không nằm trong JSX của app. Chrome sạch: 0 page errors, 0 hydration errors,
  0 thuộc tính chèn. Không thêm suppressHydrationWarning để che lỗi.

## Thay đổi code

- `/api/auth/email`: kiểm tra Origin, giới hạn request 4 KiB, validate email/
  password; gọi SDK signUp/signInWithPassword thật bằng client SSR.
- Cookie Supabase được ghi bởi server; trả success/confirmationRequired hoặc
  error/code. Không trả access token, refresh token hoặc password trong JSON.
- UI thông báo riêng lỗi quota email, email chưa xác nhận, invalid credentials,
  password yếu và provider không sẵn sàng; vẫn ngăn submit trùng khi pending.
- Logger development `[auth]` chỉ ghi operation/code/status/mô tả cố định.
  Không ghi raw error, email, password, API key hay session. Callback cũng ghi
  lỗi exchange/verify/session bằng logger này.
- `/api/auth/providers`: đọc settings Supabase thật, không cache; Google button
  chỉ bắt đầu signInWithOAuth nếu provider enabled. Khi tắt, server ghi rõ
  provider_disabled và UI hiển thị thông báo tiếng Việt.
- Redirect email/OAuth dùng request/environment/runtime origin, không default
  localhost:3000. Callback có exchangeCodeForSession/verifyOtp, đích cố định
  dashboard hoặc login, không dùng next tùy ý.
- `scripts/auth-status.mjs` báo configured/missing/invalid, không xuất key.

## Kiểm chứng và giới hạn

- Lint, typecheck, 6 unit tests và production build (23 page/route) đạt.
- 7 Playwright regression tests của app đã đạt; 4 Auth tests đã đạt sau khi sửa
  hai lỗi trong bài test: đọc response sau navigation và locator alert trùng
  với Next.js route announcer. Tổng 11 trường hợp đã kiểm chứng.
- Email login với user Supabase có thật, profile đúng, reload vẫn login,
  logout và redirect private route về login: đạt.
- Sai password thật: API trả 400 invalid_credentials và server ghi diagnostic.
- Origin sai 403; input sai hoặc body quá lớn 400; response login không có token.
- UI quota/unconfirmed-email/confirmation-success/network-failure dùng response
  mô phỏng trong test; đây không phải bằng chứng signup hoặc gửi email thật.
- Test A tạo tài khoản mới qua signup và Test B login chính tài khoản vừa tạo
  chưa hoàn thành vì quota email. Không dùng SQL provision để giả vờ signup đạt.
- Hai fixture tồn tại từ milestone trước, không phải tài khoản mới được đăng ký
  qua UI trong lần sửa này. Test upload cleanup file của chính test.
- Google provider đang tắt nên chưa test OAuth hoàn chỉnh, successful callback
  hoặc tạo profile qua Google. Callback lỗi/redirect an toàn đã được kiểm thử.
- Connector không có API đọc/ghi Auth config riêng tư: chưa xác minh được
  Client ID/Secret, SMTP, Site URL hoặc Redirect URLs lưu trong Dashboard.
  Không kết luận credentials thiếu chỉ từ provider=false.
- Chrome sạch: logs/auth-fix/browser-check.json và login-clean-chrome.png.

## Cấu hình Google OAuth cần chủ project thực hiện

Đây là một công việc cấu hình OAuth, không cần đưa secret vào chat hay Next.js:

1. Mở https://console.cloud.google.com/auth/clients; tạo OAuth client loại
   Web application, tên Study Quiz AI. Nếu ứng dụng đang Testing, dùng Google
   account nằm trong Test users ở Audience. Scopes: openid/email/profile.
2. Authorized JavaScript origins: `http://127.0.0.1:3001` và
   `http://localhost:3001`.
3. Authorized redirect URI:
   `https://eeqeapunixkekiygnbis.supabase.co/auth/v1/callback`.
4. Mở https://supabase.com/dashboard/project/eeqeapunixkekiygnbis/auth/providers:
   Google → bật provider, nhập Client ID và Client Secret vừa tạo, Save.
5. Mở https://supabase.com/dashboard/project/eeqeapunixkekiygnbis/auth/url-configuration:
   Site URL `http://127.0.0.1:3001`; thêm hai Redirect URLs
   `http://127.0.0.1:3001/auth/callback` và
   `http://localhost:3001/auth/callback`. Giữ các URL production đã có.

Hướng dẫn chính thức:
https://supabase.com/docs/guides/auth/social-login/auth-google
https://supabase.com/docs/guides/auth/redirect-urls

## Email signup còn bị giới hạn

Lỗi 429 cần chờ quota phục hồi hoặc cấu hình gửi email phù hợp. Chưa đọc được
SMTP config nên không xác nhận project đang dùng default hay custom SMTP.
Default SMTP theo tài liệu Supabase chỉ gửi tới email thành viên của project
team và có quota hạn chế; email người dùng bên ngoài cần custom SMTP.
Không tự tăng quota, không tắt confirmation và không tạo tài khoản ở email
không kiểm soát để thử vượt giới hạn.

Tài liệu: https://supabase.com/docs/guides/auth/auth-smtp
