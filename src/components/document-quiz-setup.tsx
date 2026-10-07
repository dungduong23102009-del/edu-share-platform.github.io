"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { studyActions } from "@/lib/study-store";
import { shuffle } from "@/lib/quiz-logic";
import type { Question } from "@/lib/types";
import { PageHeader } from "./ui";
export function DocumentQuizSetup({
  documentId,
  title,
  documentName,
  questions,
}: {
  documentId: string;
  title: string;
  documentName: string;
  questions: Question[];
}) {
  const router = useRouter();
  const [count, setCount] = useState<number | "all">(10);
  const [random, setRandom] = useState(false);
  const total =
    count === "all" ? questions.length : Math.min(count, questions.length);
  return (
    <div className="flow-page">
      <PageHeader
        title="Tạo bài trắc nghiệm"
        description={`${documentName} · ${questions.length} câu đã qua kiểm tra`}
      />
      <div className="setup-panel">
        <section className="setup-section">
          <h2>Số câu hỏi</h2>
          <div className="segmented" role="group" aria-label="Số câu hỏi">
            {([10, 20, 30, 50, "all"] as const).map((value) => (
              <button
                key={value}
                className={count === value ? "selected" : ""}
                aria-pressed={count === value}
                onClick={() => setCount(value)}
              >
                {value === "all" ? "Tất cả" : value}
              </button>
            ))}
          </div>
        </section>
        <section className="setup-section">
          <label className="check-row">
            <input
              type="checkbox"
              checked={random}
              onChange={(event) => setRandom(event.target.checked)}
            />
            Trộn câu hỏi
          </label>
        </section>
      </div>
      {!questions.length && (
        <p className="source-note">
          Chưa có câu đủ điều kiện. Hãy kiểm tra nguồn hoặc tạo đáp án cho câu
          còn thiếu.
        </p>
      )}
      <p className="small-note">
        Đáp án nguồn được giữ nguyên. Câu chưa chắc chắn hoặc chưa qua kiểm tra
        không được đưa vào bài.
      </p>
      <div className="button-row">
        <Link
          href={`/topics?documentId=${documentId}`}
          className="button secondary"
        >
          Chọn lại chủ đề
        </Link>
        <button
          className="button primary"
          disabled={!total}
          onClick={() => {
            const chosen = (random ? shuffle(questions) : questions).slice(
              0,
              total,
            );
            if (
              studyActions.startPreparedQuiz({
                title,
                documentName,
                questions: chosen,
              })
            )
              router.push("/quiz");
          }}
        >
          Bắt đầu {total} câu
        </button>
      </div>
    </div>
  );
}
