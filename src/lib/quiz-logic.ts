import type { Attempt, Question, QuizSettings, TopicId } from "./types";

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
export function buildQuestions(
  bank: Question[],
  topicIds: TopicId[],
  settings: QuizSettings,
): Question[] {
  const available = bank.filter(
    (question) =>
      topicIds.includes(question.topicId) &&
      settings.sources.includes(question.source),
  );
  const ordered = settings.shuffleQuestions ? shuffle(available) : available;
  const selected =
    settings.count === "all" ? ordered : ordered.slice(0, settings.count);
  return selected.map((question) => ({
    ...question,
    choices: settings.shuffleAnswers
      ? shuffle(question.choices)
      : [...question.choices],
  }));
}
export function scoreAttempt(attempt: Pick<Attempt, "questions" | "answers">) {
  const correct = attempt.questions.filter(
    (question) => attempt.answers[question.id] === question.correctId,
  ).length;
  const skipped = attempt.questions.filter(
    (question) => !attempt.answers[question.id],
  ).length;
  const wrong = attempt.questions.length - correct - skipped;
  return {
    correct,
    wrong,
    skipped,
    total: attempt.questions.length,
    percent: attempt.questions.length
      ? Math.round((correct / attempt.questions.length) * 100)
      : 0,
  };
}
export function wrongQuestions(
  attempt: Pick<Attempt, "questions" | "answers">,
): Question[] {
  return attempt.questions.filter(
    (question) =>
      attempt.answers[question.id] &&
      attempt.answers[question.id] !== question.correctId,
  );
}
export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
