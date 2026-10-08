# Claude solver audit — 2026-10-07

## Tiếp tục milestone — 2026-10-08

- Giữ nguyên THIRD_PARTY_CLAUDE_MODEL=claude-sonnet-5, không thử model khác.
  Không gọi lại health check hay live AI trong lượt này; dùng xác nhận của
  người dùng và chỉ kiểm tra cấu hình local, không in key.
- Parser nhận nhãn không có khoảng trắng (A.Q>0), so khớp case để không nhầm
  Q với q, giữ raw. Kiểm tra công thức theo dấu/thứ tự, ngoài kiểm tra ký hiệu
  Unicode; sai khác được đánh dấu cần đối chiếu, không tự suy diễn sửa.
- Đã hỗ trợ 1–3 lựa chọn bằng prompt + validator + RPC v2. Lựa chọn nguồn phải
  giữ nguyên tại vị trí cũ cả ở server lẫn DB. Source-answer vẫn không gọi AI.
  Các câu đã có ai_model lưu trong DB không được claim lại, kể cả regenerate;
  API từ chối regenerate=true. Câu bất định/invalid đã lưu không tự gọi lại AI.
- Chuẩn hóa lại các extension đã lưu chạy local, giữ đáp án/choices/model AI,
  chỉ update khi field thực sự thay đổi, theo timestamp và loại worker đang
  processing. Dữ liệu nguồn và raw_analysis không bị sửa.
- Migration bổ sung 20261008085428_complete_partial_mcqs đã áp dụng: thêm
  claim_document_solver_v2/complete_question_solutions_v2. Không sửa/drop RPC
  trước, không backfill hay thay đổi tài liệu thực. CLI không tạo migration được
  vì cố ghi telemetry ngoài project; sử dụng connector, tên phiên bản local
  lấy từ migration history remote. Generated types đã cập nhật.
- Lint/typecheck và 19 unit đã đạt. E2E nguồn/câu thiếu choices/cache/RLS đã
  đạt, dùng 43 câu nguồn + một câu hai lựa chọn synthetic. Đáp án cuối trong
  test DB được cung cấp bằng fixture synthetic-test-only, không phải Claude
  thật; không dùng số liệu này để báo kết quả tài liệu người dùng.
- Chẩn đoán hydration độc lập bằng scripts/diagnose-hydration.mjs: Chrome sạch
  HTTP 200, 0 hydration errors, 0 injected attrs; cùng trang với bis_register/
  bis_skin_checked mô phỏng HTTP 200, 1 hydration error, 5 injected attrs.
  Không suppress/ẩn warning, không sửa/cài/gỡ extension hay profile hệ thống.
  Chưa loại được cảnh báo ở browser có extension; cần xử lý extension ở browser.
- Tài liệu hiện tại chưa có URL/documentId/tên xác nhận trong lượt yêu cầu này.
  Truy vấn lấy danh sách năm tài liệu của nhiều owner bị automatic approval
  review từ chối vì vượt phạm vi một tài liệu hiện tại. Không thử lách truy vấn;
  đã hỏi URL Topics hoặc tên file để giới hạn đúng tài liệu. Chưa đọc/chạy Claude
  hay chuẩn hóa dữ liệu tài liệu thực trong lượt này. Sáu số liệu được yêu cầu
  chưa xác nhận, không thay bằng số fixture hoặc báo 0.
- Hồi quy toàn bộ đạt 13 passed / 2 paid live skipped (3.3 phút); production
  build cuối đã đạt, kể cả TypeScript. 19 unit/lint đạt. Quét 47 production
  client files không thấy Gemini/Claude key; .env.local ignored/untracked.
  Server đã khởi động lại ở http://127.0.0.1:3001, /login HTTP 200.
  Smoke bản cuối sau restart: 2 passed (40.8s), bao gồm chuẩn hóa dữ liệu cũ,
  partial choices, cache, source preservation, RLS và Chrome sạch. Quét 14 file
  staged không thấy credential hoặc env bí mật.
  Kết quả 2026-10-07 bên dưới là bằng chứng lịch sử, không thay thế kiểm thử
  trên tài liệu thực đang chờ xác nhận.

Gemini tiếp tục trích xuất tài liệu. Claude qua gateway bên thứ ba chỉ giải câu
chưa có đáp án nguồn. Kiểm tra trực tiếp bằng hai tài khoản synthetic, không dùng
tài khoản hay tài liệu người dùng thật làm fixture.

## Trạng thái

