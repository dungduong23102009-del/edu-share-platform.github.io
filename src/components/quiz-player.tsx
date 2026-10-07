"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  PaperPlaneTilt,
} from "@phosphor-icons/react/ssr";
import { studyActions, useStudy } from "@/lib/study-store";
import { formatDuration } from "@/lib/quiz-logic";
import type { Question, QuizSession } from "@/lib/types";
import { Dialog, EmptyState, ProgressBar } from "./ui";

export function AnswerOption({
  letter,
  text,
  selected,
  tabbable,
  onSelect,
}: {
  letter: string;
  text: string;
  selected: boolean;
  tabbable: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      tabIndex={tabbable ? 0 : -1}
      className={`answer-option ${selected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <span className="answer-letter">{letter}</span>
      <span>{text}</span>
      <span className="answer-selected" aria-hidden="true">
        {selected && <Check size={17} weight="bold" />}
      </span>
    </button>
  );
}
export function QuestionCard({
  question,
  index,
  selected,
  onSelect,
}: {
  question: Question;
  index: number;
  selected?: string;
  onSelect: (choice: string) => void;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const direction = ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1;
    const next =
      (Math.max(0, current) + direction + buttons.length) % buttons.length;
    buttons[next].focus();
    onSelect(question.choices[next].id);
  }
  return (
    <section className="question-card">
      <span className="question-kicker">Câu {index + 1}</span>
      <h1 id="question-title">{question.prompt}</h1>
      <div
        className="answer-list"
        role="radiogroup"
        aria-labelledby="question-title"
        onKeyDown={onKeyDown}
      >
        {question.choices.map((choice, choiceIndex) => (
          <AnswerOption
            key={choice.id}
            letter={String.fromCharCode(65 + choiceIndex)}
            text={choice.text}
            selected={selected === choice.id}
            tabbable={
              selected === choice.id || (!selected && choiceIndex === 0)
            }
            onSelect={() => onSelect(choice.id)}
          />
        ))}
      </div>
      <p className="answer-help">
        Chọn một đáp án. Bạn có thể thay đổi trước khi nộp bài.
      </p>
    </section>
  );
}
export function QuestionNavigator({ session }: { session: QuizSession }) {
  return (
    <nav className="question-navigator" aria-label="Chuyển đến câu hỏi">
      {session.questions.map((question, index) => (
        <button
          key={question.id}
          className={
            session.current === index
              ? "current"
              : session.answers[question.id]
                ? "answered"
                : ""
          }
          aria-label={`Câu ${index + 1}${session.answers[question.id] ? ", đã trả lời" : ", chưa trả lời"}`}
          aria-current={session.current === index ? "step" : undefined}
          onClick={() => studyActions.goToQuestion(index)}
        >
          {index + 1}
        </button>
      ))}
    </nav>
  );
}
export function QuizPlayer() {
  const { active } = useStudy();
  const router = useRouter();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    studyActions.resume();
  }, []);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  if (!active)
    return (
      <div className="quiz-empty">
        <EmptyState
          title="Sẵn sàng cho một bài mới?"
          description="Chọn tài liệu, nội dung và số câu hỏi để bắt đầu."
          action={
            <Link href="/create" className="button primary">
              Tạo bài trắc nghiệm
            </Link>
          }
        />
      </div>
    );
  const question = active.questions[active.current];
  const answered = active.questions.filter(
    (item) => active.answers[item.id],
  ).length;
  const skipped = active.questions.length - answered;
  const elapsed =
    active.elapsedBefore +
    (active.startedAt && now
      ? Math.max(0, Math.floor((now - active.startedAt) / 1000))
      : 0);
  const isLast = active.current === active.questions.length - 1;
  return (
    <div className="quiz-layout">
      <header className="quiz-header">
        <button className="exit-button" onClick={() => setExitOpen(true)}>
          <ArrowLeft size={20} />
          Thoát
        </button>
        <div className="quiz-title">
          <strong>{active.title}</strong>
          <span>{active.retry ? "Ôn lại câu sai" : "Vật lí 12"}</span>
        </div>
        <span className="quiz-time">
          <Clock size={18} />
          {formatDuration(elapsed)}
        </span>
      </header>
      <div className="quiz-content">
        <div className="quiz-progress-label">
          <span>
            Câu <strong>{active.current + 1}</strong> /{" "}
            {active.questions.length}
          </span>
          <span>{answered} câu đã trả lời</span>
        </div>
        <ProgressBar
          value={(answered / active.questions.length) * 100}
          label="Số câu đã trả lời"
        />
        <QuestionCard
          question={question}
          index={active.current}
          selected={active.answers[question.id]}
          onSelect={(choice) => studyActions.answer(question.id, choice)}
        />
        <div className="quiz-controls">
          <button
            className="button secondary"
            disabled={active.current === 0}
            onClick={() => studyActions.goToQuestion(active.current - 1)}
          >
            <ArrowLeft size={18} />
            Câu trước
          </button>
          <span>
            {active.current + 1} / {active.questions.length}
          </span>
          {isLast ? (
            <button
              className="button primary"
              onClick={() => setSubmitOpen(true)}
            >
              Nộp bài <PaperPlaneTilt size={18} />
            </button>
          ) : (
            <button
              className="button primary"
              onClick={() => studyActions.goToQuestion(active.current + 1)}
            >
              Câu tiếp <ArrowRight size={18} />
            </button>
          )}
        </div>
        <section className="navigator-section">
          <div>
            <h2>Các câu trong bài</h2>
            <span>
              <i /> Đã trả lời
            </span>
          </div>
          <QuestionNavigator session={active} />
        </section>
        {!isLast && (
          <button
            className="button secondary submit-link"
            onClick={() => setSubmitOpen(true)}
          >
            Nộp bài <PaperPlaneTilt size={17} />
          </button>
        )}
      </div>
      <Dialog
        open={submitOpen}
        title="Nộp bài trắc nghiệm?"
        onClose={() => setSubmitOpen(false)}
      >
        <p>
          Bạn đã trả lời{" "}
          <strong>
            {answered}/{active.questions.length}
          </strong>{" "}
          câu.
          {skipped > 0
            ? ` Còn ${skipped} câu bỏ trống, sẽ không được tính điểm.`
            : " Tất cả câu hỏi đã có đáp án."}
        </p>
        <p>Sau khi nộp, bạn có thể xem lời giải và ôn lại câu sai.</p>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => setSubmitOpen(false)}
          >
            Tiếp tục làm
          </button>
          <button
            className="button primary"
            onClick={() => {
              studyActions.submit();
              setSubmitOpen(false);
              router.push("/result");
            }}
          >
            Nộp bài
          </button>
        </div>
      </Dialog>
      <Dialog
        open={exitOpen}
        title="Tạm dừng bài học?"
        onClose={() => setExitOpen(false)}
      >
        <p>
          Đáp án đã chọn được giữ trong phiên trình duyệt này. Bạn có thể tiếp
          tục từ trang chủ.
        </p>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => setExitOpen(false)}
          >
            Ở lại
          </button>
          <button
            className="button primary"
            onClick={() => {
              studyActions.pause();
              router.push("/");
            }}
          >
            Lưu và thoát
          </button>
        </div>
      </Dialog>
    </div>
  );
}
