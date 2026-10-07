# UI / UX polish audit

## Phạm vi

Tinh chỉnh prototype học tập cá nhân theo brief, giữ light / soft academic / indigo.
Đã đọc lại design-taste-frontend và high-end-visual-design. Đây là targeted evolution,
không phải landing page hoặc redesign. Dials giữ 5 / 3 / 5; font, icon, logo và palette
chính được giữ. Các mặc định marketing như hero lớn, ảnh, double bezel trên mọi card,
animation khi scroll, dual theme và macro whitespace không áp dụng cho brief này.

Hash trước/sau của toàn bộ src/lib và các page/layout trùng nhau. Không sửa route,
quiz logic, scoring, state flow, data model hoặc architecture. Không thêm dependency
vào package.json; không tích hợp dịch vụ hoặc thay đổi phần mềm hệ thống.

## Audit trước khi chỉnh

- Dashboard có top line thừa, header cách section lớn, watermark U và panel 230px.
- Empty state dashboard lặp primary CTA tạo bài; documents lặp CTA và luôn hiện search.
- Metadata nhiều chỗ 9-11px, bao gồm trên mobile; một số chữ phụ thiếu contrast.
- Sidebar active chỉ khác màu nền; thông tin profile nhỏ và có đoạn trang trí phía dưới.
- Thông báo prototype xuất hiện ở shell, create, processing, topics, review và settings.
- Result có score nhỏ hơn cần thiết; hai hành động cuối bị tách thành hàng riêng.

Ảnh trước lượt polish nằm ở logs/polish/{width}-{route}.png.

## Những phần đã chỉnh

- Dashboard giữ một primary CTA ở header. Trạng thái không có bài dở còn một hàng nhỏ
  với icon, title và mô tả. Hai cột gần đây dùng list nhẹ, hai tài liệu mới nhất và tối đa
  hai kết quả; bỏ watermark và lời nhắc trang trí. Sidebar vẫn giữ các mục điều hướng.
- Sidebar tăng contrast; active có dấu indigo bên trái và font weight; hover nhẹ;
  menu dùng gap 8px và profile thu gọn. Không đổi logo study. hoặc nhãn điều hướng.
- Xóa badge, lời giải thích và footer prototype khỏi màn hình học tập. Điều khiển mock
  nằm trong disclosure Công cụ phát triển đóng mặc định, chỉ render ở development.
- Create giữ centered layout và nested upload shell. Dropzone giảm chiều cao;
  drag-over có nền nhẹ và border rõ. File selected có nhãn dễ đọc, tên dài wrap,
  thông tin phụ và nút xóa. CTA disabled dùng nền trung tính và chữ có contrast;
  enabled dùng indigo. Không parse hoặc gửi nội dung file thật.
- Documents ẩn search và header action khi thư viện rỗng, giữ một CTA trong empty state.
  Empty states thống nhất icon 24px, title, mô tả ngắn và CTA khi cần; giảm padding.
- Quiz giữ nguyên bố cục tập trung. Question area 860px; answer text 15px / mobile 14px;
  selected có nền soft indigo, border kép và check. Navigator current/answered/unanswered
  khác nền, border và aria state; nút current có outline phụ. Submit secondary nằm dưới
  navigator khi chưa đến câu cuối; Câu tiếp vẫn primary. Radio keyboard và dialog giữ nguyên.
- Result giữ layout, ring tăng 176px / mobile 160px, score 44px, percentage 32px,
  statistics 24px và metadata 12px. Xem đáp án primary, làm lại câu sai secondary;
  làm lại toàn bộ và về trang chủ nằm chung nhóm tertiary. Không thêm confetti.

## Tokens

| Token | Trước | Sau |
| --- | --- | --- |
| Muted text | #607086 | #56667D |
| Body | 14px / mobile 13px | 15px / mobile 14px |
| Metadata | 8-12px | Tối thiểu 12px |
| Control radius | 9-13px | 10px |
| Surface radius | 18-24px | 16/20px |
| Focus | #918AFA | Primary #5148D8 |
| Spacing | Nhiều giá trị riêng lẻ | Tokens 4/8/12/16/20/24/32/40px cho nhịp chính |

Thêm control border #B7C2D5 và disabled background #E8EDF5. Nền #F6F8FC, sidebar
#F0F3F9, surface trắng, primary #5148D8, text navy #17243B giữ nguyên. Trạng thái
green/red/amber giữ ý nghĩa. Các kích thước glyph, ring và border không dùng spacing tokens.

## Taste pre-flight và kiểm tra

- Không có KPI cards, chart dashboard, repetitive bento, gradient text, glow, glass,
  oversized heading hoặc các hiệu ứng chuyển động không phục vụ thao tác.
- Lists dùng separator và whitespace thay cho khung card lặp. Empty state nhỏ;
  radius phân theo vai trò và màu accent nhất quán. Copy dùng tiếng Việt rõ nghĩa.
- Các form có label, focus visible, helper text và lỗi; kiểm tra file input,
  enabled/disabled CTA, radio selected, keyboard và dialog Escape.
- Audit chữ hiện trên các route ở 1440/390 và processing: không còn chữ dưới 12px
  hoặc trường hợp text contrast thấp hơn ngưỡng AA trong các trạng thái đã đo.
  Điều khiển disabled được loại khỏi phép đo contrast; đây không phải chứng nhận
  accessibility toàn diện. Kết quả đo nằm ở logs/polish/contrast-audit.json.
- Chrome kiểm tra 1440, 1280, 834, 390 trên dashboard/create/documents/history/topics/
  setup/quiz/result/review; kiểm tra thêm dashboard/documents/history/result rỗng.
  Không horizontal overflow. Reduced motion giữ transition tức thời.
- Lint PASS; typecheck PASS; build PASS. 4/4 E2E PASS. Full flow production PASS:
  Dashboard -> file picker -> processing -> topics -> setup -> quiz -> 8/10 -> review
  hai câu sai -> retry hai câu -> 100%.
- Agent-browser xác nhận production không blank, không error overlay/console error,
  không render .dev-tools ở create/settings. Dev server để lại trên 127.0.0.1:3001.
- Lighthouse local production dashboard: performance 94, accessibility 100,
  best practices 100; LCP 3.0s, CLS 0, TBT 40ms. Đây là phép đo lab mobile giả lập,
  không xác nhận Core Web Vitals trên thiết bị thật. JSON không có runtimeError hoặc
  runWarnings. Kiểm tra log lần sau xác nhận CLI trả mã lỗi Windows -1073740791 ở bước
  ChromeLauncher Killing Chrome sau khi ghi báo cáo; không tính CLI là check PASS.
  Không sửa Chrome hoặc phần mềm hệ thống để xử lý lỗi cleanup của công cụ audit.

Ảnh sau polish ở logs/ui-audit; selected file/answer và báo cáo Lighthouse ở logs/polish.
Mock và giới hạn backend vẫn như README. Lượt này chỉ hoàn thiện UI, không biến
prototype thành dịch vụ production có phân tích tài liệu thật.
