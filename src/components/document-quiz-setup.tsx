"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "./ui";
export function DocumentQuizSetup({
  documentId,
  documentName,
  available,
  topicIds,
}: {
  documentId: string;
  documentName: string;
  available: number;
  topicIds: string[];
}) {
  const router = useRouter();
  const [count, setCount] = useState<number | "all">(10);
  const [random, setRandom] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const total = count === "all" ? available : Math.min(count, available);
  return (
    <div className="flow-page">
      <PageHeader
        title="Tạo bài trắc nghiệm"
        description={`${documentName} · ${available} câu đã qua kiểm tra`}
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
      {!available && (
        <p className="source-note">
          Chưa có câu đủ điều kiện. Hãy kiểm tra nguồn hoặc tạo đáp án cho câu
          còn thiếu.
        </p>
      )}
      <p className="small-note">
        Đáp án nguồn được giữ nguyên. Câu chưa chắc chắn hoặc chưa qua kiểm tra
        không được đưa vào bài.
      </p>
      {count !== "all" && count > available && (
        <p className="source-note">
          Có {available} câu đủ điều kiện; bài sẽ dùng tối đa {total} câu.
        </p>
      )}
      {error && (
        <p role="alert" className="error-note">
          {error}
        </p>
      )}
      <div className="button-row">
        <Link
          href={`/topics?documentId=${documentId}`}
          className="button secondary"
        >
          Chọn lại chủ đề
        </Link>
        <button
          className="button primary"
          disabled={!total || pending}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              const response = await fetch("/api/quizzes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: requestId,
                  documentId,
                  topicIds,
                  count,
                  random,
                }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              router.push(`/quiz?attemptId=${data.attemptId}`);
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Chưa thể tạo bài.",
              );
              setPending(false);
            }
          }}
        >
          {pending ? "Đang tạo bài…" : `Bắt đầu ${total} câu`}
        </button>
      </div>
    </div>
  );
}
