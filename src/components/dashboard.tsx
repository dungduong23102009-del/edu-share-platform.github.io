"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Plus } from "@phosphor-icons/react/ssr";
import { studyActions, useStudy } from "@/lib/study-store";
import { scoreAttempt } from "@/lib/quiz-logic";
import { EmptyState, FileBadge, PageHeader, ProgressBar } from "./ui";
import type { DocumentView } from "@/lib/supabase/queries";
import {
  documentStatus,
  formatFileSize,
  PDF_MIME,
} from "@/lib/documents/validation";

export function Dashboard({
  documents,
  error,
  displayName,
}: {
  documents: DocumentView[];
  error: string | null;
  displayName: string;
}) {
  const { history, active } = useStudy();
  const router = useRouter();
  const answered = active ? Object.keys(active.answers).length : 0;
  const progress = active
    ? Math.round((answered / active.questions.length) * 100)
    : 0;
  return (
    <div className="dashboard">
      <PageHeader
        title={`Xin chào, ${displayName}`}
        description="Hôm nay bạn muốn ôn nội dung gì?"
        action={
          <Link href="/create" className="button primary">
            <Plus size={18} weight="bold" />
            Tạo bài trắc nghiệm
          </Link>
        }
      />
      <Link className="text-link practice-link" href="/practice">
        Luyện với câu hỏi mẫu <ArrowRight size={16} />
      </Link>
      <section className="continue-section">
        <div className="section-title">
          <h2>Tiếp tục học</h2>
        </div>
        {active ? (
          <div className="continue-panel">
            <div className="continue-copy">
              <span className="subject-label">
                BÀI LUYỆN TẬP MẪU · VẬT LÍ 12
              </span>
              <h3>{active.title}</h3>
              <p>
                {active.retry
                  ? "Củng cố những câu bạn chưa chắc chắn."
                  : "Nội năng & nhiệt động lực học"}
              </p>
              <button
                className="button primary"
                onClick={() => {
                  studyActions.resume();
                  router.push("/quiz");
                }}
              >
                Tiếp tục <ArrowRight size={18} />
              </button>
            </div>
            <div className="continue-progress">
              <div className="progress-number">
                <strong>
                  {progress}
                  <span>%</span>
                </strong>
                <span>đã hoàn thành</span>
              </div>
              <ProgressBar value={progress} label="Tiến độ bài đang làm" />
              <div className="continue-metadata">
                <span>
                  {answered} / {active.questions.length} câu
                </span>
                <span>
                  <Clock size={15} />
                  Chưa nộp bài
                </span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Chưa có bài đang làm dở"
            description="Chọn bộ câu hỏi mẫu để bắt đầu ôn tập."
          />
        )}
      </section>
      <div className="dashboard-lower">
        <section>
          <div className="section-title">
            <h2>Tài liệu gần đây</h2>
            <Link href="/documents" className="text-link">
              Tất cả <ArrowRight size={15} />
            </Link>
          </div>
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : documents.length ? (
            <div className="document-list">
              {documents.slice(0, 2).map((document) => (
                <Link
                  key={document.id}
                  className="document-row"
                  href="/documents"
                >
                  <FileBadge
                    format={document.mime_type === PDF_MIME ? "PDF" : "DOCX"}
                  />
                  <span className="document-copy">
                    <strong>
                      {document.original_filename.replace(/\.(pdf|docx)$/i, "")}
                    </strong>
                    <span>
                      {formatFileSize(document.file_size)} <i />{" "}
                      {documentStatus(document.status)}
                    </span>
                  </span>
                  <ArrowRight size={17} className="row-arrow" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có tài liệu"
              description="Tải tài liệu đầu tiên để bắt đầu ôn tập."
            />
          )}
        </section>
        <section>
          <div className="section-title">
            <h2>Kết quả luyện tập mẫu</h2>
            <Link href="/history" className="text-link">
              Lịch sử <ArrowRight size={15} />
            </Link>
          </div>
          {history.length ? (
            <div className="recent-result">
              {history.slice(0, 2).map((attempt) => {
                const score = scoreAttempt(attempt);
                return (
                  <button
                    className="result-row"
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
                    <span>
                      <strong>{attempt.title}</strong>
                      <span>
                        {score.correct}/{score.total} câu đúng <i />{" "}
                        {new Date(attempt.completedAt).toLocaleDateString(
                          "vi-VN",
                        )}
                      </span>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Chưa có kết quả"
              description="Hoàn thành một bài để xem kết quả."
            />
          )}
        </section>
      </div>
    </div>
  );
}
