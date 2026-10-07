# Milestone 1: UI / UX audit

Đã kiểm tra màn hình ở 1440px, 1280px, 834px và 390px bằng Chrome thực tế.
Ảnh theo từng route nằm ở logs/ui-audit/. Đây là audit prototype, không phải báo cáo
hiệu năng production trên điện thoại thật.

## Các quyết định theo brief

- Ứng dụng học tập cá nhân, không phải marketing page hay dashboard doanh nghiệp.
- Áp dụng Taste Skill ở typography, palette, nhịp khoảng trắng, tính nhất quán,
  accessibility và tránh giao diện mẫu; không áp các mặc định ảnh marketing, motion mạnh,
  section padding cực lớn hoặc dual-theme vì brief chỉ định light và motion 3.
- Mặc định sáng; font Be Vietnam Pro tự host với ba weight, hỗ trợ tiếng Việt.
- Một accent indigo; sky blue chỉ ở metadata DOCX. Màu trạng thái có ngữ nghĩa.
- Một panel tiếp tục học có điểm nhấn; thư viện là list, kết quả gần đây là hàng gọn.
  Không có KPI cards, chart dashboard, gradient background, confetti hay animation lặp.

## Audit và tinh chỉnh

- Hierarchy: title 24-30px, section 15-18px; quiz question 19-23px.
- Alignment: nội dung app có max-width, flow 760px, quiz 820px; chia cột rõ trên desktop,
  một cột trên mobile, sidebar chuyển thành menu thu gọn.
- Radius: surface 18-24px; input/button 9-13px; badge 6-7px, cùng một hệ theo vai trò.
- Contrast: navy trên nền xanh-xám; primary trắng trên indigo; đáp án có border/background
  và ký hiệu chọn, không chỉ dựa vào màu để nhận biết.
- Form: file picker có accessible label; checkbox có nhãn; lỗi inline; nút bị vô hiệu
  khi chưa có file, chưa chọn chủ đề hoặc chưa có nguồn câu hỏi.
- Quiz: radio surfaces lớn; Arrow keys đổi đáp án; navigator có aria-label trạng thái;
  modal có focus trap native dialog và Escape; không hiện đúng/sai trước nộp bài.
- Trạng thái trống/lỗi: thư viện, lịch sử, kết quả, file không hỗ trợ/trống/quá lớn,
  xử lý thất bại, nguồn không có câu; đều có nội dung và hướng tiếp tục.
- Giảm chrome: quiz không có sidebar; tắt Next development indicator để không che UI.
- Responsive: không horizontal overflow trên cả bốn kích thước; navigator wrap;
  answer surfaces, controls và modal phù hợp chiều rộng 390px.
- Reduced motion: transition được giảm khi hệ thống bật prefers-reduced-motion.
- Đã sửa lỗi khôi phục storage trước thao tác trên trang tạo bài. History/result không
  bị reset khi chọn tài liệu sau full-page reload.
- Tạm dừng bài giữ đáp án/current question và dừng đồng hồ; resume không mất tiến độ.

## Kiểm tra chức năng

1. Full flow: upload mẫu -> processing -> topics -> setup -> 10 câu -> 8/10 -> review
   đúng 2 câu sai -> retry đúng 2 câu -> 100% -> làm lại toàn bộ reset lựa chọn.
2. Error/empty: file không hỗ trợ và file trống, PDF metadata, lỗi processing, retry,
   không chọn topic/source, nguồn câu có hạn, shuffle settings, nộp bài bỏ trống,
   thư viện/lịch sử trống.
3. Responsive audit: home/create/documents/history/topics/setup/quiz/result/review
   trên 1440/1280/834/390; menu mobile và reduced motion.
4. Bàn phím và phiên học: đổi radio bằng ArrowDown, navigator, Escape modal,
   pause/resume và reload vẫn giữ đáp án.

## Giới hạn chủ động của milestone

- File không được parse, dữ liệu Vật lí được dùng cho mọi tài liệu; trang nguồn mô phỏng.
- Người dùng/hồ sơ chỉ là mock; không có API, authentication, database hay deployment.
- Session storage không đồng bộ giữa các thiết bị. Prototype không thay thế cơ chế lưu
  bài an toàn của backend và không dùng để kiểm tra/đánh giá thật.
