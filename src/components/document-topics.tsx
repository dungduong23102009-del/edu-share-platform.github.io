"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "@phosphor-icons/react/ssr";
import type { AnalysisView } from "@/lib/documents/load-analysis";
import { PageHeader } from "./ui";
const types = {
  theory: "Lý thuyết",
  question_answer: "Câu hỏi và đáp án",
  mixed: "Lý thuyết và câu hỏi",
};
const questionTypes: Record<string, string> = {
  multiple_choice: "Trắc nghiệm",
  short_answer: "Trả lời ngắn",
  calculation: "Bài tính",
  true_false: "Đúng / sai",
  theory: "Lý thuyết",
  unknown: "Chưa xác định",
};
export function DocumentTopics({ view }: { view: AnalysisView }) {
  const { analysis, document, topics, solutions, sourceQuestions, solverJob } =
    view;
  const router = useRouter();
  const [selected, setSelected] = useState(topics.map((topic) => topic.title));
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [solving, setSolving] = useState(false);
  const [page, setPage] = useState(0);
  const processing = solving || solverJob?.status === "processing";
  useEffect(() => {
    if (!processing) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(`/api/documents/${document.id}/analysis`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.assign(
            new URL("/login", window.location.origin).href,
          );
          return;
        }
        if (!response.ok) throw new Error("Progress unavailable");
        const result = (await response.json()) as AnalysisView;
        if (cancelled) return;
        if (result.solverJob?.status !== "processing") {
          setSolving(false);
          router.refresh();
          return;
        }
      } catch {
        if (cancelled) return;
        setError(
          "Chưa thể đọc tiến độ tạo đáp án. Kết quả đọc tài liệu vẫn được giữ.",
        );
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [document.id, processing, router]);
  if (!analysis || document.status !== "ready")
    return (
      <div className="flow-page">
        <PageHeader
          title={document.original_filename}
          description="Tài liệu chưa có kết quả phân tích mới."
        />
        <Link
          href={`/processing?documentId=${document.id}&start=1`}
          className="button primary"
        >
          Xem tiến độ phân tích
        </Link>
      </div>
    );
  async function submit(kind: "analyze" | "solve") {
    if (pending || processing) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${document.id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "analyze" ? { reprocess: true } : {}),
      });
      if (response.status === 401) {
        window.location.assign(new URL("/login", window.location.origin).href);
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Chưa thể xử lý yêu cầu.");
        return;
      }
      if (kind === "analyze")
        router.push(`/processing?documentId=${document.id}`);
      else if (result.status === "processing") setSolving(true);
      else router.refresh();
    } catch {
      setError(
        "Chưa thể kết nối dịch vụ AI. Kết quả đọc tài liệu vẫn được giữ.",
      );
    } finally {
      setPending(false);
    }
  }
  const topicTitle = (questionId: string) => {
    const source = sourceQuestions.find((item) => item.id === questionId);
    return topics.find((topic) => topic.id === source?.topic_id)?.title || null;
  };
  const questions = solutions.filter((item) => {
    const title = topicTitle(item.question_id);
    return title === null || selected.includes(title);
  });
  const theory = analysis.theoryPoints.filter(
    (item) => item.topicTitle === null || selected.includes(item.topicTitle),
  );
  const ready = questions.filter((item) => item.quiz_ready).length;
  const needsAI = solutions.filter(
    (item) =>
      item.ai_model === null &&
      item.answer_origin === "none" &&
      ["pending", "solver_failed"].includes(item.solver_status),
  ).length;
  const parsing = solutions.filter(
    (item) =>
      !item.quiz_ready &&
      (item.needs_review || item.solver_status === "uncertain"),
  ).length;
  const unsupported = solutions.filter(
    (item) => item.solver_status === "unsupported",
  ).length;
  const caution = solutions.filter((item) =>
    ["uncertain", "invalid"].includes(item.solver_status),
  ).length;
  const pageCount = Math.max(1, Math.ceil(questions.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  return (
    <div className="flow-page analysis-review">
      <PageHeader
        title={analysis.documentTitle || document.original_filename}
        description={`${document.original_filename} · ${types[analysis.documentType]}`}
      />
      <p>{analysis.summary}</p>
      <p className="success-note" role="status">
        Đã tìm thấy {topics.length} chủ đề · {solutions.length} câu hỏi có sẵn ·{" "}
        {analysis.theoryPoints.length} ý kiến thức.
      </p>
      <p className="small-note">
        {solutions.filter((item) => item.quiz_ready).length} sẵn sàng ·{" "}
        {
          solutions.filter(
            (item) =>
              item.answer_origin === "ai_derived" &&
              item.solver_status === "solved",
          ).length
        }{" "}
        câu được AI giải · {needsAI} cần AI giải · {parsing} cần kiểm tra nguồn
        · {unsupported} không hỗ trợ
        {caution ? ` · ${caution} chưa đủ chắc chắn` : ""}
      </p>
      {!!analysis.warnings.length && (
        <aside className="source-note" aria-label="Lưu ý khi đọc tài liệu">
          <ul>
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </aside>
      )}
      {(solverJob?.status === "failed" ||
        solutions.some((item) => item.solver_status === "solver_failed")) && (
        <p className="source-note" role="status">
          Chưa thể tạo đáp án cho một số câu hỏi. Kết quả đọc tài liệu vẫn được
          giữ; bạn có thể thử lại.
        </p>
      )}
      {processing ? (
        <p role="status">Đang tạo đáp án cho các câu hỏi còn thiếu…</p>
      ) : (
        needsAI > 0 && (
          <div>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => submit("solve")}
            >
              {pending ? "Đang bắt đầu…" : "Tạo đáp án cho câu còn thiếu"}
            </button>
            <p className="small-note">
              Chỉ câu cần giải và trích đoạn liên quan được gửi tới dịch vụ AI.
              Đáp án nguồn được giữ nguyên.
            </p>
          </div>
        )
      )}
      <section
        className="analysis-section"
        aria-labelledby="real-topic-heading"
      >
        <h2 id="real-topic-heading">
          Hệ thống tìm thấy {topics.length} chủ đề
        </h2>
        <p className="small-note">
          Chọn chủ đề để kiểm tra nội dung đã trích xuất.
        </p>
        <div className="topic-list">
          {topics.map((topic) => (
            <label
              className={`topic-card ${selected.includes(topic.title) ? "selected" : ""}`}
              key={topic.id}
            >
              <input
                type="checkbox"
                checked={selected.includes(topic.title)}
                onChange={(event) => {
                  setPage(0);
                  setSelected((value) =>
                    event.target.checked
                      ? [...value, topic.title]
                      : value.filter((title) => title !== topic.title),
                  );
                }}
              />
              <span className="custom-check" aria-hidden="true">
                {selected.includes(topic.title) && (
                  <Check size={14} weight="bold" />
                )}
              </span>
              <span className="topic-copy">
                <strong>{topic.title}</strong>
                <span>{topic.summary}</span>
                <small>
                  {
                    sourceQuestions.filter((item) => item.topic_id === topic.id)
                      .length
                  }{" "}
                  câu hỏi nguồn
                </small>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section
        className="analysis-section"
        aria-labelledby="source-question-heading"
      >
        <h2 id="source-question-heading">
          Câu hỏi có sẵn ({questions.length})
        </h2>
        {!questions.length ? (
          <p className="small-note">
            Không có câu hỏi nguồn trong các chủ đề đang chọn.
          </p>
        ) : (
          <details className="analysis-preview">
            <summary>Xem câu hỏi nguồn ({questions.length})</summary>
            {questions
              .slice(currentPage * 10, currentPage * 10 + 10)
              .map((item) => {
                const source = sourceQuestions.find(
                  (question) => question.id === item.question_id,
                );
                const choices = item.choices as string[];
                return (
                  <details className="analysis-item" key={item.question_id}>
                    <summary>{item.question_text}</summary>
                    {!!choices.length && (
                      <ul>
                        {choices.map((choice, index) => (
                          <li key={index}>
                            <strong>{String.fromCharCode(65 + index)}.</strong>{" "}
                            {choice}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p>
                      <strong>
                        {item.answer_origin === "source"
                          ? `Đáp án nguồn: ${item.correct_answer}`
                          : item.answer_origin === "ai_derived"
                            ? `Đáp án AI: ${item.correct_choice || item.correct_answer}`
                            : "Tài liệu không cung cấp đáp án."}
                      </strong>
                    </p>
                    {item.explanation && <p>{item.explanation}</p>}
                    <p className="small-note">
                      {source?.source_page
                        ? `Trang ${source.source_page} · `
                        : ""}
                      Dạng:{" "}
                      {questionTypes[item.original_type] || "Chưa xác định"} ·{" "}
                      {item.quiz_ready ? "Sẵn sàng" : "Chưa sẵn sàng"}
                      {item.ai_confidence !== null
                        ? ` · Độ tin cậy AI: ${Math.round(item.ai_confidence * 100)}%`
                        : source?.extraction_confidence !== null &&
                            source?.extraction_confidence !== undefined
                          ? ` · Độ tin cậy trích xuất: ${Math.round(source.extraction_confidence * 100)}%`
                          : ""}
                    </p>
                    {item.needs_review && (
                      <p className="source-note">
                        Cần thận trọng và đối chiếu tài liệu nguồn.
                      </p>
                    )}
                    {(item.parsing_warnings as string[]).map((warning) => (
                      <p className="source-note" key={warning}>
                        {warning}
                      </p>
                    ))}
                    {source?.source_excerpt && (
                      <blockquote>{source.source_excerpt}</blockquote>
                    )}
                    {source?.answer_source_excerpt && (
                      <p className="source-note">
                        Trích dẫn đáp án: {source.answer_source_excerpt}
                      </p>
                    )}
                    {item.raw_question_text !== item.question_text && (
                      <details>
                        <summary>Xem nội dung nguồn ban đầu</summary>
                        <p className="source-note">{item.raw_question_text}</p>
                      </details>
                    )}
                  </details>
                );
              })}
            {pageCount > 1 && (
              <div className="button-row">
                <button
                  className="button secondary"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Trang trước
                </button>
                <span>
                  {currentPage + 1} / {pageCount}
                </span>
                <button
                  className="button secondary"
                  disabled={currentPage + 1 === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Trang sau
                </button>
              </div>
            )}
          </details>
        )}
      </section>
      <section className="analysis-section" aria-labelledby="theory-heading">
        <h2 id="theory-heading">Ý kiến thức ({theory.length})</h2>
        {!theory.length ? (
          <p className="small-note">
            Không có ý kiến thức trong các chủ đề đang chọn.
          </p>
        ) : (
          <details className="analysis-preview">
            <summary>Xem ý kiến thức ({theory.length})</summary>
            {theory.map((item, index) => (
              <article className="analysis-item" key={index}>
                <p>{item.content}</p>
                {item.sourcePage && <small>Trang {item.sourcePage}</small>}
                {item.sourceExcerpt && (
                  <blockquote>{item.sourceExcerpt}</blockquote>
                )}
              </article>
            ))}
          </details>
        )}
      </section>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button
          className="button primary"
          disabled={!ready || !selected.length || processing}
          onClick={() =>
            router.push(
              `/setup?${new URLSearchParams({
                documentId: document.id,
                topics: topics
                  .filter((topic) => selected.includes(topic.title))
                  .map((topic) => topic.id)
                  .join(","),
              })}`,
            )
          }
        >
          Tạo bài trắc nghiệm
        </button>
        <Link className="button secondary" href="/documents">
          Về thư viện
        </Link>
      </div>
      <p className="small-note">
        {ready} câu hợp lệ trong các chủ đề đang chọn.
      </p>
      {confirm && (
        <p className="small-note">
          Phân tích lại sẽ đọc tài liệu một lần nữa. Kết quả cũ được giữ nếu lần
          mới thất bại.
        </p>
      )}
      {confirm ? (
        <div className="button-row">
          <button
            className="text-link"
            disabled={pending || processing}
            onClick={() => submit("analyze")}
          >
            Xác nhận phân tích lại
          </button>
          <button
            className="text-link"
            disabled={pending}
            onClick={() => setConfirm(false)}
          >
            Hủy
          </button>
        </div>
      ) : (
        <button
          className="text-link"
          disabled={processing}
          onClick={() => setConfirm(true)}
        >
          Phân tích lại
        </button>
      )}
    </div>
  );
}
