"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { formatDuration, scoreAttempt } from "@/lib/quiz-logic";
import { studyActions, useStudy } from "@/lib/study-store";
import { Dialog, EmptyState, PageHeader } from "./ui";

export function HistoryPage() {
  const { history } = useStudy();
  const router = useRouter();
  const [clearOpen, setClearOpen] = useState(false);
  return (
    <div>
      <PageHeader
        title="Nhìn lại hành trình học"
        description="Kết quả bài luyện tập mẫu trong phiên trình duyệt của bạn."
        action={
          history.length > 0 && (
            <button className="button quiet" onClick={() => setClearOpen(true)}>
              Xóa lịch sử
            </button>
          )
        }
      />
      {history.length ? (
        <div className="history-list">
          {history.map((attempt) => {
            const score = scoreAttempt(attempt);
            return (
              <button
                className="history-row"
                key={attempt.id}
                onClick={() => {
                  studyActions.openAttempt(attempt);
                  router.push("/result");
                }}
              >
                <span className="mini-score">
                  {score.percent}
                  <small>%</small>
                </span>
                <div>
                  <strong>{attempt.title}</strong>
                  <span>
                    {score.correct}/{score.total} câu đúng <i />{" "}
                    {formatDuration(attempt.duration)} <i />{" "}
                    {new Date(attempt.completedAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                <ArrowRight size={19} />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Chưa có bài trắc nghiệm gần đây"
          description="Hoàn thành một bài để lưu kết quả."
          action={
            <Link href="/practice" className="button primary">
              Luyện với câu hỏi mẫu
            </Link>
          }
        />
      )}
      <Dialog
        open={clearOpen}
        title="Xóa lịch sử luyện tập?"
        onClose={() => setClearOpen(false)}
      >
        <p>
          Lịch sử luyện tập trong phiên này sẽ được xóa. Bạn vẫn giữ lại các tài
          liệu đã chọn.
        </p>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => setClearOpen(false)}
          >
            Giữ lại
          </button>
          <button
            className="button danger"
            onClick={() => {
              studyActions.clearHistory();
              setClearOpen(false);
            }}
          >
            Xóa lịch sử
          </button>
        </div>
      </Dialog>
    </div>
  );
}
export function SettingsPage() {
  const [action, setAction] = useState<"empty" | "reset" | null>(null);
  const [message, setMessage] = useState("");
  return (
    <div className="flow-page">
      <PageHeader
        title="Cài đặt"
        description="Thông tin về cách lưu tiến độ và kết quả học tập."
      />
      <div className="settings-panel">
        <h2>Phiên học của bạn</h2>
        <p>
          Tài liệu được lưu trong tài khoản Supabase. Tiến độ và kết quả bài mẫu
          được lưu trong phiên trình duyệt. Tải lại trang không làm mất bài;
          đóng phiên trình duyệt có thể xóa dữ liệu. Nếu trình duyệt chặn lưu
          trữ, dữ liệu chỉ được giữ trong bộ nhớ khi ứng dụng còn mở.
        </p>
        {process.env.NODE_ENV === "development" && (
          <details className="dev-tools">
            <summary>Công cụ phát triển</summary>
            <p>Thử trạng thái trống hoặc khôi phục dữ liệu kiểm thử.</p>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => setAction("empty")}
              >
                Thử trạng thái trống
              </button>
              <button
                className="button primary"
                onClick={() => setAction("reset")}
              >
                Khôi phục dữ liệu mẫu
              </button>
            </div>
            {message && (
              <p role="status" className="success-note">
                {message}
              </p>
            )}
          </details>
        )}
      </div>
      <Dialog
        open={!!action}
        title={
          action === "empty"
            ? "Xóa dữ liệu trải nghiệm?"
            : "Khôi phục dữ liệu mẫu?"
        }
        onClose={() => setAction(null)}
      >
        <p>
          Bài mẫu đang làm và lịch sử bài mẫu trong phiên sẽ được thay thế. Tài
          liệu đã tải lên trong tài khoản được giữ nguyên.
        </p>
        <div className="button-row">
          <button className="button secondary" onClick={() => setAction(null)}>
            Hủy
          </button>
          <button
            className="button primary"
            onClick={() => {
              if (action === "empty") studyActions.clearDemo();
              else studyActions.resetDemo();
              setMessage(
                action === "empty"
                  ? "Đã chuyển về trạng thái trống."
                  : "Đã khôi phục dữ liệu mẫu.",
              );
              setAction(null);
            }}
          >
            Xác nhận
          </button>
        </div>
      </Dialog>
    </div>
  );
}
