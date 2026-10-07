export type TopicId = string;
export type QuestionSource = "document" | "ai";
export type AnswerOrigin =
  "document" | "inferred" | "generated" | "source" | "ai_derived";
export interface Topic {
  id: TopicId;
  title: string;
  shortTitle: string;
  description: string;
}
export interface StudyDocument {
  id: string;
  name: string;
  format: "PDF" | "DOCX";
  size: string;
  addedAt: string;
  questionCount: number;
}
export interface Choice {
  id: string;
  text: string;
}
export interface Question {
  id: string;
  topicId: TopicId;
  prompt: string;
  choices: Choice[];
  correctId: string;
  explanation: string;
  page: number | null;
  source: QuestionSource;
  origin: AnswerOrigin;
}
export interface QuizSettings {
  count: number | "all";
  sources: QuestionSource[];
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
}
export interface QuizSession {
  id: string;
  title: string;
  documentName: string;
  questions: Question[];
  answers: Record<string, string>;
  current: number;
  startedAt: number;
  elapsedBefore: number;
  retry: boolean;
}
export interface Attempt extends QuizSession {
  completedAt: number;
  duration: number;
}
export interface Draft {
  document: StudyDocument;
  topicIds: TopicId[];
  status: "processing" | "ready" | "failed";
  failProcessing: boolean;
}
export interface StudyState {
  version: 1;
  documents: StudyDocument[];
  history: Attempt[];
  draft: Draft | null;
  active: QuizSession | null;
  result: Attempt | null;
  settings: QuizSettings;
}
