import { mkdirSync, writeFileSync } from "node:fs";
process.loadEnvFile(".env.local");
const { ClaudeProvider, claudeErrorCategory } =
  await import("../src/lib/ai/claude-provider.ts");
let provider;
let report;
try {
  provider = new ClaudeProvider();
  report = {
    connection: "OK",
    ...(await provider.healthCheck()),
    checkedAt: new Date().toISOString(),
  };
} catch (error) {
  report = {
    connection: "FAIL",
    category: claudeErrorCategory(error),
    model: provider?.model,
    baseURL: provider?.baseURL,
    availableClaudeModels: provider?.availableModels.filter((name) =>
      /claude/i.test(name),
    ),
    checkedAt: new Date().toISOString(),
  };
  process.exitCode = 1;
}
mkdirSync("logs/claude", { recursive: true });
writeFileSync("logs/claude/health.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
