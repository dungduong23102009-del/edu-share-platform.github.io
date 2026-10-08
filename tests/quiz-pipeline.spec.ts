import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { QuizView, QuizResult } from "@/lib/quizzes/types";
import { login, testUsers } from "./helpers";
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
test("real quiz snapshots hide keys, preserve source answers, persist progress, grade idempotently, retry and isolate owners", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180000);
  await login(page);
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await client.auth.signInWithPassword(testUsers[0])).error).toBeNull();
  const id = randomUUID();
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await login(other, 1);
  try {
    expect(
      (
        await client.from("documents").insert({
          id,
          user_id: testUsers[0].id,
          original_filename: "Quiz backend synthetic fixture.pdf",
          storage_path: `${testUsers[0].id}/${id}/fixture.pdf`,
          mime_type: "application/pdf",
          file_size: 100,
          file_sha256: "0".repeat(64),
        })
      ).error,
    ).toBeNull();
    const claim = await client.rpc("claim_document_analysis", {
      p_document_id: id,
    });
    expect(claim.error).toBeNull();
    const run = (claim.data as { runId: string }).runId;
    const raw = {
      documentTitle: "Kiểm tra quiz backend",
      documentType: "question_answer",
      language: "vi",
      summary: "Fixture tổng hợp, không phải tài liệu thật.",
      topics: [{ title: "Toán và khoa học", summary: null, sourcePages: [1] }],
      theoryPoints: [],
      warnings: [],
      sourceQuestions: [0, 1, 2, 3].map((i) => ({
        questionText:
          i === 3
            ? "ΔU = A - Q là công thức nào?"
            : `Câu ${i + 1}: 2 + 2 = ?\nA. 3\nB. 5\nC. 4\nD. 6`,
        choices: ["A. 3", "B. 5", "C. 4", "D. 6"],
        explicitAnswer: "B",
        answerOrigin: "source",
        answerSourceExcerpt: "Đáp án: B",
        topicTitle: "Toán và khoa học",
        sourcePage: 1,
        sourceExcerpt: i === 3 ? "ΔU = A + Q" : "2 + 2 = ?",
        confidence: 0.98,
      })),
    };
    expect(
      (
        await client.rpc("complete_document_analysis", {
          p_document_id: id,
          p_run_id: run,
          p_model: "synthetic-test-only",
          p_analysis: raw,
        })
      ).data,
    ).toBe(true);
    await page.goto(`/topics?documentId=${id}`);
    await expect(
      page.getByRole("button", { name: "Tạo bài trắc nghiệm", exact: true }),
    ).toBeEnabled();
    const solutions = (
      await client.from("question_solutions").select("*").eq("document_id", id)
    ).data!;
    expect(solutions.filter((s) => s.quiz_ready)).toHaveLength(3);
    expect(
      solutions.find((s) => s.raw_question_text.includes("ΔU"))?.quiz_ready,
    ).toBe(false);
    expect(
      solutions.every((s) => s.correct_answer === "B" && s.ai_model === null),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Tạo bài trắc nghiệm", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Bắt đầu 3 câu" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Bắt đầu 3 câu" }).click();
    await expect(page).toHaveURL(/\/quiz\?attemptId=/);
    const attemptId = new URL(page.url()).searchParams.get("attemptId")!;
    const initial = await page.request.get(`/api/attempts/${attemptId}`);
    expect(initial.status()).toBe(200);
    expect(initial.headers()["cache-control"]).toContain("no-store");
    const quiz = (await initial.json()) as QuizView;
    expect(JSON.stringify(quiz)).not.toMatch(
      /correctId|correctChoice|correct_answer|explanation/,
    );
    const flight = await page.request.get(`/quiz?attemptId=${attemptId}`);
    expect(await flight.text()).not.toContain("correctId");
    expect(
      (
        await page.request.get(`/api/attempts/${attemptId}?action=result`)
      ).status(),
    ).toBe(409);
    expect(
      (await request.get(`${origin}/api/attempts/${attemptId}`)).status(),
    ).toBe(401);
    expect(
      (await other.request.get(`/api/attempts/${attemptId}`)).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post(`/api/attempts/${attemptId}`, {
          headers: { Origin: "https://foreign.example" },
          data: { answers: {} },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(`/api/attempts/${attemptId}?action=submit`, {
          headers: { Origin: origin },
          data: { answers: {}, score: 100 },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await client
          .from("quiz_attempts")
          .update({ score: 100 })
          .eq("id", attemptId)
      ).error,
    ).not.toBeNull();
    await page.getByRole("radio").nth(1).click();
    await expect(page.getByRole("status")).toHaveText("Đã lưu");
    await page.reload();
    await expect(page.getByRole("radio").nth(1)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("button", { name: "Câu tiếp", exact: true }).click();
    await page.getByRole("radio").nth(0).click();
    await expect(page.getByRole("status")).toHaveText("Đã lưu");
    const answers = {
      [quiz.questions[0].id]: "B",
      [quiz.questions[1].id]: "A",
    };
    const submissions = await Promise.all(
      [0, 1].map(() =>
        page.request.post(`/api/attempts/${attemptId}?action=submit`, {
          headers: { Origin: origin },
          data: { answers },
        }),
      ),
    );
    expect(submissions.map((r) => r.status())).toEqual([200, 200]);
    expect(await submissions[0].json()).toEqual(await submissions[1].json());
    const result = (await (
      await page.request.get(`/api/attempts/${attemptId}?action=result`)
    ).json()) as QuizResult;
    expect([
      result.correct,
      result.incorrect,
      result.unanswered,
      result.percent,
    ]).toEqual([1, 1, 1, 33.33]);
    expect(result.questions.every((q) => q.correctId === "B")).toBe(true);
    expect(
      (
        await client
          .from("quiz_attempts")
          .select("id")
          .eq("quiz_id", quiz.quizId)
      ).data,
    ).toHaveLength(1);
    expect(
      (
        await client
          .from("quiz_answers")
          .select("id")
          .eq("attempt_id", attemptId)
      ).data,
    ).toHaveLength(3);
    await page.goto(`/result?attemptId=${attemptId}`);
    await expect(
      page.getByRole("heading", { name: "Hoàn thành!" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Xem đáp án" }).click();
    await expect(page.locator(".source-badge")).toHaveText([
      "Từ tài liệu",
      "Từ tài liệu",
      "Từ tài liệu",
    ]);
    await page
      .getByRole("button", { name: "Làm lại câu sai / bỏ trống" })
      .click();
    await expect(page).toHaveURL(/\/quiz\?attemptId=/);
    const retryId = new URL(page.url()).searchParams.get("attemptId")!;
    const retry = (await (
      await page.request.get(`/api/attempts/${retryId}`)
    ).json()) as QuizView;
    expect(retry.questions).toHaveLength(2);
    expect(retry.questions.map((q) => q.id)).toEqual(
      quiz.questions.slice(1).map((q) => q.id),
    );
    await page.goto("/history");
    await expect(
      page.getByRole("link").filter({ hasText: "33.33%" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link").filter({ hasText: "Đang làm · Tiếp tục" }),
    ).toBeVisible();
    expect(
      (
        await other.request.get(`/api/attempts/${attemptId}?action=result`)
      ).status(),
    ).toBe(404);
    const otherClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(
      (await otherClient.auth.signInWithPassword(testUsers[1])).error,
    ).toBeNull();
    for (const table of ["quizzes", "quiz_attempts"] as const) {
      expect(
        (
          await otherClient
            .from(table)
            .select("id")
            .eq("id", table === "quizzes" ? quiz.quizId : attemptId)
        ).data,
      ).toEqual([]);
    }
    expect(
      (
        await otherClient
          .from("quiz_answers")
          .select("id")
          .eq("attempt_id", attemptId)
      ).data,
    ).toEqual([]);
    expect(
      (
        await otherClient.rpc("quiz_command", {
          p_action: "load",
          p_id: attemptId,
        })
      ).error?.code,
    ).toBe("P0002");
    const after = (
      await client
        .from("question_solutions")
        .select("ai_model,updated_at")
        .eq("document_id", id)
    ).data!;
    expect(after.map((x) => x.updated_at).sort()).toEqual(
      solutions.map((x) => x.updated_at).sort(),
    );
    // Exercise the actual submit dialog as well as concurrent HTTP submissions.
    await page.goto(`/quiz?attemptId=${retryId}`);
    await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Nộp bài", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/result\\?attemptId=${retryId}`));
    await expect(page.locator(".score-description > strong")).toHaveText("0%");
    // Source re-extraction must not erase historical review or prevent replay.
    expect(
      (await client.from("questions").delete().eq("document_id", id)).error,
    ).toBeNull();
    const historical = (await (
      await page.request.get(`/api/attempts/${attemptId}?action=result`)
    ).json()) as QuizResult;
    expect(historical.questions.map((q) => q.correctId)).toEqual([
      "B",
      "B",
      "B",
    ]);
    const replay = await page.request.post(
      `/api/attempts/${attemptId}?action=retry`,
      {
        headers: { Origin: origin },
        data: { quizId: randomUUID(), mode: "all" },
      },
    );
    expect(replay.status()).toBe(200);
    const replayId = (await replay.json()).attemptId;
    const replayView = (await (
      await page.request.get(`/api/attempts/${replayId}`)
    ).json()) as QuizView;
    expect(replayView.questions).toHaveLength(3);
  } finally {
    await otherContext.close();
    expect(
      (await client.from("documents").delete().eq("id", id)).error,
    ).toBeNull();
  }
});
