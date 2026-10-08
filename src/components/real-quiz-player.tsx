"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  PaperPlaneTilt,
} from "@phosphor-icons/react/ssr";
import { QuestionCard } from "./question-card";
import { Dialog, ProgressBar } from "./ui";
import { formatDuration } from "@/lib/quiz-logic";
import type { QuizView } from "@/lib/quizzes/types";
export function RealQuizPlayer({ quiz }: { quiz: QuizView }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(quiz.answers);
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("Đã lưu");
  const [elapsed, setElapsed] = useState(0);
  const queue = useRef(Promise.resolve());
  const inFlight = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    const tick = () =>
      setElapsed(
        Math.max(
          0,
          Math.floor((Date.now() - Date.parse(quiz.startedAt)) / 1000),
        ),
      );
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [quiz.startedAt]);
  function select(choice: string) {
    if (inFlight.current) return;
    const updated = { ...answers, [quiz.questions[current].id]: choice };
    setAnswers(updated);
    setSaveState("Đang lưu…");
    setError("");
    const savedRevision = ++revision.current;
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          const r = await fetch(`/api/attempts/${quiz.attemptId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers: updated }),
            keepalive: true,
          });
          if (!r.ok)
            throw new Error(
              "Chưa lưu được đáp án. Chọn lại để thử hoặc nộp bài khi kết nối ổn định.",
            );
          if (savedRevision === revision.current) setSaveState("Đã lưu");
        } catch (e) {
          if (savedRevision === revision.current) {
            setSaveState("Chưa lưu");
            setError(e instanceof Error ? e.message : "Chưa lưu được.");
          }
        }
      });
  }
  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await queue.current;
      const r = await fetch(`/api/attempts/${quiz.attemptId}?action=submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      router.replace(`/result?attemptId=${quiz.attemptId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa nộp được bài.");
      inFlight.current = false;
      setBusy(false);
    }
  }
  const answered = Object.keys(answers).length;
  const total = quiz.questions.length;
  const last = current === total - 1;
  return (
    <div className="quiz-layout">
      <header className="quiz-header">
        <Link className="exit-button" href="/history">
          <ArrowLeft size={20} />
          Thoát
        </Link>
        <div className="quiz-title">
          <strong>{quiz.title}</strong>
          <span>{quiz.retry ? "Ôn tập lại" : quiz.documentName}</span>
        </div>
        <span className="quiz-time">
          <Clock size={18} />
          {formatDuration(elapsed)}
        </span>
      </header>
      <div className="quiz-content">
        <div className="quiz-progress-label">
          <span>
            Câu {current + 1} / {total}
          </span>
          <span>
            {answered}/{total} đã trả lời ·{" "}
            <span role="status">{saveState}</span>
          </span>
        </div>
        <ProgressBar
          value={(answered / total) * 100}
          label="Số câu đã trả lời"
        />
        {error && (
          <p role="alert" className="error-note">
            {error}
          </p>
        )}
        <QuestionCard
          question={quiz.questions[current]}
          index={current}
          selected={answers[quiz.questions[current].id]}
          onSelect={select}
        />
        <div className="quiz-controls">
          <button
            className="button secondary"
            disabled={!current || busy}
            onClick={() => setCurrent(current - 1)}
          >
            <ArrowLeft size={18} />
            Câu trước
          </button>
          <span>
            {current + 1} / {total}
          </span>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => (last ? setOpen(true) : setCurrent(current + 1))}
          >
            {last ? "Nộp bài" : "Câu tiếp"}
            <ArrowRight size={18} />
          </button>
        </div>
        <section className="navigator-section">
          <h2>Các câu trong bài</h2>
          <nav className="question-navigator" aria-label="Chuyển đến câu hỏi">
            {quiz.questions.map((q, i) => (
              <button
                key={q.id}
                disabled={busy}
                aria-current={current === i ? "step" : undefined}
                aria-label={`Câu ${i + 1}${answers[q.id] ? ", đã trả lời" : ", chưa trả lời"}`}
                className={
                  current === i ? "current" : answers[q.id] ? "answered" : ""
                }
                onClick={() => setCurrent(i)}
              >
                {i + 1}
              </button>
            ))}
          </nav>
        </section>
        {!last && (
          <button
            className="button secondary submit-link"
            disabled={busy}
            onClick={() => setOpen(true)}
          >
            Nộp bài
            <PaperPlaneTilt size={17} />
          </button>
        )}
      </div>
      <Dialog
        open={open}
        title="Nộp bài trắc nghiệm?"
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <p>
          Bạn đã trả lời {answered}/{total} câu. Còn {total - answered} câu bỏ
          trống. Sau khi nộp, bạn có thể xem lời giải.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="button-row">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Tiếp tục làm
          </button>
          <button className="button primary" disabled={busy} onClick={submit}>
            {busy ? "Đang nộp…" : "Nộp bài"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
