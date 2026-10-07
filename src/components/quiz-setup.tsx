"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Play } from "@phosphor-icons/react/ssr";
import { questionBank, topics } from "@/lib/mock-data";
import { studyActions, useStudy } from "@/lib/study-store";
import type { QuizSettings, TopicId } from "@/lib/types";
import { EmptyState, PageHeader, StepIndicator } from "./ui";

export function TopicSelector() {
  const { draft } = useStudy();
  const router = useRouter();
  if (!draft || draft.status !== "ready")
    return (
      <EmptyState
        title="Chưa có chủ đề để chọn"
        description="Chuẩn bị bài mẫu trước khi chọn nội dung ôn tập."
        action={
          <Link href="/practice" className="button primary">
            Chọn bài mẫu
          </Link>
        }
      />
    );
  const chosen = draft.topicIds;
  function toggle(id: TopicId) {
    studyActions.selectTopics(
      chosen.includes(id)
        ? chosen.filter((item) => item !== id)
        : [...chosen, id],
    );
  }
  return (
    <div className="flow-page">
      <StepIndicator current={1} />
      <PageHeader
        title="Chọn nội dung muốn ôn"
        description={`Bài mẫu có ${topics.length} chủ đề. Chọn nội dung bạn cần ôn.`}
      />
      <div className="selection-topline">
        <span>
          {chosen.length} / {topics.length} chủ đề đã chọn
        </span>
        <label className="check-row">
          <input
            type="checkbox"
            checked={chosen.length === topics.length}
            onChange={(event) =>
              studyActions.selectTopics(
                event.target.checked ? topics.map((topic) => topic.id) : [],
              )
            }
          />
          Chọn tất cả
        </label>
      </div>
      <div className="topic-list">
        {topics.map((topic) => (
          <label
            className={`topic-card ${chosen.includes(topic.id) ? "selected" : ""}`}
            key={topic.id}
          >
            <input
              type="checkbox"
              checked={chosen.includes(topic.id)}
              onChange={() => toggle(topic.id)}
            />
            <span className="custom-check" aria-hidden="true">
              {chosen.includes(topic.id) && <Check size={14} weight="bold" />}
            </span>
            <span className="topic-copy">
              <strong>{topic.title}</strong>
              <span>{topic.description}</span>
            </span>
            <span className="topic-count">
              {
                questionBank.filter((question) => question.topicId === topic.id)
                  .length
              }{" "}
              câu
            </span>
          </label>
        ))}
      </div>
      <div className="flow-bottom">
        <span>
          {chosen.length
            ? `${questionBank.filter((question) => chosen.includes(question.topicId)).length} câu hỏi để bạn luyện tập`
            : "Chọn ít nhất một chủ đề để tiếp tục"}
        </span>
        <button
          className="button primary"
          disabled={!chosen.length}
          onClick={() => router.push("/setup")}
        >
          Tiếp tục <ArrowRight size={18} />
        </button>
      </div>
      <p className="small-note">
        Bạn có thể thay đổi số câu và nguồn câu hỏi ở bước tiếp theo.
      </p>
    </div>
  );
}
export function QuizSetup() {
  const { draft, settings } = useStudy();
  const router = useRouter();
  if (!draft || draft.status !== "ready" || !draft.topicIds.length)
    return (
      <EmptyState
        title="Chọn nội dung ôn tập trước"
        description="Bài trắc nghiệm cần ít nhất một chủ đề."
        action={
          <Link href="/topics" className="button primary">
            Chọn chủ đề
          </Link>
        }
      />
    );
  const available = questionBank.filter(
    (question) =>
      draft.topicIds.includes(question.topicId) &&
      settings.sources.includes(question.source),
  ).length;
  const count =
    settings.count === "all" ? available : Math.min(available, settings.count);
  function change(patch: Partial<QuizSettings>) {
    studyActions.setSettings({ ...settings, ...patch });
  }
  return (
    <div className="flow-page">
      <StepIndicator current={2} />
      <PageHeader
        title="Học theo nhịp của bạn"
        description="Chọn một bài ngắn để khởi động, hoặc thử sức với toàn bộ nội dung."
      />
      <div className="setup-panel">
        <section className="setup-section">
          <h2>Số câu hỏi</h2>
          <p>Chọn độ dài phù hợp với thời gian của bạn.</p>
          <div className="segmented" role="group" aria-label="Số câu hỏi">
            {([10, 20, 30, 50, "all"] as const).map((value) => (
              <button
                key={value}
                className={settings.count === value ? "selected" : ""}
                aria-pressed={settings.count === value}
                onClick={() => change({ count: value })}
              >
                {value === "all" ? "Tất cả" : value}
              </button>
            ))}
          </div>
        </section>
        <section className="setup-section">
          <h2>Nguồn câu hỏi</h2>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.sources.includes("document")}
              onChange={(event) =>
                change({
                  sources: event.target.checked
                    ? [...settings.sources, "document"]
                    : settings.sources.filter(
                        (source) => source !== "document",
                      ),
                })
              }
            />
            <span>
              Câu hỏi trong tài liệu
              <small>Ôn lại nội dung có sẵn trong đề cương.</small>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.sources.includes("ai")}
              onChange={(event) =>
                change({
                  sources: event.target.checked
                    ? [...settings.sources, "ai"]
                    : settings.sources.filter((source) => source !== "ai"),
                })
              }
            />
            <span>
              Câu hỏi bổ sung trong bài mẫu
              <small>Luyện thêm với các câu hỏi mở rộng từ lý thuyết.</small>
            </span>
          </label>
        </section>
        <section className="setup-section">
          <h2>Tùy chọn</h2>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.shuffleQuestions}
              onChange={(event) =>
                change({ shuffleQuestions: event.target.checked })
              }
            />
            Trộn câu hỏi
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.shuffleAnswers}
              onChange={(event) =>
                change({ shuffleAnswers: event.target.checked })
              }
            />
            Trộn đáp án
          </label>
        </section>
      </div>
      <div className="setup-summary">
        <div>
          <strong>{count} câu hỏi</strong>
          <span>{draft.topicIds.length} chủ đề đã chọn</span>
        </div>
        <button
          className="button primary"
          disabled={!available}
          onClick={() => {
            if (studyActions.startQuiz()) router.push("/quiz");
          }}
        >
          <Play size={17} weight="fill" />
          Bắt đầu làm bài
        </button>
      </div>
      {!available && (
        <p role="alert" className="inline-error">
          Chọn ít nhất một nguồn câu hỏi.
        </p>
      )}
      {typeof settings.count === "number" &&
        settings.count > available &&
        available > 0 && (
          <p className="small-note">
            Nguồn đã chọn có {available} câu. Bài sẽ sử dụng toàn bộ số câu hiện
            có.
          </p>
        )}
      <Link className="back-link" href="/topics">
        ← Chọn lại chủ đề
      </Link>
    </div>
  );
}
