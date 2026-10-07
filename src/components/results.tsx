"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowCounterClockwise,
  ArrowRight,
  Check,
  CheckCircle,
  Clock,
  X,
} from "@phosphor-icons/react/ssr";
import { originLabels } from "@/lib/mock-data";
import { formatDuration, scoreAttempt, wrongQuestions } from "@/lib/quiz-logic";
import { studyActions, useStudy } from "@/lib/study-store";
import type { Attempt, Question } from "@/lib/types";
import { EmptyState, PageHeader } from "./ui";

export function ResultSummary() {
  const { result } = useStudy();
  const router = useRouter();
  if (!result)
    return (
      <EmptyState
        title="Chưa có bài được nộp"
        description="Nộp bài để xem điểm và lời giải."
        action={
          <Link href="/history" className="button secondary">
            Xem lịch sử
          </Link>
        }
      />
    );
  const score = scoreAttempt(result);
  function retry(onlyWrong: boolean) {
    if (studyActions.retry(onlyWrong)) router.push("/quiz");
  }
  return (
    <div className="result-page">
      <div className="result-intro">
        <span className="completion-icon">
          <CheckCircle size={33} weight="light" />
        </span>
        <h1>Hoàn thành!</h1>
        <p>Một lần luyện tập, thêm một lần hiểu rõ.</p>
      </div>
      <div className="result-panel">
        <div className="score-block">
          <div
            className="score-ring"
            role="img"
            aria-label={`${score.percent}% câu trả lời đúng`}
            style={{
              background: `conic-gradient(var(--primary) ${score.percent}%, var(--primary-soft) 0)`,
            }}
          >
            <div>
              <strong>
                {score.correct}
                <span> / {score.total}</span>
              </strong>
              <small>câu đúng</small>
            </div>
          </div>
          <div className="score-description">
            <span className="subject-label">
              {result.retry ? "ÔN LẠI CÂU SAI" : "VẬT LÍ 12"}
            </span>
            <h2>{result.title}</h2>
            <strong>{score.percent}%</strong>
            <p>
              {score.percent >= 80
                ? "Bạn đã nắm khá vững nội dung. Cùng nhìn lại để ghi nhớ lâu hơn."
                : "Bạn đã có một khởi đầu tốt. Lời giải sẽ giúp những phần khó trở nên rõ ràng."}
            </p>
          </div>
        </div>
        <dl className="result-stats">
          <div>
            <dt>
              <Check size={18} />
              Câu đúng
            </dt>
            <dd>{score.correct}</dd>
          </div>
          <div>
            <dt>
              <X size={18} />
              Câu sai
            </dt>
            <dd>{score.wrong}</dd>
          </div>
          <div>
            <dt>Bỏ trống</dt>
            <dd>{score.skipped}</dd>
          </div>
          <div>
            <dt>
              <Clock size={18} />
              Thời gian
            </dt>
            <dd>{formatDuration(result.duration)}</dd>
          </div>
        </dl>
      </div>
      <div className="result-actions">
        <Link href="/review" className="button primary">
          Xem đáp án <ArrowRight size={18} />
        </Link>
        <button
          className="button secondary"
          disabled={!score.wrong}
          onClick={() => retry(true)}
        >
          <ArrowCounterClockwise size={18} />
          Làm lại {score.wrong ? `${score.wrong} câu sai` : "câu sai"}
        </button>
      </div>
      <div className="result-secondary-actions">
        <button className="text-link" onClick={() => retry(false)}>
          Làm lại toàn bộ
        </button>
        <Link href="/" className="text-link">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
export function AnswerReviewCard({
  question,
  index,
  attempt,
}: {
  question: Question;
  index: number;
  attempt: Attempt;
}) {
  const selectedId = attempt.answers[question.id];
  const correct = selectedId === question.correctId;
  const skipped = !selectedId;
  return (
    <article
      className={`review-card ${correct ? "correct" : skipped ? "skipped" : "incorrect"}`}
    >
      <div className="review-card-top">
        <span>Câu {index + 1}</span>
        <span
          className={`status-label ${correct ? "success" : skipped ? "neutral" : "error"}`}
        >
          {correct ? <Check size={15} /> : skipped ? null : <X size={15} />}
          {correct ? "Trả lời đúng" : skipped ? "Bỏ trống" : "Cần ôn lại"}
        </span>
      </div>
      <h2>{question.prompt}</h2>
      <div className="review-answers">
        <div>
          <span>Bạn chọn</span>
          <p className={!correct ? "chosen-wrong" : ""}>
            {question.choices.find((choice) => choice.id === selectedId)
              ?.text ?? "Chưa chọn đáp án"}
          </p>
        </div>
        {!correct && (
          <div>
            <span>Đáp án đúng</span>
            <p className="correct-answer">
              {
                question.choices.find(
                  (choice) => choice.id === question.correctId,
                )?.text
              }
            </p>
          </div>
        )}
      </div>
      <section className="explanation">
        <h3>Giải thích</h3>
        <p>{question.explanation}</p>
      </section>
      <footer className="review-source">
        <span>
          {attempt.documentName}
          {question.page !== null && (
            <>
              <i /> Trang {question.page}
            </>
          )}
        </span>
        <span className="source-badge">{originLabels[question.origin]}</span>
      </footer>
    </article>
  );
}
export function AnswerReview() {
  const { result } = useStudy();
  const [filter, setFilter] = useState<"all" | "correct" | "wrong">("all");
  const router = useRouter();
  if (!result)
    return (
      <EmptyState
        title="Chưa có đáp án để xem"
        description="Nộp bài trắc nghiệm hoặc chọn kết quả trong lịch sử."
        action={
          <Link href="/history" className="button secondary">
            Xem lịch sử
          </Link>
        }
      />
    );
  const score = scoreAttempt(result);
  const filtered = result.questions.filter(
    (question) =>
      filter === "all" ||
      (filter === "correct"
        ? result.answers[question.id] === question.correctId
        : result.answers[question.id] !== question.correctId),
  );
  const wrongCount = wrongQuestions(result).length;
  return (
    <div className="review-page">
      <PageHeader
        title="Hiểu rõ từng đáp án"
        description="Dành thêm một chút thời gian cho những câu bạn chưa chắc chắn."
        back="/result"
        action={
          <button
            className="button primary"
            disabled={!wrongCount}
            onClick={() => {
              if (studyActions.retry(true)) router.push("/quiz");
            }}
          >
            Làm lại {wrongCount} câu sai <ArrowRight size={18} />
          </button>
        }
      />
      <div className="review-toolbar">
        <div className="filter-tabs" role="group" aria-label="Lọc đáp án">
          {(
            [
              { id: "all", label: "Tất cả", count: score.total },
              { id: "correct", label: "Đúng", count: score.correct },
              {
                id: "wrong",
                label: "Sai / bỏ trống",
                count: score.wrong + score.skipped,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-pressed={filter === item.id}
              className={filter === item.id ? "selected" : ""}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>
        <span className="muted">{score.percent}% chính xác</span>
      </div>
      {filtered.length ? (
        <div className="review-list">
          {filtered.map((question) => (
            <AnswerReviewCard
              key={question.id}
              question={question}
              index={result.questions.findIndex(
                (item) => item.id === question.id,
              )}
              attempt={result}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            filter === "correct"
              ? "Chưa có câu trả lời đúng"
              : "Không có câu cần xem lại"
          }
          description={
            filter === "correct"
              ? "Đọc lời giải rồi thử lại nhé. Bạn có thể làm tốt hơn ở lần tiếp theo."
              : "Bạn đã trả lời đúng toàn bộ bài. Có thể thử một bài mới để tiếp tục luyện tập."
          }
        />
      )}
      <Link href="/result" className="back-link">
        ← Quay lại kết quả
      </Link>
    </div>
  );
}
