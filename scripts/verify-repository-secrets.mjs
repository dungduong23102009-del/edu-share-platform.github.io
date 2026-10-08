import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Never print matched text, environment values, git object contents or raw errors.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const root = process.cwd();
const git = (...args) => {
  const result = spawnSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...args],
    {
      cwd: root,
      maxBuffer: 128 * 1024 * 1024,
    },
  );
  if (result.status !== 0) throw new Error("Git inspection failed");
  return result.stdout;
};
const known = Object.entries(process.env)
  .filter(
    ([name, value]) =>
      /KEY|SECRET|PASSWORD|TOKEN/i.test(name) &&
      (!name.startsWith("NEXT_PUBLIC_") || /SERVICE_ROLE|SECRET/i.test(name)) &&
      typeof value === "string" &&
      value.trim().length >= 8,
  )
  .map(([, value]) => Buffer.from(value.trim()));
const patterns = [
  ["google_api_key", /AIza[0-9A-Za-z_-]{35}/g],
  ["supabase_secret_key", /sb_secret_[0-9A-Za-z_-]{20,}/g],
  ["provider_secret_key", /\bsk-(?:ant-|proj-|svcacct-)?[0-9A-Za-z_-]{20,}/g],
  [
    "github_token",
    /\b(?:gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{40,})/g,
  ],
  [
    "private_key",
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g,
  ],
];
const found = new Set();
let knownCredentialFound = false;
function scan(buffer) {
  if (known.some((value) => buffer.includes(value)))
    knownCredentialFound = true;
  const text = buffer.toString("utf8");
  for (const [name, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) found.add(name);
  }
  for (const token of text.match(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  ) || []) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
      );
      if (payload.role === "service_role")
        found.add("supabase_service_role_jwt");
      if (payload.role === "authenticated" && payload.session_id)
        found.add("supabase_user_access_token");
    } catch {
      /* Source placeholders are not real JWTs. */
    }
  }
}
const forbidden = (path) =>
  (/(^|\/)\.env(?:$|\.)/.test(path) && path !== ".env.example") ||
  /(^|\/)(?:secrets|\.secrets|credentials|\.credentials)\//.test(path) ||
  /\.(?:pem|key|p12|pfx|secret|secrets)$/.test(path);
try {
  const commits = git("rev-list", "--all")
    .toString("utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  let forbiddenTrackedFiles = false;
  for (const commit of commits) {
    const paths = git("ls-tree", "-r", "--name-only", "-z", commit)
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
    if (paths.some(forbidden)) forbiddenTrackedFiles = true;
  }
  const objects = git("rev-list", "--objects", "--all")
    .toString("utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(" ")[0]);
  const batch = spawnSync(
    "git",
    [
      "-c",
      `safe.directory=${root.replaceAll("\\", "/")}`,
      "cat-file",
      "--batch",
    ],
    {
      cwd: root,
      input: objects.join("\n") + "\n",
      maxBuffer: 128 * 1024 * 1024,
    },
  );
  if (batch.status !== 0) throw new Error("Object inspection failed");
  let offset = 0,
    checked = 0;
  while (offset < batch.stdout.length) {
    const end = batch.stdout.indexOf(10, offset);
    if (end < 0) throw new Error("Invalid object framing");
    const parts = batch.stdout
      .subarray(offset, end)
      .toString("ascii")
      .split(" ");
    const size = Number(parts[2]);
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      end + 1 + size >= batch.stdout.length
    )
      throw new Error("Invalid object size");
    scan(batch.stdout.subarray(end + 1, end + 1 + size));
    offset = end + 1 + size + 1;
    checked++;
  }
  if (checked !== objects.length)
    throw new Error("Incomplete object inspection");
  const current = git(
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  for (const path of current) {
    if (forbidden(path)) forbiddenTrackedFiles = true;
    if (existsSync(path)) scan(readFileSync(path));
  }
  const ignored = spawnSync(
    "git",
    [
      "-c",
      `safe.directory=${root.replaceAll("\\", "/")}`,
      "check-ignore",
      "--quiet",
      "--",
      ".env.local",
    ],
    { cwd: root },
  );
  const localEnvIgnored = ignored.status === 0;
  const localEnvTracked = git("ls-files", "--", ".env.local").length > 0;
  const ok =
    localEnvIgnored &&
    !localEnvTracked &&
    !forbiddenTrackedFiles &&
    !knownCredentialFound &&
    found.size === 0;
  console.log(
    JSON.stringify({
      ok,
      commitsChecked: commits.length,
      objectsChecked: checked,
      currentFilesChecked: current.length,
      localEnvIgnored,
      localEnvTracked,
      forbiddenTrackedFiles,
      knownCredentialFound,
      secretPatternsFound: [...found],
    }),
  );
  if (!ok) process.exitCode = 1;
} catch {
  console.log(
    JSON.stringify({
      ok: false,
      error: "Repository secret inspection could not complete",
    }),
  );
  process.exitCode = 1;
}
