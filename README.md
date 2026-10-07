# Study Quiz AI — Gemini extraction và Claude solver

Next.js App Router, TypeScript strict, Tailwind CSS và ESLint. Auth và tài liệu đã
chuyển sang Supabase thật. Gemini phân tích PDF/DOCX thành chủ đề, câu hỏi và
đáp án nguồn, ý kiến thức. Claude giải các câu chưa có đáp án và chuyển bài tính
hoặc câu trả lời ngắn phù hợp thành bốn lựa chọn. Có thể luyện tập từ câu đã
kiểm tra hợp lệ; phần quiz mẫu vẫn ở /practice.

## Chạy local

.env.local đã cấu hình cho project eeqeapunixkekiygnbis, không được Git track.
Nếu tạo checkout khác, dùng .env.example và điền URL cùng publishable key của
Supabase và GEMINI_API_KEY server-side. Không gửi API key trong chat hay dùng
NEXT_PUBLIC_ cho Gemini. GEMINI_MODEL là override tùy chọn; giá trị mặc định chỉ
được định nghĩa trong src/lib/ai/config.ts. Đặt NEXT_PUBLIC_APP_URL theo origin của ứng dụng; khi có production
domain, cập nhật env và Redirect URLs trong Supabase, không sửa OAuth code.

```powershell
npm.cmd ci
npm.cmd run dev -- --hostname 127.0.0.1 --port 3001
```

Mở http://127.0.0.1:3001/login. Cổng 3000 thuộc ứng dụng khác.
Server chạy nền có log/PID trong logs/dev.log, logs/dev-error.log, logs/dev.pid.

## Auth và tài liệu thật

- /login và /register: email/password, Google qua Supabase PKCE.
- Email đi qua /api/auth/email: server gọi signUp/signInWithPassword thật,
  ghi code/status và mô tả lỗi an toàn trong development. JSON response không
  chứa session/token; cookie SSR giữ phiên sau điều hướng. UI phân biệt giới hạn
  email, email chưa xác nhận và thông tin đăng nhập sai.
- /api/auth/providers đọc settings công khai của Supabase trước Google OAuth;
  không thay thế provider bằng mock khi cấu hình thiếu.
- /auth/callback: trao đổi code hoặc xác nhận email token_hash; chỉ chuyển tới
  /dashboard, bỏ qua tham số next. Không lưu Google provider tokens.
- /dashboard và mọi route học tập yêu cầu user được server xác minh bằng getUser.
  Proxy cập nhật cookie; layout/page và từng API tự kiểm tra user, RLS kiểm tra
  ownership thêm lần nữa. Session không được dùng làm nguồn tin cậy cho user ID.
- Profile được tạo/upsert từ auth.users trigger; UI đọc PostgreSQL, email lấy từ
  verified Auth user. Avatar Google dùng HTTPS allowlist và initials fallback.
- /create: chọn/kéo thả PDF hoặc DOCX, tối đa 20 MiB, tải vào bucket private
  study-documents. Server kiểm tra MIME, PDF header/end marker hoặc cấu trúc
  OOXML ZIP, không chỉ phần mở rộng. Upload xong chuyển sang /processing để
  phân tích nội dung thật, sau đó chọn câu hợp lệ để tạo bài luyện tập.
- Document UUID làm khóa thử lại; checksum và path phải khớp để tránh duplicate
  khi client mất phản hồi. user_id luôn do server lấy từ Auth, không nhận từ form.
- /documents: đọc metadata Supabase, tìm filename, mở bằng signed URL 60 giây,
  xác nhận xóa Storage object trước rồi mới xóa database record.
- /dashboard: tài liệu gần đây thật, empty state khi chưa upload. Library được
  đọc lại ở mỗi request, không dùng mock/sessionStorage cho tài liệu thật.
- Các lỗi user-facing dùng tiếng Việt, không trả raw stack trace.

