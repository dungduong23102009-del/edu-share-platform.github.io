# Gemini document analysis — 2026-10-07

## Kết nối và triển khai

Key người dùng điền trong .env.local đã qua models.get và health check structured
JSON thật. Không đánh giá key chỉ theo prefix. Không in key, raw Gemini response,
file text, password hay token. .env.local và logs nằm trong .gitignore.

SDK chính thức @google/genai 2.27.0; model gemini-3.5-flash-lite, cấu hình tập trung
trong src/lib/ai/config.ts. Request interactions.create dùng store:false, structured
response schema, temperature:0, maxRetries:0. Zod 4.6.5 validate lại toàn bộ output.
Mammoth 1.13.0 đọc DOCX text, fflate chỉ kiểm tra archive metadata/size.

Files API upload hiện trả 404 với cấu hình API này. Provider chuyển sang inline
PDF native document understanding trong cùng SDK; các PDF kiểm thử đã chạy thật
qua phương thức này. Không chuyển thành OCR/text regex. Nếu Files API khả dụng,
worker dùng URI tạm và cleanup trong finally; chưa xác minh nhánh Files API thành
công với key hiện tại. Không lưu URI Gemini lâu dài.

API từ chối rich JSON Schema có các bounds. Schema gửi lên chỉ giữ types, nullable,
enum, required, object properties/items và additionalProperties. Các giới hạn
chuỗi/array/page/confidence và kiểm tra semantic vẫn được Zod áp dụng server-side.

Tham chiếu chính thức:

- [Google SDK](https://github.com/googleapis/js-genai)
- [Document processing](https://ai.google.dev/gemini-api/docs/document-processing)
- [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)

## Bằng chứng kiểm thử thật

Ba fixture tự tạo, upload qua UI → Storage private → Gemini → PostgreSQL → topics:

| Fixture                   | Chủ đề | Câu nguồn | Ý kiến thức | Kết quả |
| ------------------------- | -----: | --------: | ----------: | ------- |
| PDF text, internal energy |      1 |         0 |           3 | PASS    |
| PDF câu hỏi + đáp án      |      1 |         2 |           0 | PASS    |
| DOCX text tiếng Việt      |      1 |         0 |           3 | PASS    |

PDF câu hỏi có câu 2+2, đáp án nguồn B=5 cố ý sai: JSON và questions.correct_answer
vẫn giữ B/source. Câu 3+3 không có đáp án vẫn null/not_provided. PDF page=1 hợp lý,
excerpt chứng minh đáp án được lưu. DOCX sourcePage=null/sourcePages=[], có warning
Word về khả năng mất hình ảnh/công thức. Không tạo câu hỏi từ theory.

Mỗi fixture: user B bị chặn POST analyze/GET analysis bằng 404; repeated POST trong
processing trả 202 nhưng không tạo run mới; POST sau ready trả ready/200. Refresh
topics không đổi current_run_id/updated_at. Screenshot 390px/1440px không overflow.
Fixtures live được xóa bằng API owner khi kết thúc, không để lại seed nội dung AI.
Báo cáo số lượng không chứa nội dung riêng ở logs/gemini/analysis-report.json.

DOCX XML lỗi: fail nhẹ nhàng trước Gemini generation, retry bằng nút explicit,
reload failed không tự retry. API anonymous=401, foreign Origin=403. Job hết lease
được phục hồi thành failed/timeout khi đọc trạng thái. Hai E2E mới đều PASS.

tests/analysis-ownership.sql đã chạy transaction ROLLBACK thật: foreign ownership,
run nonce, concurrent claim, ready idempotency, explicit reprocess, rollback toàn
bộ khi insert câu không hợp lệ, giữ analysis/questions cũ và đổi version pointer
chỉ sau success. tests/rls-ownership.sql cũng PASS sau migration cho bảy bảng cũ.

## Database và an toàn

Migration local/remote 20261007113405_gemini_document_analysis.sql đã áp dụng và
types TypeScript được generate từ database thật. Supabase CLI không chạy được
vì cố ghi telemetry ở home ngoài project; dùng connector để áp dụng và đối chiếu
version, không đổi phần mềm/cấu hình hệ thống.

document_analyses bật RLS; topics/questions reuse schema hiện có. RPCs SECURITY
INVOKER, search_path rỗng, revoke anon/public. Endpoint getUser + owner trước đọc
Storage; publishable key + session, không service-role. AI config/provider/worker
import server-only; client chỉ nhận metadata/kết quả và safe error message.

Complete RPC chạy atomic; lịch sử topics/questions của các run cũ vẫn còn để giữ
quiz foreign keys. Query hiện tại lọc current_run_id. Reprocess failed không xóa
analysis cũ; UI hiện trạng thái failed/retry cho run mới. Giới hạn 3 job/owner,
1 retry tự động cho invalid output/transient, không retry quota/key. Request 90s,
worker 180s, lease 4 phút; expiry recovery khi có request tiếp theo, không cron.
Sau crash server, trạng thái database không tự đổi ngay nếu không có request đọc.

Security Advisor chỉ có cảnh báo Auth đã tồn tại:
[Leaked Password Protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Không có cảnh báo RLS/function mới. Performance chỉ INFO về hai index chưa dùng,
giữ index hỗ trợ foreign-key queries. Không đổi cấu hình Auth ngoài milestone.

## Giới hạn và quality checks

Kiểm thử cover PDF text/Q&A một trang và DOCX text tổng hợp. Chưa xác minh scanned
PDF, ảnh/công thức phức tạp, hoặc mọi tài liệu của người dùng. Structured schema
không chứng minh tuyệt đối source fidelity: DOCX đối chiếu answer excerpt với
text; PDF vẫn dựa vào model đọc nguồn. Confidence đo extraction, không đo kiến
thức đúng. Tài liệu khó đọc cần kiểm tra lại nguồn, không silently correct đáp án.

Upload tối đa 20 MiB; DOCX decompressed tổng 64 MiB, mỗi part 16 MiB, text 250000
characters. Schema tối đa 50 topics, 500 source questions, 500 theory points,
source excerpt 600 characters. Prompt yêu cầu warning nếu vượt extraction capacity.
Không bảo đảm extraction đầy đủ cho tài liệu dài chỉ vì status=ready.

Lint: PASS (zero warnings). Typecheck: PASS. Unit tests: 12/12 PASS. Bộ E2E hồi
quy: 12 PASS, 1 live Gemini case skip mặc định; case live đó đã chạy thật và PASS
riêng cùng case DOCX lỗi (2/2). Production build: PASS, 23 pages generated. Server
development đã restart ở http://127.0.0.1:3001.
Sau restart: 3/3 smoke tests PASS (email login/cookie/session/logout thật,
Chrome sạch không hydration error, DOCX lỗi/retry/recovery). Không gọi lại
Gemini generation trong lượt smoke này.

node scripts/verify-gemini-security.mjs: PASS. 46 client artifacts được kiểm tra,
không chứa giá trị API key; .env.local ignored=true, tracked=false. Chạy scan sau
build, trước next dev có thể thay thế artifacts. Log kết quả an toàn trong
logs/gemini/security-report.json. Production npm audit 0 vulnerabilities; 5 high
có sẵn trong ESLint dev tooling còn lại, không force downgrade Next.js. Không cài
software hệ thống. Cảnh báo NO_COLOR/FORCE_COLOR của Playwright chỉ ảnh hưởng màu log.

Commit yêu cầu: feat: add gemini document analysis. Đang chờ tên/email Git tác giả
để cấu hình repo-only và commit; không dùng identity giả, không push/deploy.
