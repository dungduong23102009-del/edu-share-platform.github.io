# Interactive quiz pipeline — 2026-10-08

The document flow now creates a real Supabase quiz and attempt. The existing
`quizzes`, `quiz_attempts` and `quiz_answers` tables are reused. The new
`study_private.quiz_questions` table is the ordered association and immutable
snapshot for each quiz, including its answer key. It is not a replacement
source-question table.

## Behavior and access

- Setup sends document/topic IDs, requested count and shuffle preference.
  The server chooses validated, current-run questions; no answer bank is
  serialized into setup props.
- `/quiz?attemptId=…` receives only question IDs, prompts, choices and saved
  selections. The initial JSON and RSC payload contain no answer keys or
  explanations. The real player uses the existing QuestionCard/styles.
- Progress is saved in Supabase through a serial browser queue. The save
  indicator refers to the latest selection. Failed saves are visible; submit
  also sends the full selection state.
- Submit locks the owned attempt, writes answers and grades against the
  private snapshot in one transaction. A completed attempt is immutable;
  concurrent/double submissions return the same result.
- Correct/incorrect/unanswered counts, percentage and server timestamps are
  authoritative. Client-supplied scores are rejected. Authenticated clients
  cannot directly insert/update/delete quiz, attempt or answer records.
- Review keys/explanations are returned only for a submitted, owned attempt.
  Result and review use attempt IDs; opening an old history entry works.
- Retry wrong includes unanswered questions. Retry all and retry wrong copy
  the stored snapshot into a new quiz/attempt without AI. Historical answers
  survive source re-extraction because quiz answers reference quiz snapshots.
- Public wrappers use SECURITY INVOKER. The private command is SECURITY
  DEFINER solely for immutable snapshots and protected grading writes, with
  an empty search_path, auth.uid() checks and explicit ownership checks on
  every command. Anonymous/PUBLIC execution is revoked. The private table has
  no client grants and an explicit deny policy.
- Analysis/Topics remain the document owner's authoring/review area. This
  milestone protects the initial player payload and authoritative grading;
  document owners still have access to their source analysis data.
- `/history` is real account history, including resumable unfinished attempts.
  The existing demonstration remains available through `/practice`; its
  history uses the explicit development-only `/history?demo=1` route.

## Existing extraction/solver preserved

- Gemini remains the PDF/DOCX extraction provider. Raw extraction/source
  answers are preserved. Source answers are never solved or replaced by AI.
- Fixed configured/returned model: `claude-sonnet-5`. No model fallback.
- Solver still batches up to five questions, two concurrent batches, maximum
  50 questions/run, retaining successful batches and cached solutions.
- Only missing question/choices/topic/relevant theory/excerpt go to Claude.
  Excerpts are bounded to 600 characters. No profile, email, document payload
  or auth tokens enter solver prompts.
- Removed the redundant health-check completion before each solver run after
  the live test encountered a ping timeout. Explicit health diagnostics remain
  available; actual solve errors still fail safely, with no quota retry spam.
- AI eligibility requires confidence >= 0.85. Confidence below that is kept
  for review, not automatically quizzed. Source extraction retains the existing
  >= 0.65 threshold and review flag below 0.85. Policy is centralized in
  `SOLVER_SETTINGS` and enforced again by the quiz-creation transaction.
- Normalization preserves raw text, matching choice positions, scientific
  case, signs, Unicode, quantities and units. Replacement/control characters
  and unresolved image dependencies now prevent automatic quiz eligibility.

## Verification

- Lint/typecheck: pass.
- Unit tests: 20 pass, including corrupt formula/image/confidence rejection.
- Default Chrome E2E: 14 pass / 2 paid AI tests explicitly skipped.
- Expanded backend test: pass after final save queue change; exercises actual
  submit dialog, refresh persistence, hidden initial keys, 1 correct / 1 wrong /
  1 unanswered = 33.33%, double submit, server-only scoring writes, review,
  retry wrong/all, re-extraction and two-owner Data API/RPC/API isolation.
- Live Gemini + Sonnet 5 E2E: pass after removing the redundant ping. Actual
  reported solver model `claude-sonnet-5`; 2 questions in one batch, 2092 input
  tokens + 174 output tokens. Refresh/start/retry do not call the solver again.
- Clean Chrome hydration test: pass. No suppressHydrationWarning and no
  extension/profile modifications.
- Production build: pass (Next.js 16.3.8, including TypeScript).
- Secret scan: 48 production client files checked; no Gemini/Claude key found.
  `.env.local` remains ignored and untracked.
- After build, the development server was restarted on port 3001. Final smoke:
  2 pass (real quiz pipeline and clean Chrome hydration). Staged secret scan:
  28 files checked, no secret or forbidden env file.
- Supabase security advisors: no new database findings. Existing Auth leaked
  password protection warning remains; Auth configuration was not changed.
  [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Supabase performance advisors: no findings.

## Requested current document — pending identification

Target: **BÀI 3: NGUYÊN LÝ I NHIỆT ĐỘNG LỰC HỌC**.
Bounded title/filename searches in the configured Supabase project did not
find this document. Its Topics URL/document ID has been requested. No other
private document was processed as a substitute. All seven counts for this
specific document remain **unverified**, not zero.

The successful live fixture was a generated, small DOCX **Ôn tập số học**:

| Metric | Live fixture only |
|---|---:|
| Total extracted questions | 3 |
| Source-answer questions | 1 |
| AI-solved questions | 2 |
| Generated MCQs | 1 |
| Uncertain questions | 0 |
| Rejected questions | 0 |
| Quiz-ready questions | 3 |

These are **not** the user's thermodynamics document counts. The fixture
created a real quiz; fixture documents/quiz records were cleaned up afterward.
Final current-document verification is still required to declare the whole
milestone complete.

## Migrations

Applied remote versions match the three committed local migration files:
`20261008093547_interactive_quiz_pipeline`,
`20261008094044_harden_quiz_command_validation`,
`20261008094455_explicit_private_quiz_policy`.
Generated TypeScript types reflect the remote schema. CLI migration creation
was attempted but failed because CLI telemetry tried to write outside the
project. Connector migration history was used, with no global filesystem or
system configuration changes.
