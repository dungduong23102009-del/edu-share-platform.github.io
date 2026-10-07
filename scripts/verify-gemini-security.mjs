import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
if (!existsSync(".env.local"))
  throw new Error("Missing local environment file");
process.loadEnvFile(".env.local");
const key = process.env.GEMINI_API_KEY?.trim();
if (!key) throw new Error("Gemini credential is not configured");
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const clientDirectory = resolve(".next/static");
if (!existsSync(clientDirectory))
  throw new Error("Build before checking client artifacts");
const clientFiles = files(clientDirectory);
const git = (...args) =>
  spawnSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
    { cwd: root, encoding: "utf8" },
  );
const ignored = git("check-ignore", "--quiet", "--", ".env.local");
const tracked = git("ls-files", "--", ".env.local");
if (tracked.status !== 0) throw new Error("Git inspection failed");
const report = {
  checkedAt: new Date().toISOString(),
  credentialConfigured: true,
  localEnvIgnored: ignored.status === 0,
  localEnvTracked: Boolean(tracked.stdout.trim()),
  clientFilesChecked: clientFiles.length,
  credentialInClientArtifacts: clientFiles.some((path) =>
    readFileSync(path).includes(Buffer.from(key)),
  ),
  claudeCredentialConfigured: Boolean(
    process.env.THIRD_PARTY_CLAUDE_API_KEY?.trim(),
  ),
  claudeCredentialInClientArtifacts:
    Boolean(process.env.THIRD_PARTY_CLAUDE_API_KEY?.trim()) &&
    clientFiles.some((path) =>
      readFileSync(path).includes(
        Buffer.from(process.env.THIRD_PARTY_CLAUDE_API_KEY.trim()),
      ),
    ),
};
mkdirSync("logs/gemini", { recursive: true });
writeFileSync(
  "logs/gemini/security-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (
  !report.localEnvIgnored ||
  report.localEnvTracked ||
  report.credentialInClientArtifacts ||
  report.claudeCredentialInClientArtifacts
)
  process.exitCode = 1;
