import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const root = process.cwd();
const git = (...args) =>
  spawnSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
    {
      cwd: root,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
const listing = git(
  "diff",
  "--cached",
  "--name-only",
  "-z",
  "--diff-filter=ACMR",
);
if (listing.status !== 0) throw new Error("Cannot inspect staged files");
const paths = listing.stdout.toString("utf8").split("\0").filter(Boolean);
if (!paths.length) throw new Error("No staged files to inspect");
const credentials = Object.entries(process.env)
  .filter(
    ([name, value]) =>
      !name.startsWith("NEXT_PUBLIC_") &&
      /API_KEY|SECRET|PASSWORD|TOKEN/i.test(name) &&
      typeof value === "string" &&
      value.trim().length >= 8,
  )
  .map(([, value]) => Buffer.from(value.trim()));
let credentialFound = false;
const forbiddenFile = paths.some(
  (path) => /(^|\/)\.env($|\.)/.test(path) && path !== ".env.example",
);
for (const path of paths) {
  const file = git("show", `:${path}`);
  if (file.status !== 0) throw new Error("Cannot inspect a staged file");
  if (credentials.some((credential) => file.stdout.includes(credential))) {
    credentialFound = true;
    break;
  }
}
const report = {
  stagedFilesChecked: paths.length,
  forbiddenEnvFile: forbiddenFile,
  credentialFound,
};
console.log(JSON.stringify(report));
if (forbiddenFile || credentialFound) process.exitCode = 1;
