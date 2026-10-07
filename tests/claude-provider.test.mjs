import { test } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
process.env.THIRD_PARTY_CLAUDE_API_KEY = "unit-test-placeholder";
const { ClaudeProvider, claudeErrorCategory } =
  await import("../src/lib/ai/claude-provider.ts");
test("Claude retries malformed JSON once, preserves scientific input and captures usage", async () => {
  let calls = 0;
  let sent;
  const input = [
    {
      id: "q1",
      questionText: "ΔU = Q + A; > < ≥ ≤ → ⇌ ± °C 10⁻³ m/s² √ ∫",
      choices: ["1", "2", "3", "4"],
      originalType: "multiple_choice",
      topic: null,
      relevantTheory: null,
      sourceExcerpt: null,
    },
  ];
  const result = {
    id: "q1",
    correctChoice: "B",
    answerText: "2",
    choices: input[0].choices,
    explanation: "Giải thích ngắn.",
    confidence: 0.9,
    status: "solved",
  };
  const client = new OpenAI({
    apiKey: "unit-test-placeholder",
    baseURL: "https://unit.invalid/v1",
    maxRetries: 0,
    logLevel: "off",
    fetch: async (_url, options) => {
      calls++;
      sent = JSON.parse(options.body);
      return new Response(
        JSON.stringify({
          model: "claude-reported-test-model",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content:
                  calls === 1
                    ? "invalid prose"
                    : JSON.stringify({ results: [result] }),
              },
            },
          ],
          usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  const response = await new ClaudeProvider(client).solveBatch(
    input,
    AbortSignal.timeout(1000),
  );
  assert.equal(calls, 2);
  assert.equal(
    JSON.parse(sent.messages[1].content).questions[0].questionText,
    input[0].questionText,
  );
  assert.deepEqual(response.usage, {
    inputTokens: 16,
    outputTokens: 6,
    reasoningTokens: 0,
    totalTokens: 22,
  });
  assert.equal(response.results[0].correctChoice, "B");
  assert.equal(response.model, "claude-reported-test-model");
});
test("gateway quota is never retried; absent model does not choose another model", async () => {
  let calls = 0;
  const input = [
    {
      id: "q1",
      questionText: "2+2?",
      choices: ["1", "2", "3", "4"],
      originalType: "multiple_choice",
      topic: null,
      relevantTheory: null,
      sourceExcerpt: null,
    },
  ];
  const client = new OpenAI({
    apiKey: "unit-test-placeholder",
    baseURL: "https://unit.invalid/v1",
    maxRetries: 0,
    logLevel: "off",
    fetch: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          error: { message: "Test quota exceeded", type: "quota" },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  await assert.rejects(
    new ClaudeProvider(client).solveBatch(input, AbortSignal.timeout(1000)),
    (error) => claudeErrorCategory(error) === "quota_exceeded",
  );
  assert.equal(calls, 1);
  calls = 0;
  const noModels = new OpenAI({
    apiKey: "unit-test-placeholder",
    baseURL: "https://unit.invalid/v1",
    maxRetries: 0,
    logLevel: "off",
    fetch: async () => {
      calls++;
      return new Response(JSON.stringify({ object: "list", data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await assert.rejects(
    new ClaudeProvider(noModels).healthCheck(),
    (error) => claudeErrorCategory(error) === "model_unavailable",
  );
  assert.equal(calls, 1);
  assert.equal(claudeErrorCategory(new Error("Request timed out.")), "timeout");
});