| Hạng mục | Kết quả |
| --- | --- |
| Gemini extraction | DOCX synthetic thật thành công; SDK và RPC extraction cũ được giữ |
| Claude env | Key server-side đã điền; .env.local ignored, không in giá trị |
| Claude gateway | Kết nối https://gpt.teamsoclo.site/v1 thành công |
| Claude model available | GET /models có claude-sonnet-5; không chọn model khác |
| Claude health check | OK; model yêu cầu và response.model đều claude-sonnet-5 |
| Question parser | Tách choice block khi khớp đầy đủ, giữ raw; nghi ngờ thì chặn quiz |
| Scientific symbols | Unit test giữ ΔU, Q, A, =, >, <, ≥, ≤, →, ⇌, ±, °C, 10⁻³, m/s², √, ∫ |
| Source-answer preservation | Fixture cố ý ghi 2+2 đáp án B=5; sau solver vẫn B, không gọi Claude cho câu nguồn |
| AI solver | Live MCQ 3+3 chọn B=6; câu tính 2+3 được giải; raw question không đổi |
| 4-choice generation | Live bài tính tạo 4 choices, đáp án 5; validator kiểm tra unique và đáp án |
| Question validator | Strict Zod, ID/count, source-choice fidelity, confidence, lời giải và quiz_ready |
| Database persistence | Migration 20261007151655 đã áp dụng; types sinh từ DB thật; extension 1:1 và jobs riêng |
| Token usage capture | Gateway có usage; batch live 1936 input / 132 output / 0 reasoning / 2068 total |
| Topics UI | Thu gọn, 10 câu/trang, phân biệt nguồn/AI, đếm trạng thái, CTA mở setup và quiz thật từ dữ liệu |
| Next.js Issue | Clean Chrome không có console/hydration errors; extension trong browser khác gây bis_skin_checked/bis_register |
| Security | API owner/Origin/body guards và RLS đạt; 47 production client files không chứa hai AI key; .env.local ignored/untracked |
| lint/typecheck/tests/build | Lint/typecheck đạt; 17 unit, 13 E2E đạt; 2 paid live tests skip trong suite mặc định; production build đạt |

## Bằng chứng kiểm thử

- `npm run claude:health`: health cuối 2026-10-07T15:47:56Z trả OK, model
  requested/reported `claude-sonnet-5`, modelsSupported=true, usage 51/9/0/60.
  Đây là tên gateway báo cáo; không xác minh được engine nằm sau gateway.
- `RUN_CLAUDE_E2E=1 npm run test:e2e -- tests/claude.spec.ts`: đạt 47.4 giây.
  Upload DOCX thật → Gemini ready → nguồn B giữ nguyên → explicit solver → hai
  câu AI ready → refresh không đổi solution.updated_at → CTA → setup → quiz.
  Foreign owner nhận 404; raw questions không bị solver thay đổi. Console errors=0.
  Screenshots 390/1440 px không tràn ngang. Fixture đã xóa sau test.
- `tests/solver-guards.spec.ts`: đạt 22.7 giây sau sửa memoization, 43 câu nguồn
  không tạo Claude job; phân trang 10 câu; refresh không đổi timestamps. API chặn
  anon/foreign owner/Origin sai/body quá giới hạn. Data API user B không đọc được
  question_solutions/document_solver_jobs của A và không claim được. Nonce sai
  không lưu được. Lỗi gateway mô phỏng chỉ làm solver_failed; documents.ready
  và raw_analysis vẫn nguyên vẹn.
- Unit SDK transport giả: invalid JSON retry đúng một lần; quota 429 đúng một
  request; model thiếu không fallback; token usage cộng cả hai lượt; model do
  response báo được trả về. Parser/validator test gồm lựa chọn trùng, confidence
  thấp, loại không hỗ trợ, thiếu lời giải, ID sai và thay choices nguồn.
- Hồi quy đầu phát hiện memoization: GET solutions rỗng trước insert được React
  dùng lại khi đọc sau insert trong cùng render. Đọc lại với AbortController
  signal theo tài liệu Next.js local để opt out request memoization. Không tắt
  cache/overlay toàn ứng dụng. Hai fixture còn sót do timeout đã được xóa bằng
  UUID + đúng owner synthetic + tên fixture cố định.
- Hồi quy cuối: 13 passed / 2 skipped, 2.7 phút; không có failure. Hai live tests
  được opt in riêng, không chạy lại trong suite mặc định. Production build Next
  16.3.8 thành công, compile + TypeScript + static generation, có route solve.
- Quét 47 file .next/static: cả Gemini key và Claude key đều không xuất hiện.
  .env.local ignored, không được Git track. Quét 126 file staged: không có env
  bí mật hoặc credential đã cấu hình. npm audit --omit=dev: 0 vulnerabilities.
- Server development khởi động lại tại http://127.0.0.1:3001; /login trả 200.
  Smoke sau restart: 3 passed (28.9s), gồm login/logout thực, Chrome sạch và
  guard Topics 43 câu. Không cài phần mềm hệ thống hoặc sửa ứng dụng cổng 3000.