Google provider chưa được cấu hình khi bắt đầu milestone. Người dùng phải nhập
Google Client ID/Secret trực tiếp trong Supabase, callback Google Cloud là
https://eeqeapunixkekiygnbis.supabase.co/auth/v1/callback. Redirect allowlist local:
http://127.0.0.1:3001/auth/callback và http://localhost:3001/auth/callback.
Không đưa OAuth Client Secret vào Next.js env hay source code.

## Phân tích tài liệu bằng Gemini

/create → upload private Storage → /processing?documentId=… → /topics?documentId=….
Các route có documentId dùng trạng thái và dữ liệu thật, không dùng timer mô phỏng.

- POST /api/documents/[id]/analyze xác thực user và ownership trước download.
  Origin và body được giới hạn. Claim trong database chống chạy trùng, tối đa
  ba tài liệu đang xử lý mỗi owner. Next.js after chạy worker sau response 202.
- PDF dùng Gemini native document understanding. Worker thử Files API và xóa
  file tạm khi có; nếu endpoint trả 404, gửi PDF inline qua SDK. Không OCR thủ
  công, không lưu URI Gemini trong database. File gốc luôn ở Supabase private.
- DOCX dùng Mammoth extractRawText, kiểm tra ZIP decompression size và text
  usable. Có warning về ảnh/công thức; không bịa số trang Word.
- @google/genai trả structured JSON với schema API tương thích; Zod server kiểm
  tra lại giới hạn, các trường bắt buộc và semantic. Prompt nằm riêng ở prompts.ts.
- Đáp án có trong nguồn được giữ nguyên, kể cả khi sai về kiến thức. Câu không
  có đáp án giữ null/not_provided trong dữ liệu trích xuất. Gemini không sinh
  câu mới hay distractor. Excerpt
  chứng minh đáp án được lưu; DOCX còn đối chiếu excerpt với text đã đọc.
- Analysis lưu vào document_analyses, topics/questions vào bảng hiện có. Theory
  points lưu trong raw_analysis. Completion dùng một transaction. Run ID tách
  các lần phân tích; dữ liệu cũ được giữ khi thất bại và không phá quiz references.
- GET analysis, mở topics, refresh và POST thông thường sau ready không gọi
  Gemini. Chỉ nút Phân tích lại có xác nhận mới bắt đầu một run mới.
- Một automatic retry cho invalid output/transient error; không tự retry quota
  hoặc invalid key. Timeout request 90 giây, worker 180 giây, lease 4 phút.
  Khi xem lại tiến độ/thư viện, job quá hạn chuyển failed với nút thử lại.

Structured output không bảo đảm nội dung luôn chính xác: kiểm tra lại nguồn
khi tài liệu khó đọc hoặc có warning. Chi tiết và bằng chứng: GEMINI-AUDIT.md.

## Claude solver và quiz từ tài liệu

Các biến server trong .env.local (xem placeholder trong .env.example):
THIRD_PARTY_CLAUDE_API_KEY, THIRD_PARTY_CLAUDE_BASE_URL,
THIRD_PARTY_CLAUDE_MODEL, AI_DOCUMENT_PROVIDER=gemini, AI_SOLVER_PROVIDER=claude.
Gateway đã kiểm tra: https://gpt.teamsoclo.site/v1, model claude-sonnet-5.
Không đặt key vào biến NEXT_PUBLIC_ hoặc commit .env.local.

- Nút Tạo đáp án cho câu còn thiếu gọi POST /api/documents/[id]/solve. API kiểm
  tra user, owner, Origin và body trước khi claim; after chạy worker. Mở trang
  hoặc refresh không gọi AI. Đáp án đã lưu được dùng lại.
- OpenAI SDK gọi gateway theo giao thức tương thích; không dùng Anthropic SDK.
  Health check kiểm tra danh sách model và JSON nhỏ trước khi giải. Không tự
  chuyển model hoặc fallback Gemini khi gateway lỗi.
- Chỉ gửi stem, choices, loại câu, tên chủ đề, tối đa hai ý kiến thức liên quan
  và excerpt ngắn. ID gửi đi là q1…q5; không gửi UUID, tên file, email, profile,
  token đăng nhập hoặc toàn bộ tài liệu. Không xuất hay lưu chain-of-thought.
