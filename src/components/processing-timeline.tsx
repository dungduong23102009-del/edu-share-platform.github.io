"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowClockwise,
  Check,
  FileText,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { mockProcessingSteps } from "@/lib/mock-data";
import { studyActions, useStudy } from "@/lib/study-store";
import { EmptyState, PageHeader, ProgressBar } from "./ui";

export function ProcessingTimeline() {
  const { draft } = useStudy();
  const [step, setStep] = useState(0);
  const router = useRouter();
  useEffect(() => {
    if (draft?.status !== "processing") return;
    const interval = window.setInterval(
      () => setStep((previous) => Math.min(previous + 1, 4)),
      850,
    );
    const complete = window.setTimeout(() => {
      studyActions.finishProcessing();
      if (!draft.failProcessing) router.replace("/topics");
    }, 4400);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(complete);
    };
  }, [draft?.document.id, draft?.status, draft?.failProcessing, router]);
  useEffect(() => {
    if (draft?.status === "ready") router.replace("/topics");
  }, [draft?.status, router]);
  if (!draft)
    return (
      <EmptyState
        title="Chọn bài luyện tập mẫu trước"
        description="Bắt đầu với bộ câu hỏi có sẵn để ôn tập."
        action={
          <Link href="/practice" className="button primary">
            Chọn bài mẫu
          </Link>
        }
      />
    );
  if (draft.status === "failed")
    return (
      <div className="flow-page">
        <div className="processing-error">
          <WarningCircle size={42} weight="light" />
          <PageHeader
            title="Chưa thể chuẩn bị bài mẫu"
            description="Hãy thử lại để tiếp tục luyện tập."
          />
          <p>Bài mẫu chưa được chuẩn bị xong.</p>
          <div className="button-row">
            <button
              className="button primary"
              onClick={() => {
                setStep(0);
                studyActions.retryProcessing();
              }}
            >
              <ArrowClockwise size={18} />
              Thử lại
            </button>
            <Link className="button secondary" href="/practice">
              Quay lại bài mẫu
            </Link>
          </div>
        </div>
      </div>
    );
  return (
    <div className="flow-page processing-page">
      <span className="processing-symbol">
        <FileText size={34} weight="light" />
      </span>
      <PageHeader
        title="Đang chuẩn bị bài trắc nghiệm"
        description={`Đang chuẩn bị bộ câu hỏi mẫu: ${draft.document.name}`}
      />
      <div className="processing-panel">
        <ol className="processing-list" aria-label="Các bước chuẩn bị bài mẫu">
          {mockProcessingSteps.map((label, index) => (
            <li
              key={label}
              className={
                index < step
                  ? "complete"
                  : index === step
                    ? "current"
                    : "pending"
              }
            >
              <span className="step-marker">
                {index < step ? <Check size={17} weight="bold" /> : index + 1}
              </span>
              <span>{label}</span>
              {index === step && <small>Đang xử lý</small>}
            </li>
          ))}
        </ol>
        <div className="processing-progress">
          <div>
            <span>Chuẩn bị nội dung</span>
            <strong>{Math.min(96, (step + 1) * 19)}%</strong>
          </div>
          <ProgressBar
            value={(step + 1) * 19}
            label="Tiến độ chuẩn bị bài mẫu"
          />
        </div>
      </div>
      <p className="small-note" role="status" aria-live="polite">
        {mockProcessingSteps[step]}.
      </p>
      <Link href="/practice" className="text-link">
        Hủy và quay lại
      </Link>
    </div>
  );
}
