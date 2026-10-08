"use client";
import { Check } from "@phosphor-icons/react/ssr";
import type { Question } from "@/lib/types";
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
  question: Pick<Question, "id" | "prompt" | "choices">;
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
