import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AnalysisView } from "@/lib/documents/load-analysis";
import { login, testUsers } from "./helpers";
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
test("43 source answers need no Claude; pagination, ownership and gateway failure preserve Gemini extraction", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120000);
  await login(page);
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await client.auth.signInWithPassword(testUsers[0])).error).toBeNull();
  const id = randomUUID();
  const context = await browser.newContext();
  const other = await context.newPage();
  await login(other, 1);
  const otherClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect(
    (await otherClient.auth.signInWithPassword(testUsers[1])).error,
  ).toBeNull();
  try {
    expect(
      (
        await client.from("documents").insert({
          id,
          user_id: testUsers[0].id,
          original_filename: "Solver guard synthetic fixture.pdf",
          storage_path: `${testUsers[0].id}/${id}/fixture.pdf`,
          mime_type: "application/pdf",
          file_size: 100,
          file_sha256: "0".repeat(64),
        })
      ).error,
    ).toBeNull();
    const claimed = await client.rpc("claim_document_analysis", {
      p_document_id: id,
    });
    expect(claimed.error).toBeNull();
    const run = (claimed.data as { runId: string }).runId;
    const rawQuestion = "2 + 2 = ?\nA. 3\nB. 5\nC. 4\nD. 6";
    const payload = {
      documentTitle: "Kiểm tra solver",
      documentType: "question_answer",
      language: "vi",
      summary: "Fixture tổng hợp kiểm tra ownership và fallback.",
      topics: [{ title: "Số học", summary: null, sourcePages: [1] }],
      sourceQuestions: [
        {
          questionText: rawQuestion,
          choices: ["A. 3", "B. 5", "C. 4", "D. 6"],
          explicitAnswer: "B",
          answerOrigin: "source",
          answerSourceExcerpt: "Đáp án: B",
          topicTitle: "Số học",
          sourcePage: 1,
          sourceExcerpt: "2 + 2 = ?",
          confidence: 0.98,
        },
      ],
      theoryPoints: [],
      warnings: [],
    };
    expect(
      (
        await client.rpc("complete_document_analysis", {
          p_document_id: id,
          p_run_id: run,
          p_model: "synthetic-test-only",
          p_analysis: payload,
        })
      ).data,
    ).toBe(true);
    const topic = (
      await client.from("topics").select("id").eq("document_id", id).single()
    ).data!;
    expect(
      (
        await client.from("questions").insert(
          Array.from({ length: 42 }, (_, index) => ({
            document_id: id,
            analysis_run_id: run,
            topic_id: topic.id,
            question_text: `Câu ${index + 2}: 2 + 2 = ?`,
            choices: ["3", "5", "4", "6"],
            correct_answer: "B",
            answer_origin: "source",
            extraction_confidence: 0.98,
          })),
        )
      ).error,
    ).toBeNull();
    const legacy = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    const legacySource = legacy.sourceQuestions.find(
      (item) => item.question_text === rawQuestion,
    )!;
    expect(
      (
        await client
          .from("question_solutions")
          .update({
            question_text: rawQuestion,
            quiz_ready: false,
            needs_review: true,
          })
          .eq("question_id", legacySource.id)
      ).error,
    ).toBeNull();
    await page.goto(`/topics?documentId=${id}`);
    await page.getByText("Xem câu hỏi nguồn (43)", { exact: true }).click();
    expect(await page.locator(".analysis-item").count()).toBe(10);
    await page.getByRole("button", { name: "Trang sau" }).click();
    expect(await page.locator(".analysis-item").count()).toBe(10);
    const before = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(
      before.solutions.every(
        (item) =>
          item.quiz_ready &&
          item.answer_origin === "source" &&
          item.correct_answer === "B" &&
          item.ai_model === null,
      ),
    ).toBe(true);
    expect(
      before.solutions.find((item) => item.question_id === legacySource.id)
        ?.question_text,
    ).toBe("2 + 2 = ?");
    const foreignSolutions = await otherClient
      .from("question_solutions")
      .select("question_id")
      .eq("document_id", id);
    expect(foreignSolutions.error).toBeNull();
    expect(foreignSolutions.data).toEqual([]);
    expect(
      (await otherClient.rpc("claim_document_solver_v2", { p_document_id: id }))
        .data,
    ).toEqual({ action: "not_found" });
    expect(
      (
        await page.request.post(`/api/documents/${id}/solve`, {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await client
          .from("document_solver_jobs")
          .select("document_id")
          .eq("document_id", id)
      ).data,
    ).toEqual([]);
    expect(
      (
        await other.request.post(`/api/documents/${id}/solve`, {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post(`/api/documents/${id}/solve`, {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post(`/api/documents/${id}/solve`, {
          headers: { Origin: "https://example.org" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(`/api/documents/${id}/solve`, {
          headers: { Origin: origin },
          data: "x".repeat(1025),
        })
      ).status(),
    ).toBe(400);
    await page.reload();
    const refreshed = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(refreshed.solutions.map((item) => item.updated_at)).toEqual(
      before.solutions.map((item) => item.updated_at),
    );
    const missing = randomUUID();
    expect(
      (
        await client.from("questions").insert({
          id: missing,
          document_id: id,
          analysis_run_id: run,
          topic_id: topic.id,
          question_text: "Tính 2 + 3.",
          choices: ["4", "5"],
          correct_answer: null,
          answer_origin: "not_provided",
          extraction_confidence: 0.98,
        })
      ).error,
    ).toBeNull();
    await page.request.get(`/api/documents/${id}/analysis`);
    expect(
      (
        await client
          .from("question_solutions")
          .update({ solver_status: "unsupported" })
          .eq("question_id", missing)
      ).error,
    ).toBeNull();
    const promoted = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(
      promoted.solutions.find((item) => item.question_id === missing)
        ?.solver_status,
    ).toBe("pending");
    const job = await client.rpc("claim_document_solver_v2", {
      p_document_id: id,
    });
    expect(job.error).toBeNull();
    const foreignJobs = await otherClient
      .from("document_solver_jobs")
      .select("document_id")
      .eq("document_id", id);
    expect(foreignJobs.error).toBeNull();
    expect(foreignJobs.data).toEqual([]);
    const solverRun = (job.data as { runId: string; questionIds: string[] })
      .runId;
    expect((job.data as { questionIds: string[] }).questionIds).toEqual([
      missing,
    ]);
    expect(
      (await client.rpc("claim_document_solver_v2", { p_document_id: id }))
        .data,
    ).toEqual({ action: "busy" });
    expect(
      (
        await client.rpc("complete_question_solutions_v2", {
          p_document_id: id,
          p_run_id: randomUUID(),
          p_model: "synthetic-test-only",
          p_results: [],
        })
      ).data,
    ).toBe(0);
    expect(
      (
        await client.rpc("finish_document_solver", {
          p_document_id: id,
          p_run_id: solverRun,
          p_error: "gateway_unavailable",
        })
      ).error,
    ).toBeNull();
    const failed = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(failed.document.status).toBe("ready");
    expect(failed.analysis).toEqual(before.analysis);
    expect(
      failed.solutions.find((item) => item.question_id === missing)
        ?.solver_status,
    ).toBe("solver_failed");
    await page.reload();
    await expect(
      page.getByText("Chưa thể tạo đáp án cho một số câu hỏi.", {
        exact: false,
      }),
    ).toBeVisible();
    expect(
      (await other.request.get(`/api/documents/${id}/analysis`)).status(),
    ).toBe(404);
    const retried = await client.rpc("claim_document_solver_v2", {
      p_document_id: id,
    });
    const retryRun = (retried.data as { runId: string }).runId;
    const partialResult = {
      id: missing,
      choices: ["4", "5", "6", "7"],
      correctChoice: "B",
      answerText: "5",
      explanation: "2+3 bằng 5.",
      confidence: 0.95,
      status: "solved",
      quizReady: true,
      needsReview: false,
    };
    const changedSource = await client.rpc("complete_question_solutions_v2", {
      p_document_id: id,
      p_run_id: retryRun,
      p_model: "synthetic-test-only",
      p_results: [{ ...partialResult, choices: ["5", "4", "6", "7"] }],
    });
    expect(changedSource.error?.code).toBe("23514");
    const completed = await client.rpc("complete_question_solutions_v2", {
      p_document_id: id,
      p_run_id: retryRun,
      p_model: "synthetic-test-only",
      p_results: [partialResult],
    });
    expect(completed.error).toBeNull();
    expect(completed.data).toBe(1);
    expect(
      (
        await client.rpc("finish_document_solver", {
          p_document_id: id,
          p_run_id: retryRun,
        })
      ).error,
    ).toBeNull();
    const saved = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    const solved = saved.solutions.find(
      (item) => item.question_id === missing,
    )!;
    expect(solved.choices).toEqual(["4", "5", "6", "7"]);
    expect(solved.answer_origin).toBe("ai_derived");
    expect(solved.quiz_ready).toBe(true);
    expect(
      (
        await client.rpc("claim_document_solver_v2", {
          p_document_id: id,
          p_regenerate: true,
        })
      ).data,
    ).toEqual({ action: "ready" });
    expect(
      (
        await page.request.post(`/api/documents/${id}/solve`, {
          headers: { Origin: origin },
          data: { regenerate: true },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.post(`/api/documents/${id}/solve`, {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    const cached = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(
      cached.solutions.find((item) => item.question_id === missing)?.updated_at,
    ).toBe(solved.updated_at);
    await page
      .getByRole("button", { name: "Tạo bài trắc nghiệm", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/setup\\?documentId=${id}`));
  } finally {
    expect(
      (
        await client
          .from("documents")
          .delete()
          .eq("id", id)
          .eq("user_id", testUsers[0].id)
      ).error,
    ).toBeNull();
    await context.close();
  }
});
