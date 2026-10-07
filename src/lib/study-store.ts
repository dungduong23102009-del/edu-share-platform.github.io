"use client";

import { useSyncExternalStore } from "react";
import {
  makeDemoAttempt,
  mockDocuments,
  questionBank,
  topics,
} from "./mock-data";
import { buildQuestions, wrongQuestions } from "./quiz-logic";
import type {
  Attempt,
  QuizSession,
  QuizSettings,
  StudyDocument,
  StudyState,
  TopicId,
  Question,
} from "./types";

const STORAGE_KEY = "study-quiz-ai:milestone-1";
const initialActive: QuizSession = {
  id: "continue-physics",
  title: "Đề cương chương I",
  documentName: mockDocuments[0].name,
  questions: questionBank.slice(0, 30),
  answers: Object.fromEntries(
    questionBank
      .slice(0, 26)
      .map((question) => [question.id, question.correctId]),
  ),
  current: 26,
  startedAt: 0,
  elapsedBefore: 185,
  retry: false,
};
const initialState: StudyState = {
  version: 1,
  documents: mockDocuments,
  history: [makeDemoAttempt()],
  draft: null,
  active: initialActive,
  result: null,
  settings: {
    count: 10,
    sources: ["document", "ai"],
    shuffleQuestions: false,
    shuffleAnswers: false,
  },
};
let state = initialState;
let initialized = false;
const listeners = new Set<() => void>();
function initialize() {
  if (!initialized) {
    initialized = true;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (
          saved &&
          typeof saved === "object" &&
          "version" in saved &&
          saved.version === 1 &&
          "documents" in saved &&
          Array.isArray(saved.documents) &&
          "history" in saved &&
          Array.isArray(saved.history) &&
          "settings" in saved
        )
          state = saved as StudyState;
      }
    } catch {
      /* Session storage is optional; the prototype also works in memory. */
    }
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  initialize();
  return () => {
    listeners.delete(listener);
  };
}
function update(updater: (previous: StudyState) => StudyState) {
  initialize();
  state = updater(state);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Keep the current session in memory if storage is unavailable. */
  }
  listeners.forEach((listener) => listener());
}
export function useStudy() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => initialState,
  );
}
export const studyActions = {
  startPreparedQuiz(input: {
    title: string;
    documentName: string;
    questions: Question[];
  }) {
    if (!input.questions.length) return false;
    const active: QuizSession = {
      id: crypto.randomUUID(),
      ...input,
      answers: {},
      current: 0,
      startedAt: Date.now(),
      elapsedBefore: 0,
      retry: false,
    };
    update((previous) => ({ ...previous, active, result: null }));
    return true;
  },
  analyze(document: StudyDocument, failProcessing = false) {
    update((previous) => ({
      ...previous,
      draft: {
        document,
        failProcessing,
        topicIds: topics.map((topic) => topic.id),
        status: "processing",
      },
    }));
  },
  finishProcessing() {
    update((previous) => {
      if (!previous.draft) return previous;
      const draft = {
        ...previous.draft,
        status: previous.draft.failProcessing
          ? ("failed" as const)
          : ("ready" as const),
      };
      const documents =
        draft.status === "ready" &&
        !previous.documents.some(
          (document) => document.id === draft.document.id,
        )
          ? [draft.document, ...previous.documents]
          : previous.documents;
      return { ...previous, draft, documents };
    });
  },
  retryProcessing() {
    update((previous) => ({
      ...previous,
      draft: previous.draft
        ? { ...previous.draft, status: "processing", failProcessing: false }
        : null,
    }));
  },
  selectTopics(topicIds: TopicId[]) {
    update((previous) => ({
      ...previous,
      draft: previous.draft ? { ...previous.draft, topicIds } : null,
    }));
  },
  setSettings(settings: QuizSettings) {
    update((previous) => ({ ...previous, settings }));
  },
  startQuiz() {
    const draft = state.draft;
    if (!draft || !draft.topicIds.length || draft.status !== "ready")
      return false;
    const questions = buildQuestions(
      questionBank,
      draft.topicIds,
      state.settings,
    );
    if (!questions.length) return false;
    const active: QuizSession = {
      id: crypto.randomUUID(),
      title: draft.document.name.replace(/\.(pdf|docx)$/i, ""),
      documentName: draft.document.name,
      questions,
      answers: {},
      current: 0,
      startedAt: Date.now(),
      elapsedBefore: 0,
      retry: false,
    };
    update((previous) => ({ ...previous, active, result: null }));
    return true;
  },
  answer(questionId: string, choiceId: string) {
    update((previous) => ({
      ...previous,
      active: previous.active
        ? {
            ...previous.active,
            answers: { ...previous.active.answers, [questionId]: choiceId },
          }
        : null,
    }));
  },
  goToQuestion(current: number) {
    update((previous) => ({
      ...previous,
      active: previous.active
        ? {
            ...previous.active,
            current: Math.max(
              0,
              Math.min(current, previous.active.questions.length - 1),
            ),
          }
        : null,
    }));
  },
  resume() {
    update((previous) => ({
      ...previous,
      active:
        previous.active && !previous.active.startedAt
          ? { ...previous.active, startedAt: Date.now() }
          : previous.active,
    }));
  },
  pause() {
    update((previous) => ({
      ...previous,
      active: previous.active
        ? {
            ...previous.active,
            elapsedBefore:
              previous.active.elapsedBefore +
              (previous.active.startedAt
                ? Math.max(
                    0,
                    Math.floor((Date.now() - previous.active.startedAt) / 1000),
                  )
                : 0),
            startedAt: 0,
          }
        : null,
    }));
  },
  submit() {
    if (!state.active) return;
    const completedAt = Date.now();
    const result: Attempt = {
      ...state.active,
      completedAt,
      duration:
        state.active.elapsedBefore +
        (state.active.startedAt
          ? Math.max(
              0,
              Math.floor((completedAt - state.active.startedAt) / 1000),
            )
          : 0),
    };
    update((previous) => ({
      ...previous,
      result,
      active: null,
      history: [result, ...previous.history].slice(0, 30),
    }));
  },
  openAttempt(attempt: Attempt) {
    update((previous) => ({ ...previous, result: attempt }));
  },
  retry(onlyWrong: boolean) {
    const result = state.result;
    if (!result) return false;
    const questions = onlyWrong ? wrongQuestions(result) : result.questions;
    if (!questions.length) return false;
    const active: QuizSession = {
      id: crypto.randomUUID(),
      title: onlyWrong ? "Ôn lại câu sai" : result.title,
      documentName: result.documentName,
      questions,
      answers: {},
      current: 0,
      startedAt: Date.now(),
      elapsedBefore: 0,
      retry: onlyWrong,
    };
    update((previous) => ({ ...previous, active, result: null }));
    return true;
  },
  deleteDocument(id: string) {
    update((previous) => ({
      ...previous,
      documents: previous.documents.filter((document) => document.id !== id),
    }));
  },
  clearHistory() {
    update((previous) => ({ ...previous, history: [] }));
  },
  clearDemo() {
    update((previous) => ({
      ...previous,
      documents: [],
      history: [],
      active: null,
      result: null,
      draft: null,
    }));
  },
  resetDemo() {
    update(() => ({ ...initialState }));
  },
};