- Batches tối đa 5 câu, hai batch đồng thời, tối đa 50 câu mỗi lượt. JSON được
  kiểm tra bằng Zod strict; retry JSON không hợp lệ một lần, không retry quota.
  Timeout mỗi request 60 giây, worker 180 giây, lease 4 phút.
- Câu có đáp án nguồn được giữ nguyên. Câu thiếu đáp án có bốn lựa chọn giữ
  nguyên thứ tự/nội dung lựa chọn; câu ngắn/bài tính chỉ được chuyển nếu phù hợp.
  Câu đúng/sai, lý thuyết hoặc chưa xác định không được tự chuyển ở bước này.
- Validator yêu cầu stem hợp lệ, bốn lựa chọn khác nhau, đáp án A–D, không có
  cảnh báo parser, confidence ít nhất 0.65 và lời giải ngắn nếu là AI. Confidence
  dưới 0.85 được đánh dấu cần xem lại; ngưỡng nằm trong solver-settings.ts.
- Hai bảng bổ sung question_solutions và document_solver_jobs có RLS theo owner.
  question_solutions là phần mở rộng 1:1, lưu raw/normalized, nguồn đáp án,
  model do gateway trả về, confidence, explanation và quiz_ready. Các RPC cũ,
  dữ liệu Gemini và bảng questions không bị solver sửa. Gateway lỗi giữ tài liệu
  ready, đánh dấu solver_failed; các batch thành công vẫn được giữ.
- Topics thu gọn câu nguồn, phân trang 10 câu. Tạo bài trắc nghiệm đưa câu hợp
  lệ theo chủ đề vào /setup → /quiz → /result → /review và làm lại câu sai.
  Bài luyện tập, chấm điểm và lịch sử vẫn chạy trong trình duyệt/sessionStorage;
  chưa có chấm điểm hoặc lưu quiz thật ở backend.

Chạy npm.cmd run claude:health để kiểm tra kết nối mà không in key. Development
log chỉ có model, số câu, thời gian, trạng thái, mã lỗi và token usage nếu gateway
cung cấp. Bằng chứng và giới hạn được ghi trong CLAUDE-AUDIT.md.

## Quiz mẫu

/practice → /processing → /topics → /setup → /quiz → /result → /review.
Bộ có sẵn 58 câu Vật lí, 3 chủ đề; cho chọn số câu, nhóm câu hỏi, trộn, lưu và
thoát, nộp bài, xem lời giải, làm lại câu sai. Câu bỏ trống không tính là câu sai
để retry. Chọn file thật không đi vào flow mẫu và không gán câu hỏi mẫu cho file.

Tiến độ và lịch sử bài mẫu vẫn ở sessionStorage, được xóa khi logout. Các công cụ
thử lỗi/reset trong /practice và /settings chỉ xuất hiện ở development.
Xóa mock data không tác động tài liệu Supabase.

## Schema và kiến trúc

Migrations trong supabase/migrations được áp dụng bằng connector Supabase:
profiles, documents, topics, quizzes, questions, quiz_attempts, quiz_answers,
document_analyses, question_solutions, document_solver_jobs.
Tất cả bật RLS; các foreign key tổng hợp chặn liên kết chéo owner/document.
Trigger functions trong schema private, revoke quyền gọi qua Data API.
Profile chỉ cho owner SELECT/UPDATE; insert do Auth trigger.

- src/lib/supabase/client.ts: browser SSR client, publishable key.
- src/lib/supabase/server.ts: request-scoped server client và cookies.
- src/lib/supabase/database.types.ts: types generated từ database thực tế.
- src/lib/supabase/queries.ts: verified user/profile/document queries; dữ liệu
  gửi sang UI chỉ gồm field hiển thị.
