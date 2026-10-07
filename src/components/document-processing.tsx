"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, WarningCircle } from "@phosphor-icons/react/ssr";
import type { AnalysisView } from "@/lib/documents/load-analysis";
import { analysisErrorMessage } from "@/lib/ai/errors";
import { PageHeader } from "./ui";

const steps = [
  "Tài liệu đã tải lên",
  "Đang đọc nội dung",
  "Đang nhận diện chủ đề",
  "Đang tìm câu hỏi và đáp án",
  "Đang hoàn tất",
];
export function DocumentProcessing({
  documentId,
  start,
}: {
  documentId: string;
  start: boolean;
}) {
  const router = useRouter();
  const didStart = useRef(false);
  const [view, setView] = useState<AnalysisView | null>(null);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(`/api/documents/${documentId}/analysis`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.assign(
            new URL("/login?reason=session", window.location.origin).href,
          );
          return;
        }
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error || "Chưa thể đọc tiến độ. Hãy thử lại.");
          return;
        }
        const result = body as AnalysisView;
        setView(result);
        if (result.document.status === "ready") {
          router.replace(`/topics?documentId=${documentId}`);
          return;
        }
        if (result.document.status === "failed") return;
        if (
          result.document.status === "uploaded" &&
          start &&
          !didStart.current
        ) {
          didStart.current = true;
          const started = await fetch(`/api/documents/${documentId}/analyze`, {
            method: "POST",
            signal: controller.signal,
          });
          if (!started.ok) {
            const failure = await started.json();
            if (!cancelled)
              setError(failure.error || "Chưa thể bắt đầu phân tích.");
            return;
          }
        } else if (result.document.status === "uploaded" && !start) {
          setError("Tài liệu đã tải lên và đang chờ phân tích.");
          return;
        }
        if (!cancelled) timer = setTimeout(poll, 1500);
      } catch {
        if (!cancelled)
          setError("Chưa thể đọc tiến độ. Hãy kiểm tra kết nối và thử lại.");
      }
    }
    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [documentId, start, revision, router]);
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/analyze`, {
        method: "POST",
      });
      if (response.status === 401) {
        window.location.assign(
          new URL("/login?reason=session", window.location.origin).href,
        );
        return;
      }
      if (!response.ok) {
        const result = await response.json();
        setError(result.error || "Chưa thể thử lại.");
        return;
      }
      setError("");
      setView(null);
      setRevision((value) => value + 1);
    } catch {
      setError("Chưa thể kết nối dịch vụ phân tích. Hãy thử lại.");
    } finally {
      setRetrying(false);
    }
  }
  const failed = view?.document.status === "failed" || !!error;
  if (failed)
    return (
      <div className="flow-page processing-error">
        <WarningCircle size={42} weight="light" />
        <PageHeader
          title="Không thể phân tích tài liệu này."
          description={
            view?.document.original_filename ||
            "Hãy kiểm tra kết nối và thử lại."
          }
        />
        <p className="inline-error" role="alert">
          {error || analysisErrorMessage(view?.document.analysis_error || null)}
        </p>
        <div className="button-row">
          <button
            className="button primary"
            onClick={retry}
            disabled={retrying}
          >
            {retrying ? "Đang thử lại…" : "Thử lại"}
          </button>
          <Link href="/create" className="button secondary">
            Chọn tài liệu khác
          </Link>
        </div>
      </div>
    );
  const stage = view?.document.analysis_stage;
  const active = stage === "saving" ? 4 : stage === "extracting" ? 2 : 1;
  return (
    <div className="flow-page processing-page">
      <span className="processing-symbol">
        <FileText size={34} weight="light" />
      </span>
      <PageHeader
        title="Đang phân tích tài liệu"
        description={
          view?.document.original_filename || "Đang đọc trạng thái tài liệu…"
        }
      />
      <div className="processing-panel">
        <ol
          className="processing-list"
          aria-label="Các bước phân tích tài liệu"
        >
          {steps.map((label, index) => {
            const current =
              index === active || (stage === "extracting" && index === 3);
            return (
              <li
                key={label}
                className={
                  index < active ? "complete" : current ? "current" : "pending"
                }
              >
                <span className="step-marker">
                  {index < active ? (
                    <Check size={17} weight="bold" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span>{label}</span>
                {current && <small>Đang xử lý</small>}
              </li>
            );
          })}
        </ol>
      </div>
      <p className="small-note" role="status">
        {stage === "extracting"
          ? "Đang nhận diện chủ đề, câu hỏi và đáp án trong tài liệu."
          : steps[active]}
      </p>
      <Link href="/documents" className="text-link">
        Về thư viện
      </Link>
    </div>
  );
}
