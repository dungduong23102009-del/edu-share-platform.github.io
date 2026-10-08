"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowCounterClockwise,
  ArrowRight,
  CheckCircle,
} from "@phosphor-icons/react/ssr";
import type { QuizResult, QuizHistory } from "@/lib/quizzes/types";
import { formatDuration } from "@/lib/quiz-logic";
import { EmptyState, PageHeader } from "./ui";
function RetryButtons({ result }: { result: QuizResult }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ids] = useState(() => ({
    wrong: crypto.randomUUID(),
    all: crypto.randomUUID(),
  }));
  async function retry(mode: "wrong" | "all") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/attempts/${result.attemptId}?action=retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: ids[mode], mode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      router.push(`/quiz?attemptId=${data.attemptId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thể làm lại.");
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="button secondary"
        disabled={busy || result.incorrect + result.unanswered === 0}
        onClick={() => retry("wrong")}
      >
        <ArrowCounterClockwise size={18} />
        Làm lại câu sai{result.unanswered > 0 ? " / bỏ trống" : ""}
      </button>
      <button
        className="text-link"
        disabled={busy}
        onClick={() => retry("all")}
      >
        Làm lại toàn bộ
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function RealQuizResult({ result }: { result: QuizResult }) {
  const duration = Math.max(
    0,
    Math.floor(
      (Date.parse(result.completedAt) - Date.parse(result.startedAt)) / 1000,
    ),
  );
  return (
    <div className="result-page">
      <div className="result-intro">
        <span className="completion-icon">
          <CheckCircle size={33} />
        </span>
        <h1>Hoàn thành!</h1>
        <p>Một lần luyện tập, thêm một lần hiểu rõ.</p>
      </div>
      <div className="result-panel">
        <div className="score-block">
          <div
            className="score-ring"
            role="img"
            aria-label={`${result.percent}% câu trả lời đúng`}
            style={{
              background: `conic-gradient(var(--primary) ${result.percent}%, var(--primary-soft) 0)`,
            }}
          >
            <div>
              <strong>
                {result.correct}
                <span> / {result.total}</span>
              </strong>
              <small>câu đúng</small>
            </div>
          </div>
          <div className="score-description">
            <span className="subject-label">
              {result.retry ? "Ôn tập lại" : result.documentName}
            </span>
            <h2>{result.title}</h2>
            <strong>{result.percent}%</strong>
            <p>Cùng xem lời giải và ôn lại những câu chưa chắc chắn.</p>
          </div>
        </div>
        <dl className="result-stats">
          <div>
            <dt>Câu đúng</dt>
            <dd>{result.correct}</dd>
          </div>
          <div>
            <dt>Câu sai</dt>
            <dd>{result.incorrect}</dd>
          </div>
          <div>
            <dt>Bỏ trống</dt>
            <dd>{result.unanswered}</dd>
          </div>
          <div>
            <dt>Thời gian</dt>
            <dd>{formatDuration(duration)}</dd>
          </div>
        </dl>
      </div>
      <div className="result-actions">
        <Link
          href={`/review?attemptId=${result.attemptId}`}
          className="button primary"
        >
          Xem đáp án
          <ArrowRight size={18} />
        </Link>
        <RetryButtons result={result} />
      </div>
      <div className="result-secondary-actions">
        <Link href="/history" className="text-link">
          Xem lịch sử
        </Link>
        <Link href="/dashboard" className="text-link">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
export function RealAnswerReview({ result }: { result: QuizResult }) {
  const [filter, setFilter] = useState<"all" | "correct" | "wrong">("all");
  return (
    <div className="review-page">
      <PageHeader
        title="Hiểu rõ từng đáp án"
        description={result.title}
        back={`/result?attemptId=${result.attemptId}`}
      />
      <div className="review-toolbar">
        <div className="filter-tabs" role="group" aria-label="Lọc đáp án">
          {(
            [
              { id: "all", label: "Tất cả" },
              { id: "correct", label: "Đúng" },
              { id: "wrong", label: "Sai / bỏ trống" },
            ] as const
          ).map((x) => (
            <button
              key={x.id}
              aria-pressed={filter === x.id}
              className={filter === x.id ? "selected" : ""}
              onClick={() => setFilter(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="review-list">
        {result.questions.map((q, i) => {
          const selected = result.answers[q.id];
          const correct = selected === q.correctId;
          if (
            (filter === "correct" && !correct) ||
            (filter === "wrong" && correct)
          )
            return null;
          return (
            <article
              key={q.id}
              className={`review-card ${correct ? "correct" : selected ? "incorrect" : "skipped"}`}
            >
              <div className="review-card-top">
                <span>Câu {i + 1}</span>
                <span
                  className={`status-label ${correct ? "success" : "error"}`}
                >
                  {correct
                    ? "Trả lời đúng"
                    : selected
                      ? "Cần ôn lại"
                      : "Bỏ trống"}
                </span>
              </div>
              <h2>{q.prompt}</h2>
              <div className="review-answers">
                <div>
                  <span>Bạn chọn</span>
                  <p>
                    {q.choices.find((c) => c.id === selected)?.text ||
                      "Chưa chọn đáp án"}
                  </p>
                </div>
                <div>
                  <span>Đáp án đúng</span>
                  <p className="correct-answer">
                    {q.correctId}.{" "}
                    {q.choices.find((c) => c.id === q.correctId)?.text}
                  </p>
                </div>
              </div>
              <section className="explanation">
                <h3>Giải thích</h3>
                <p>{q.explanation}</p>
              </section>
              <footer className="review-source">
                <span>
                  {q.topicTitle || result.documentName}
                  {q.page !== null ? ` · Trang ${q.page}` : ""}
                </span>
                <span className="source-badge">
                  {q.origin === "source" ? "Từ tài liệu" : "AI suy luận"}
                </span>
              </footer>
            </article>
          );
        })}
      </div>
      <div className="button-row">
        <RetryButtons result={result} />
        <Link
          href={`/result?attemptId=${result.attemptId}`}
          className="back-link"
        >
          ← Quay lại kết quả
        </Link>
      </div>
    </div>
  );
}
export function RealHistory({ attempts }: { attempts: QuizHistory[] }) {
  return (
    <div className="flow-page">
      <PageHeader
        title="Lịch sử luyện tập"
        description="Bài làm và kết quả được lưu trong tài khoản của bạn."
      />
      {!attempts.length ? (
        <EmptyState
          title="Chưa có bài luyện tập"
          description="Tạo bài trắc nghiệm từ tài liệu để bắt đầu."
          action={
            <Link className="button primary" href="/create">
              Tạo bài trắc nghiệm
            </Link>
          }
        />
      ) : (
        <div className="review-list">
          {attempts.map((a) => (
            <Link
              key={a.attemptId}
              className="review-card"
              href={`${a.completedAt ? "/result" : "/quiz"}?attemptId=${a.attemptId}`}
            >
              <h2>{a.title}</h2>
              <p>{a.documentName}</p>
              <p>
                {new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Asia/Ho_Chi_Minh",
                }).format(new Date(a.startedAt))}{" "}
                · {a.total} câu
              </p>
              <strong>
                {a.completedAt
                  ? `${a.correct}/${a.total} đúng · ${a.percent}%`
                  : "Đang làm · Tiếp tục"}
              </strong>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
