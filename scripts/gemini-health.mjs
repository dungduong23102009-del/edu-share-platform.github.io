import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { mkdirSync, writeFileSync } from "node:fs";
process.loadEnvFile(".env.local");
const { geminiConfig } = await import("../src/lib/ai/config.ts");
let stage = "configuration";
let model;
try {
  const config = geminiConfig();
  model = config.model;
  const client = new GoogleGenAI({ apiKey: config.apiKey });
  stage = "model";
  await client.models.get({
    model,
    config: { httpOptions: { timeout: 15000 } },
  });
  stage = "structured_output";
  const schema = z.object({ ok: z.boolean(), language: z.string() });
  const result = await client.interactions.create(
    {
      model,
      input: 'Return {"ok":true,"language":"vi"} for this connectivity check.',
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: z.toJSONSchema(schema),
      },
    },
    { timeout: 20000, maxRetries: 0 },
  );
  const parsed = schema.parse(JSON.parse(result.output_text || ""));
  if (!parsed.ok || parsed.language !== "vi")
    throw new Error("HEALTH_OUTPUT_INVALID");
  const report = {
    connection: "OK",
    model,
    structuredOutput: "OK",
    timestamp: new Date().toISOString(),
  };
  mkdirSync("logs", { recursive: true });
  writeFileSync("logs/gemini-health.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  const status =
    typeof error.status === "number"
      ? error.status
      : typeof error.code === "number"
        ? error.code
        : undefined;
  const message = typeof error.message === "string" ? error.message : "";
  const category = /GEMINI_KEY_MISSING/.test(message)
    ? "missing_key"
    : /API.?key.*(?:invalid|not valid)|API_KEY_INVALID/i.test(message)
      ? "invalid_key"
      : status === 429
        ? "quota_exceeded"
        : status === 403
          ? "permission_denied"
          : status === 404
            ? "model_not_found"
            : /timeout|timed out/i.test(message)
              ? "timeout"
              : stage === "structured_output"
                ? "structured_output_failed"
                : "connection_failed";
  const report = {
    connection: "FAIL",
    model,
    stage,
    status,
    category,
    timestamp: new Date().toISOString(),
  };
  mkdirSync("logs", { recursive: true });
  writeFileSync("logs/gemini-health.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exitCode = 1;
}
