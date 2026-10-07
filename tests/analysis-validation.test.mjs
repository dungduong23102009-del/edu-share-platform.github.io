import { test } from "node:test";
import assert from "node:assert/strict";
const { validateAnalysis, documentAnalysisJsonSchema } = await import(
  new URL("../src/lib/ai/schemas.ts", import.meta.url).href
);
const { extractDocx } = await import(
  new URL("../src/lib/ai/docx.ts", import.meta.url).href
);
import { theoryDOCX, corruptDOCX } from "./analysis-fixtures.mjs";
const { analysisError, analysisErrorMessage } = await import(
  new URL("../src/lib/ai/errors.ts", import.meta.url).href
);
const fixture = () => ({
  documentTitle: "Arithmetic",
  documentType: "question_answer",
  language: "en",
  summary: "Source questions",
  topics: [{ title: "Arithmetic", summary: null, sourcePages: [1] }],
  sourceQuestions: [
    {
      questionText: "What is 2+2?",
      choices: ["3", "5", "4", "6"],
      explicitAnswer: "B",
      answerOrigin: "source",
      answerSourceExcerpt: "Source answer: B",
      topicTitle: "Arithmetic",
      sourcePage: 1,
      sourceExcerpt: "What is 2+2?",
      confidence: 0.98,
    },
  ],
  theoryPoints: [],
  warnings: [],
});
test("extraction preserves even a mathematically incorrect source answer; absent answers remain null", () => {
  const data = fixture();
  data.sourceQuestions.push({
    ...data.sourceQuestions[0],
    explicitAnswer: null,
    answerOrigin: "not_provided",
    answerSourceExcerpt: null,
  });
  const result = validateAnalysis(data, "PDF");
  assert.equal(result.sourceQuestions[0].explicitAnswer, "B");
  assert.equal(result.sourceQuestions[1].explicitAnswer, null);
  const invented = fixture();
  invented.sourceQuestions[0].answerOrigin = "not_provided";
  assert.throws(() => validateAnalysis(invented, "PDF"));
});
test("semantic warnings preserve inconsistent source content and merge duplicate topics", () => {
  const data = fixture();
  data.topics.push({ ...data.topics[0], title: " arithmetic " });
  data.sourceQuestions[0].choices = ["3", "3", "4", "6"];
  data.sourceQuestions[0].explicitAnswer = "Z";
  data.sourceQuestions[0].confidence = 0.4;
  const result = validateAnalysis(data, "PDF");
  assert.equal(result.topics.length, 1);
  assert.equal(result.sourceQuestions[0].explicitAnswer, "Z");
  assert.equal(result.warnings.length, 4);
});
test("invalid extraction cannot be saved; DOCX never invents page numbers or answer evidence", () => {
  for (const changed of [
    { confidence: 1.2 },
    { questionText: " " },
    { sourcePage: 0 },
    { answerSourceExcerpt: null },
  ]) {
    const data = fixture();
    Object.assign(data.sourceQuestions[0], changed);
    assert.throws(() => validateAnalysis(data, "PDF"));
  }
  assert.throws(() =>
    validateAnalysis(fixture(), "DOCX", "No answer is supplied."),
  );
  const result = validateAnalysis(
    fixture(),
    "DOCX",
    "What is 2+2? Source answer: B",
  );
  assert.equal(result.sourceQuestions[0].sourcePage, null);
  assert.deepEqual(result.topics[0].sourcePages, []);
});
test("Mammoth reads Vietnamese DOCX with a fidelity warning and rejects corrupt XML", async () => {
  const extracted = await extractDocx(theoryDOCX());
  assert.match(extracted.text, /Nội năng phụ thuộc vào nhiệt độ/);
  assert.ok(extracted.warnings.length);
  await assert.rejects(extractDocx(corruptDOCX()));
});
test("Gemini schema keeps nullable answer types; server validation still enforces bounds", () => {
  const question = documentAnalysisJsonSchema.properties.sourceQuestions.items;
  assert.deepEqual(question.properties.explicitAnswer.type, ["string", "null"]);
  assert.deepEqual(question.properties.sourcePage.type, ["integer", "null"]);
  assert.equal(question.additionalProperties, false);
  assert.ok(question.required.includes("answerSourceExcerpt"));
  assert.equal(question.properties.confidence.maximum, undefined);
  const invalid = fixture();
  invalid.sourceQuestions[0].confidence = 1.01;
  assert.throws(() => validateAnalysis(invalid, "PDF"));
});
test("provider errors expose only safe categories, including nested invalid keys", () => {
  const failure = analysisError({
    status: 400,
    message: "Bad request",
    error: {
      error: { message: "API key not valid. Do not expose credential." },
    },
  });
  assert.equal(failure.category, "invalid_key");
  assert.doesNotMatch(
    analysisErrorMessage(failure.category),
    /credential|API key/,
  );
  assert.equal(analysisError({ status: 429 }).category, "quota_exceeded");
  assert.equal(
    analysisError(new SyntaxError("Private response")).category,
    "invalid_output",
  );
  assert.equal(analysisError(new Error("Request aborted")).category, "timeout");
});