- src/proxy.ts: session refresh và private route redirect.
- src/app/api/: API upload/delete/open/logout, xác thực và kiểm tra Origin.
- src/lib/documents/validation.ts: giới hạn và kiểm tra file.
- src/lib/ai/: provider abstraction, Gemini SDK, prompt, schema/config, DOCX reader.
- src/lib/documents/analysis.ts: private download, worker và atomic completion.
- src/lib/documents/prepare-questions.ts, solver.ts: chuẩn hóa và solver riêng.
- src/lib/study-store.ts, quiz-logic.ts: bài luyện tập local từ câu mẫu hoặc câu
  tài liệu đã được server kiểm tra, không thay thế kho tài liệu Supabase.

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run gemini:health
npm.cmd run claude:health
npm.cmd run build
node scripts/verify-gemini-security.mjs
# Sau git add, kiểm tra secret trong các file sẽ commit:
node scripts/verify-staged-secrets.mjs
# Server local đang chạy, dùng Chrome có sẵn:
npm.cmd run test:e2e
# Opt in: thực hiện ba phân tích Gemini thật, có thể phát sinh chi phí API.
$env:RUN_GEMINI_E2E='1'
npm.cmd run test:e2e -- tests/analysis.spec.ts
Remove-Item Env:RUN_GEMINI_E2E
# Opt in: một DOCX synthetic qua Gemini và Claude thật.
$env:RUN_CLAUDE_E2E='1'
npm.cmd run test:e2e -- tests/claude.spec.ts
Remove-Item Env:RUN_CLAUDE_E2E
```

Playwright dùng C:\Program Files\Google\Chrome\Application\chrome.exe.
E2E cần hai tài khoản riêng trong E2E_EMAIL_A/B, E2E_PASSWORD_A/B,
E2E_USER_ID_A/B hoặc logs/test-users.json local (ignored). Không dùng tài khoản
người dùng thật làm fixture. File test-users dùng tại lần audit này chứa hai
tài khoản synthetic được provision có xác nhận; nó không chứng minh email signup
hay email delivery. Test upload tự xóa các file nó tạo, không xóa dữ liệu khác.

tests/rls-ownership.sql kiểm tra cả 7 bảng và linkage cross-user trong transaction
ROLLBACK. Thiết lập test.user_a/test.user_b bằng UUID hai fixture trước khi chạy
qua connector. Không dùng SQL script này như migration.
tests/analysis-ownership.sql kiểm tra RLS mới, run nonce, claim đồng thời,
idempotency, transaction rollback và reprocessing giữ dữ liệu cũ, cũng ROLLBACK.
Fixture PDF/DOCX tự tạo trong tests/analysis-fixtures.mjs; không tải tài liệu
ngẫu nhiên từ Internet. Live Gemini test bị skip trong bộ hồi quy mặc định;
health check chỉ gửi payload nhỏ và không in key hay raw response.
tests/solver-guards.spec.ts kiểm tra 43 câu nguồn, phân trang, không gọi solver,
ownership cả API/RLS, run nonce và lỗi gateway mô phỏng giữ extraction nguyên vẹn.
tests/claude-provider.test.mjs dùng HTTP transport giả của SDK để kiểm tra retry
JSON đúng một lần, quota không retry, model không tồn tại và token usage.
Live Claude được skip trong hồi quy mặc định để tránh gọi AI ngoài ý muốn.

Xem SUPABASE-AUDIT.md cho kết quả thực tế và những bước cần xác minh tiếp.
Xem AUTH-FIX-AUDIT.md cho chẩn đoán lỗi signup/login/Google và giới hạn kiểm thử.
UI-AUDIT.md / UI-POLISH-AUDIT.md ghi audit của frontend trước tích hợp.

## Dependency warnings

5 high trong chuỗi ESLint dev tooling (fast-glob → micromatch → braces) đã có từ
scaffold. Không chạy audit fix --force làm hạ eslint-config-next xuống Next 14.
Các SDK Supabase và fflate được pin trong package-lock; dùng fflate 0.8.3 thay vì
0.8.2 có cảnh báo ZIP64. Kiểm tra audit production riêng trước khi phát hành.
Gemini, Zod, Mammoth được pin. Override argparse của Mammoth lên 2.0.1 loại bỏ
chuỗi sprintf-js có cảnh báo DoS; extraction DOCX đã được kiểm tra thật.
