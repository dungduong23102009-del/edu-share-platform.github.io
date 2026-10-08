export interface PublicQuestion {
  id: string;
  prompt: string;
  choices: { id: string; text: string }[];
}
export interface QuizView {
  quizId: string;
  attemptId: string;
  title: string;
  documentName: string;
  questions: PublicQuestion[];
  answers: Record<string, string>;
  retry: boolean;
  startedAt: string;
  completedAt: string | null;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percent: number | null;
}
export interface ReviewQuestion extends PublicQuestion {
  correctId: string;
  explanation: string;
  origin: "source" | "ai_derived";
  page: number | null;
  topicTitle: string | null;
}
export interface QuizResult extends QuizView {
  questions: ReviewQuestion[];
  completedAt: string;
  percent: number;
}
export type QuizHistory = Omit<QuizView, "questions" | "answers" | "retry">;
