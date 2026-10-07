# Supabase milestone audit — 2026-10-07

Project: eeqeapunixkekiygnbis, region ap-northeast-2. Project ban đầu INACTIVE,
đã restore qua connector; không reset hay xóa dữ liệu có sẵn. Schema public và
bucket ban đầu trống, auth.users chưa có tài khoản. Không deploy production.

## Những gì đã thực hiện

- SDK @supabase/ssr 0.12.7, @supabase/supabase-js 2.117.2, server-only 0.0.1.
- File validation dùng fflate 0.8.3. Mỗi dependency mới được pin phiên bản.
- .env.local có URL, modern publishable key và app origin; Git ignore đã kiểm
  chứng. .env.example chỉ có placeholders. Không lấy/dùng service-role key.
- Auth email/password, Google PKCE, confirmation callback, protected routes,
  cookie refresh, local logout. getUser xác minh trên server ở layout/page/API.
- Callback chỉ redirect /dashboard hoặc /login; giữ host cookie 127.0.0.1 /
  localhost cùng port local, không tin next hay x-forwarded-host tùy ý.
- Profile trigger private tự upsert từ auth.users; revoke execute với API roles,
  search_path rỗng. Metadata chỉ dùng cho hiển thị, không dùng authorization.
- Avatar Google HTTPS allowlist; thiếu/lỗi ảnh dùng initials, email từ Auth user.
- /create upload thật; /documents và tài liệu gần đây /dashboard đọc dữ liệu thật.
- File được kiểm tra size/MIME/signature/OOXML, path sanitize theo owner/UUID;
  SHA-256 và request document_id chống duplicate khi retry. Server bỏ qua user_id
  gửi từ client. Multipart body bị chặn ở 20 MiB + overhead, không đọc vô hạn.
- Bucket private study-documents giới hạn 20 MiB và hai MIME PDF/DOCX.
- Mở file bằng signed URL 60s, Cache-Control private/no-store cho API/Auth.
- Xóa yêu cầu confirmation và thực hiện Storage trước DB; mutation kiểm tra Origin.
- Quiz mock vẫn chạy riêng tại /practice; không tạo câu hỏi từ upload thật.

## Migrations đã áp dụng, đồng bộ với history remote

1. 20261007085632_integrate_auth_document_storage.sql
2. 20261007090330_harden_rls_event_trigger.sql
3. 20261007094252_restrict_profile_mutations.sql

Tạo profiles, documents, topics, quizzes, questions, quiz_attempts, quiz_answers;
7 bảng đều bật RLS. Foreign key tổng hợp chống liên kết khác owner/document.
Profile chỉ cấp SELECT/UPDATE cho authenticated owner; trigger tạo profile.
Hai cảnh báo RPC SECURITY DEFINER của function platform rls_auto_enable có sẵn
đã được khắc phục bằng revoke execute, không xóa function/event trigger.
Types được generate từ database qua connector, lưu tập trung database.types.ts.

## Kiểm chứng

- Lint không lỗi/cảnh báo; typecheck đạt; production build đạt, 21 route/page.
- 4 unit tests: giới hạn/MIME, PDF/DOCX hợp lệ và giả mạo, sanitize path,
  callback origin/host injection. PDF fixture có cấu trúc page/font/xref;
  DOCX fixture là OOXML ZIP chứa document, content types và relationships.
- Playwright: 4 regression tests quiz + 3 Auth/document/responsive tests.
- Test email/password login → dashboard → reload → logout → private route
  bị chặn → login lại. Profile/initials/email đúng fixture current user.
- PDF và DOCX upload qua UI vào Storage thật, metadata status uploaded có trong
  PostgreSQL; thư viện/dashboard hiển thị đúng, reload/logout/login không mất.
- Retry cùng UUID chỉ trả record cũ; user_id giả trong form bị bỏ qua.
- HTML đổi đuôi PDF bị reject trước insert. Xóa/hủy confirmation hoạt động;
  xác nhận DB record và đúng Storage object không còn sau xóa.
- Hai tài khoản: B không SELECT/UPDATE tài liệu hay SELECT profile A; INSERT
  ownership A bị 42501; không tải Storage file A hay gọi download API A.
- tests/rls-ownership.sql: PASS cả 7 bảng; chủ sở hữu đọc được dữ liệu của mình,
  không đọc/sửa/xóa dữ liệu khác; chặn topic/quiz/question/attempt/answer linkage
  chéo tài khoản. Mọi fixture trong bài SQL được ROLLBACK, không seed AI data.
- Screenshots/overflow audit 1440/1280/834/390px; login/register 1440/390px.
- npm audit --omit=dev: 0 vulnerabilities. Source/client bundle không có giá trị
  secret hay service-role credentials; từ service_role trong SDK vendor là
  chuỗi thông báo của thư viện, không phải credential ứng dụng.
- Các file upload của test được cleanup; chỉ hai tài khoản test riêng và profile
  tương ứng được giữ để có thể chạy lại E2E. Credentials random nằm trong
  logs/test-users.json ignored, không nằm trong source/env example.

## Chưa thể xác nhận milestone hoàn tất

Google provider hiện false; Email true, signup enabled, email confirmation true.
Connector có quyền migration/query/storage nhưng không có Auth provider config.
Google Client ID/Secret phải do owner nhập trực tiếp trong Supabase.

OAuth code và UI đã triển khai; provider-disabled/error/callback-denied đã test.
Chưa test chọn Google account, callback thành công, avatar/name thật, reload,
logout và Google login lại. Không giả lập những việc này để báo Google OK.

Signup với địa chỉ reserved example.com bị Supabase từ chối email_address_invalid.
Hai fixture E2E được provision trực tiếp vào Auth có confirmed identity để kiểm
thử login/RLS; chúng không chứng minh signup hay email delivery. Signup failure
UI được test qua mô phỏng network error. Cần thực hiện signup + confirmation
bằng hộp thư thật do người dùng kiểm soát trước khi đánh dấu Email Auth hoàn tất.

Chưa tạo commit milestone vì còn các bước xác minh Auth trên. Commit yêu cầu khi
hoàn tất: feat: integrate supabase auth google login and document storage.

## Advisor notices

Không có cảnh báo table RLS hay function exposure sau migrations. Advisor Auth
còn WARN Leaked Password Protection Disabled; connector không thể bật Auth
setting này. Đây là cấu hình project, không phải một policy rộng trong code.
Tham khảo [Password strength and leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Performance advisor chỉ báo INFO các index mới chưa dùng đủ vì schema vừa tạo;
không gỡ các index ownership/FK. Tham khảo [Unused index notice](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Dev tooling vẫn có 5 high đã có từ scaffold ESLint; không chạy npm audit fix
--force hạ Next ESLint xuống phiên bản không phù hợp. Không cài phần mềm hệ
thống, không dùng Administrator, không sửa ứng dụng ngoài project.
