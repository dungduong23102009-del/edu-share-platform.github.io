"use client";
export default function AppError({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Chưa thể tải trang</h1>
        <p className="page-description">
          Dịch vụ đang gián đoạn. Hãy kiểm tra kết nối và thử lại.
        </p>
        <button className="button primary" onClick={reset}>
          Thử lại
        </button>
      </div>
    </main>
  );
}