Log và ảnh trong `logs/claude/` đều ignored. Usage batch trên không bao gồm
Gemini, health check hoặc các lần sửa lỗi khác; không phải tổng hóa đơn API.
Không lưu chain-of-thought, raw response, key hoặc nội dung tài liệu trong log.

## Kiến trúc, quyền và giới hạn

- Registry tách document provider Gemini và solver provider Claude. OpenAI SDK
  7.30.0 tương thích gateway, json_object + Zod strict phía server; chưa chứng
  minh gateway hỗ trợ strict JSON schema native. JSON thừa field bị từ chối.
  Prompt đã làm rõ root chỉ có results sau một lỗi schema thực tế; không nới Zod.
- Tối đa 5 câu/batch, 2 batch song song, 50 câu/lượt. Input alias q1…q5, không
  gửi UUID/file metadata/profile/email/Auth token. Chỉ stem, choices, dạng câu,
  tên topic, hai ý kiến thức ngắn, excerpt. API key chỉ trong Authorization SDK.
- Timeout request 60s, worker 180s, lease 4 phút. JSON retry một lần; quota/key
  sai không retry. Gateway lỗi dừng xếp batch mới; batch đang chạy có thể hoàn
  tất và được giữ. Explicit retry mới gọi AI tiếp, view/refresh không gọi AI.
- Threshold confidence tập trung 0.65 tối thiểu, dưới 0.85 cần xem lại. Câu có
  cảnh báo parsing/ký hiệu, ít hơn bốn choices, duplicate hoặc chưa solved không
  vào quiz. Không suy diễn sửa ký hiệu nếu khác excerpt. AI confidence là tự
  đánh giá, không bảo đảm đáp án đúng; lời giải AI cần đối chiếu nguồn.
- Ban đầu automatic approval review từ chối thiết kế ALTER/backfill/drop RPC
  vì có thể ảnh hưởng schema và pipeline hiện có. Thiết kế đã được thay bằng
  migration chỉ bổ sung hai bảng và bốn RPC mới, rồi được chấp thuận áp dụng.
  Không sửa/xóa bảng, constraint, RPC hay dữ liệu cũ; không quay lại migration
  bị từ chối. Không có migration pending cần người dùng áp dụng.
- Bảng question_solutions mở rộng questions theo PK/FK question_id; RLS kiểm
  tra owner và liên kết question/document/analysis_run. Job có lease và nonce.
  Completion chỉ cập nhật extension của câu chưa có đáp án nguồn, đúng run,
  đúng nonce và lease. RLS bật, anon không có quyền; RPC security invoker,
  search_path rỗng, revoke public/anon. Không sử dụng service-role key.
- Owner có quyền sửa dữ liệu của mình theo RLS; quiz setup kiểm tra lại validator
  phía server trước khi gửi câu vào client. Quiz/chấm điểm/sessionStorage vẫn
  là bài luyện tập local, chưa lưu attempt/result ở backend.
- Clean Chrome xác nhận app không sinh hydration error. Browser có extension
  chèn bis_skin_checked/bis_register vẫn có thể hiện Next.js Issue; chưa sửa hay
  gỡ extension của máy. Không suppressHydrationWarning, không ẩn indicator.
- Native PDF Gemini giữ nguyên đường xử lý đã kiểm tra ở milestone trước; live
  milestone này dùng DOCX synthetic nhỏ. Chưa kiểm tra scanned PDF/OCR mới,
  gateway outage thật, bài nhiều trang lớn, rate-limit production hay độ chính
  xác chuyên môn của AI trên tài liệu người dùng.
- Supabase advisors: không có lỗi RLS/function mới. Cảnh báo Auth đã có trước:
  [Leaked Password Protection chưa bật](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  Hai INFO index chưa dùng thuộc bảng cũ, không thay đổi ở milestone này.
  Chuỗi ESLint có 5 high dev tooling từ scaffold; không audit fix --force.
- Repository trước milestone chưa có commit. Commit yêu cầu là root commit,
  gồm baseline project và solver, không chỉ diff Claude. Git author chỉ cấu hình
  local: dungduong23102009 / dungduong23102009@gmail.com. File index.lock rỗng
  cũ được xóa sau xác nhận không có git.exe đang chạy. Skill vendor có bốn dòng
  trailing whitespace từ upstream; không sửa skill, diff check source project đạt.

## File chính

`src/lib/ai/{config,registry,claude-provider,solver-schemas,solver-settings,question-validation}.ts`,
`src/lib/documents/{prepare-questions,solver,load-analysis}.ts`,
`src/app/api/documents/[id]/solve/route.ts`,
`src/components/{document-topics,document-quiz-setup}.tsx`,
`src/app/(study)/setup/page.tsx`,
`supabase/migrations/20261007151655_claude_solver_provider.sql`,
`scripts/claude-health.mjs`, tests parser/provider/guards/live, README và .env.example.
