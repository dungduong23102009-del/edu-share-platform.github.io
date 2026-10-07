import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { AnalysisView } from "@/lib/documents/load-analysis";
import { login, testUsers } from "./helpers";
import { docxFixture } from "./fixtures.mjs";
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
test.describe.configure({ retries: 0 });
test("live Gemini and Claude: preserve source answer, solve missing MCQ and calculation, persist and practice without refresh calls", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.RUN_CLAUDE_E2E !== "1",
    "Opt in to real Gemini extraction and Claude solving.",
  );
  test.setTimeout(300000);
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await login(page);
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await client.auth.signInWithPassword(testUsers[0])).error).toBeNull();
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, 1);
  let id: string | undefined;
  try {
    await page.goto("/create");
    await page.locator('input[type="file"]').setInputFiles({
      name: `Claude-live-${randomUUID().slice(0, 8)}.docx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: docxFixture([
        "Ôn tập số học",
        "Câu 1: 2 + 2 = ?",
        "A. 3",
        "B. 5",
        "C. 4",
        "D. 6",
        "Đáp án câu 1: B",
        "Câu 2: 3 + 3 = ?",
        "A. 5",
        "B. 6",
        "C. 7",
        "D. 8",
        "Tài liệu không cung cấp đáp án câu 2.",
        "Câu 3: Tính tổng 2 + 3.",
        "Câu 3 là tự luận, không có đáp án trong tài liệu.",
      ]),
    });
    const uploaded = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/documents") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Tải tài liệu lên" }).click();
    id = (await (await uploaded).json()).id;
    if (typeof id !== "string" || !id)
      throw new Error("Missing uploaded document ID");
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(`/api/documents/${id}/analysis`)
            ).json()
          ).document.status,
        { timeout: 180000, intervals: [1500] },
      )
      .toBe("ready");
    await expect(page).toHaveURL(new RegExp(`/topics\\?documentId=${id}$`));
    const before = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(before.solutions).toHaveLength(3);
    expect(
      before.solutions.filter((item) => item.answer_origin === "source"),
    ).toHaveLength(1);
    const source = before.solutions.find(
      (item) => item.answer_origin === "source",
    )!;
    expect(source.correct_answer).toBe("B");
    expect(source.ai_model).toBeNull();
    expect(source.quiz_ready).toBe(true);
    expect(
      (
        await otherPage.request.post(`/api/documents/${id}/solve`, {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(404);
    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith(`/api/documents/${id}/solve`),
    );
    await page
      .getByRole("button", { name: "Tạo đáp án cho câu còn thiếu" })
      .click();
    expect((await responsePromise).status()).toBe(202);
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(`/api/documents/${id}/analysis`)
            ).json()
          ).solverJob?.status,
        { timeout: 180000, intervals: [2000] },
      )
      .not.toBe("processing");
    const after = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(after.solverJob?.status).toBe("ready");
    expect(after.document.status).toBe("ready");
    expect(after.solutions.every((item) => item.quiz_ready)).toBe(true);
    expect(
      after.solutions.find((item) => item.question_id === source.question_id)
        ?.correct_answer,
    ).toBe("B");
    const mcq = after.solutions.find((item) =>
      item.question_text.includes("3 + 3"),
    )!;
    expect(mcq.answer_origin).toBe("ai_derived");
    expect(mcq.correct_choice).toBe("B");
    expect(mcq.choices).toEqual(["5", "6", "7", "8"]);
    expect(mcq.explanation).toBeTruthy();
    const short = after.solutions.find(
      (item) => item.original_type === "calculation",
    )!;
    expect(short.choices).toHaveLength(4);
    expect(short.answer_origin).toBe("ai_derived");
    expect(
      (short.choices as string[])[short.correct_choice!.charCodeAt(0) - 65]!,
    ).toMatch(/5/);
    const originals = await client
      .from("questions")
      .select("id,correct_answer,answer_origin,choices")
      .eq("document_id", id);
    expect(originals.error).toBeNull();
    expect(
      originals.data
        ?.filter((item) => item.answer_origin === "not_provided")
        .every((item) => item.correct_answer === null),
    ).toBe(true);
    const snapshot = after.solutions.map((item) => ({
      id: item.question_id,
      updated: item.updated_at,
    }));
    expect(
      (
        await page.request.post(`/api/documents/${id}/solve`, {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    const refreshed = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(
      refreshed.solutions.map((item) => ({
        id: item.question_id,
        updated: item.updated_at,
      })),
    ).toEqual(snapshot);
    await expect(
      page.getByRole("button", { name: "Tạo bài trắc nghiệm", exact: true }),
    ).toBeEnabled();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      mkdirSync("logs/claude", { recursive: true });
      await page.screenshot({
        path: `logs/claude/topics-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Tạo bài trắc nghiệm", exact: true })
      .click();
    await expect(page).toHaveURL(/\/setup\?documentId=/);
    await page.getByRole("button", { name: "Bắt đầu 3 câu" }).click();
    await expect(page).toHaveURL(/\/quiz$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(consoleErrors).toEqual([]);
    writeFileSync(
      "logs/claude/live-report.json",
      JSON.stringify(
        {
          sourcePreserved: true,
          mcqSolved: true,
          calculationConverted: true,
          rawQuestionsUnchanged: true,
          refreshIdempotent: true,
          foreignOwnerDenied: true,
          quizStarted: true,
          consoleErrors: consoleErrors.length,
          solved: 2,
        },
        null,
        2,
      ),
    );
  } finally {
    if (id)
      await page.request.delete(`/api/documents/${id}`, {
        headers: { Origin: origin },
      });
    await other.close();
  }
});
