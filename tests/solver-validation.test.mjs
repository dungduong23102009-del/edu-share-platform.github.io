import { test } from "node:test";
import assert from "node:assert/strict";
const { normalizeQuestion, sourceCorrectChoice, validateQuizQuestion } =
  await import("../src/lib/ai/question-validation.ts");
const { validateSolvedBatch, solverInputSchema } =
  await import("../src/lib/ai/solver-schemas.ts");
test("choice block is split only on a full exact match and source text/symbols remain intact", () => {
  const symbols = "ΔU = Q + A; > < ≥ ≤ → ⇌ ± °C 10⁻³ m/s² √ ∫";
  const raw = `Công thức nào đúng? ${symbols}\nA. ΔU = Q + A\nB. ΔU = Q - A\nC. ΔU = A - Q\nD. ΔU = 0`;
  const normalized = normalizeQuestion({
    questionText: raw,
    choices: ["A. ΔU = Q + A", "B. ΔU = Q - A", "C. ΔU = A - Q", "D. ΔU = 0"],
    sourceExcerpt: symbols,
  });
  assert.equal(normalized.rawQuestionText, raw);
  assert.equal(normalized.questionText, `Công thức nào đúng? ${symbols}`);
  assert.deepEqual(normalized.choices, [
    "ΔU = Q + A",
    "ΔU = Q - A",
    "ΔU = A - Q",
    "ΔU = 0",
  ]);
  assert.deepEqual(normalized.parsingWarnings, []);
  const mismatch = normalizeQuestion({
    questionText: raw,
    choices: ["other", "text", "not", "matching"],
  });
  assert.equal(mismatch.questionText, raw);
  assert.ok(mismatch.parsingWarnings.length);
  assert.ok(
    normalizeQuestion({
      questionText: "Nội năng?",
      choices: [],
      sourceExcerpt: "ΔU = Q + A",
    }).parsingWarnings.length,
  );
});
test("source answers take precedence and quiz validation excludes low confidence, duplicates and unsupported types", () => {
  const source = normalizeQuestion({
    questionText: "2+2?",
    choices: ["3", "5", "4", "6"],
  });
  const input = {
    ...source,
    correctChoice: sourceCorrectChoice("B", source.choices),
    confidence: 0.98,
    answerOrigin: "source",
  };
  assert.equal(input.correctChoice, "B");
  assert.equal(validateQuizQuestion(input).quizReady, true);
  for (const patch of [
    { choices: ["3", "3", "4", "6"] },
    { confidence: 0.4 },
    { correctChoice: "Z" },
    { originalType: "unknown" },
    { answerOrigin: "ai_derived", explanation: "", status: "solved" },
    {
      status: "uncertain",
      answerOrigin: "ai_derived",
      explanation: "Không đủ dữ kiện.",
    },
  ])
    assert.equal(validateQuizQuestion({ ...input, ...patch }).quizReady, false);
  assert.equal(
    validateQuizQuestion({ ...input, confidence: 0.75 }).needsReview,
    true,
  );
  assert.equal(
    normalizeQuestion({ questionText: "Tính 2+3.", choices: [] }).originalType,
    "calculation",
  );
  assert.equal(
    normalizeQuestion({
      questionText: "Phát biểu đúng?",
      choices: ["Đúng", "Sai"],
    }).originalType,
    "true_false",
  );
});
test("compact labels and incomplete choices normalize without changing scientific case or sign", () => {
  const parsed = normalizeQuestion({
    questionText: "Dấu của Q? A.Q>0 B.Q<0 C.Q=0",
    choices: ["A.Q>0", "B.Q<0", "C.Q=0"],
    sourceExcerpt: "Dấu của Q?",
  });
  assert.equal(parsed.questionText, "Dấu của Q?");
  assert.deepEqual(parsed.choices, ["Q>0", "Q<0", "Q=0"]);
  assert.equal(parsed.originalType, "multiple_choice");
  assert.deepEqual(parsed.parsingWarnings, []);
  const wrongCase = normalizeQuestion({
    questionText: "Đại lượng? A.Q B.A C.ΔU D.q",
    choices: ["q", "A", "ΔU", "q"],
  });
  assert.ok(wrongCase.parsingWarnings.length);
  const reversed = normalizeQuestion({
    questionText: "Q < 0 và A > 0",
    choices: [],
    sourceExcerpt: "Q > 0 và A < 0",
  });
  assert.ok(reversed.parsingWarnings.length);
  assert.equal(reversed.questionText, "Q < 0 và A > 0");
  const scientific = normalizeQuestion({
    questionText: "Đại lượng nào?",
    choices: ["Q", "q", "ΔU", "U"],
  });
  assert.equal(sourceCorrectChoice("q", scientific.choices), "B");
  assert.equal(
    validateQuizQuestion({
      ...scientific,
      correctChoice: "B",
      confidence: 0.95,
      answerOrigin: "source",
    }).quizReady,
    true,
  );
});
test("partial MCQs preserve source choices at their positions and only validated completion is ready", () => {
  const input = [
    {
      id: "q1",
      questionText: "Tính 2+3.",
      choices: ["4", "5"],
      originalType: "multiple_choice",
      topic: null,
      relevantTheory: null,
      sourceExcerpt: null,
    },
  ];
  const result = {
    id: "q1",
    correctChoice: "B",
    answerText: "5",
    choices: ["4", "5", "6", "7"],
    explanation: "2+3 bằng 5.",
    confidence: 0.95,
    status: "solved",
  };
  assert.equal(
    validateSolvedBatch({ results: [result] }, input)[0].quizReady,
    true,
  );
  assert.throws(() =>
    validateSolvedBatch(
      { results: [{ ...result, choices: ["5", "4", "6", "7"] }] },
      input,
    ),
  );
  assert.equal(
    validateSolvedBatch(
      { results: [{ ...result, choices: ["4", "5", "5", "7"] }] },
      input,
    )[0].quizReady,
    false,
  );
});
test("solver validates identifiers, answer choice, explanation and source choice fidelity; input excludes profile data", () => {
  const input = [
    {
      id: "q1",
      questionText: "3+3?",
      choices: ["5", "6", "7", "8"],
      originalType: "multiple_choice",
      topic: null,
      relevantTheory: null,
      sourceExcerpt: null,
    },
  ];
  const result = {
    id: "q1",
    correctChoice: "B",
    answerText: "6",
    choices: input[0].choices,
    explanation: "3+3 bằng 6.",
    confidence: 0.98,
    status: "solved",
  };
  assert.equal(
    validateSolvedBatch({ results: [result] }, input)[0].quizReady,
    true,
  );
  assert.throws(() =>
    validateSolvedBatch(
      { results: [{ ...result, choices: ["6", "5", "7", "8"] }] },
      input,
    ),
  );
  assert.throws(() =>
    validateSolvedBatch({ results: [{ ...result, id: "q2" }] }, input),
  );
  assert.throws(() =>
    validateSolvedBatch({ results: [{ ...result, confidence: 1.1 }] }, input),
  );
  assert.throws(() =>
    solverInputSchema.parse({ ...input[0], email: "private@example.com" }),
  );
});
