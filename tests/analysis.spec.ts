import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { login, testUsers } from "./helpers";
import {
  theoryPDF,
  questionsPDF,
  theoryDOCX,
  corruptDOCX,
} from "./analysis-fixtures.mjs";
import type { AnalysisView } from "@/lib/documents/load-analysis";
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const docxMime =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
test.describe.configure({ retries: 0 });

async function upload(page: Page, name: string, buffer: Buffer) {
  await page.goto("/create");
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: name.endsWith(".pdf") ? "application/pdf" : docxMime,
    buffer,
  });
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/documents") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Tải tài liệu lên" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  return (await response.json()).id as string;
}

test("live Gemini: PDF theory, PDF source answers and Vietnamese DOCX persist with no analysis on refresh", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.RUN_GEMINI_E2E !== "1",
    "Opt in to three real document analyses with RUN_GEMINI_E2E=1.",
  );
  test.setTimeout(600000);
  await login(page);
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await client.auth.signInWithPassword(testUsers[0])).error).toBeNull();
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await login(otherPage, 1);
  const owned: string[] = [];
  const reports: object[] = [];
  try {
    for (const [kind, bytes, extension] of [
      ["pdf-theory", theoryPDF(), "pdf"],
      ["pdf-answers", questionsPDF(), "pdf"],
      ["docx-theory", theoryDOCX(), "docx"],
    ] as const) {
      const id = await upload(
        page,
        `Gemini-${kind}-${randomUUID().slice(0, 8)}.${extension}`,
        bytes,
      );
      owned.push(id);
      await expect(page).toHaveURL(/\/processing\?documentId=/);
      // Extra POST while processing cannot start a duplicate run.
      expect(
        (
          await page.request.post(`/api/documents/${id}/analyze`, {
            headers: { Origin: origin },
          })
        ).status(),
      ).toBe(202);
      const foreign = await otherPage.request.post(
        `/api/documents/${id}/analyze`,
        { headers: { Origin: origin } },
      );
      expect(foreign.status()).toBe(404);
      expect(
        (await otherPage.request.get(`/api/documents/${id}/analysis`)).status(),
      ).toBe(404);
      await expect
        .poll(
          async () =>
            (
              await (
                await page.request.get(`/api/documents/${id}/analysis`)
              ).json()
            ).document.status,
          { timeout: 210000, intervals: [1500] },
        )
        .not.toBe("processing");
      expect(
        (await (await page.request.get(`/api/documents/${id}/analysis`)).json())
          .document.status,
      ).toBe("ready");
      await expect(page).toHaveURL(new RegExp(`/topics\\?documentId=${id}$`), {
        timeout: 210000,
      });
      const response = await page.request.get(`/api/documents/${id}/analysis`);
      expect(response.ok()).toBeTruthy();
      const view = (await response.json()) as AnalysisView;
      expect(view.document.status).toBe("ready");
      expect(view.topics.length).toBeGreaterThan(0);
      const analysis = view.analysis!;
      const stored = await client
        .from("document_analyses")
        .select("current_run_id, updated_at")
        .eq("document_id", id)
        .single();
      expect(stored.error).toBeNull();
      if (kind === "pdf-answers") {
        expect(analysis.sourceQuestions).toHaveLength(2);
        const first = analysis.sourceQuestions.find((question) =>
          question.questionText.includes("2 + 2"),
        )!;
        const second = analysis.sourceQuestions.find((question) =>
          question.questionText.includes("3 + 3"),
        )!;
        expect(first.explicitAnswer).toBe("B");
        expect(first.answerOrigin).toBe("source");
        expect(first.sourcePage).toBe(1);
        expect(first.answerSourceExcerpt).toBeTruthy();
        expect(second.explicitAnswer).toBeNull();
        expect(second.answerOrigin).toBe("not_provided");
        const questions = await client
          .from("questions")
          .select("correct_answer, answer_origin, source_page")
          .eq("document_id", id)
          .eq("analysis_run_id", stored.data!.current_run_id);
        expect(questions.error).toBeNull();
        expect(questions.data).toHaveLength(2);
        expect(
          questions.data?.some(
            (question) =>
              question.correct_answer === "B" &&
              question.answer_origin === "source",
          ),
        ).toBeTruthy();
      } else {
        expect(analysis.theoryPoints.length).toBeGreaterThan(0);
        expect(analysis.sourceQuestions).toHaveLength(0);
      }
      if (extension === "docx") {
        expect(
          analysis.theoryPoints.every((item) => item.sourcePage === null),
        ).toBeTruthy();
        expect(
          analysis.topics.every((item) => !item.sourcePages.length),
        ).toBeTruthy();
        expect(analysis.warnings.join(" ")).toContain("Word");
      }
      const repeated = await page.request.post(`/api/documents/${id}/analyze`, {
        headers: { Origin: origin },
      });
      expect(repeated.status()).toBe(200);
      expect(await repeated.json()).toEqual({ status: "ready" });
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name: `Hệ thống tìm thấy ${view.topics.length} chủ đề`,
        }),
      ).toBeVisible();
      expect(
        (
          await client
            .from("document_analyses")
            .select("current_run_id, updated_at")
            .eq("document_id", id)
            .single()
        ).data,
      ).toEqual(stored.data);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        mkdirSync("logs/gemini", { recursive: true });
        await page.screenshot({
          path: `logs/gemini/${kind}-${width}.png`,
          fullPage: true,
        });
      }
      reports.push({
        kind,
        topics: analysis.topics.length,
        questions: analysis.sourceQuestions.length,
        theoryPoints: analysis.theoryPoints.length,
        persisted: true,
        refreshIdempotent: true,
        foreignOwnerDenied: true,
      });
    }
    writeFileSync(
      "logs/gemini/analysis-report.json",
      JSON.stringify(reports, null, 2),
    );
  } finally {
    for (const id of owned)
      await page.request.delete(`/api/documents/${id}`, {
        headers: { Origin: origin },
      });
    await otherContext.close();
  }
});

test("corrupt DOCX fails without Gemini generation; explicit retry, guards and stale processing recovery work", async ({
  page,
  request,
}) => {
  test.skip(
    !process.env.GEMINI_API_KEY,
    "Server configuration needed to exercise document processing.",
  );
  await login(page);
  let id: string | undefined;
  try {
    id = await upload(
      page,
      `Corrupt-${randomUUID().slice(0, 8)}.docx`,
      corruptDOCX(),
    );
    await expect(
      page.getByRole("heading", { name: "Không thể phân tích tài liệu này." }),
    ).toBeVisible();
    const before = await page.request.get(`/api/documents/${id}/analysis`);
    const beforeView = (await before.json()) as AnalysisView;
    expect(beforeView.document.status).toBe("failed");
    expect(beforeView.analysis).toBeNull();
    expect(["corrupt_document", "empty_document"]).toContain(
      beforeView.document.analysis_error,
    );
    await page.reload();
    const afterView = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(afterView.document.analysis_started_at).toBe(
      beforeView.document.analysis_started_at,
    );
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(`/api/documents/${id}/analysis`)
            ).json()
          ).document.analysis_started_at,
      )
      .not.toBe(beforeView.document.analysis_started_at);
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(`/api/documents/${id}/analysis`)
            ).json()
          ).document.status,
      )
      .toBe("failed");
    expect(
      (
        await request.post(`/api/documents/${id}/analyze`, {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.post(`/api/documents/${id}/analyze`, {
          headers: { Origin: "https://example.org" },
        })
      ).status(),
    ).toBe(403);
    const client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(
      (await client.auth.signInWithPassword(testUsers[0])).error,
    ).toBeNull();
    await client
      .from("documents")
      .update({
        status: "processing",
        analysis_stage: "reading",
        analysis_run_id: randomUUID(),
        analysis_expires_at: new Date(Date.now() - 60000).toISOString(),
      })
      .eq("id", id);
    const stale = (await (
      await page.request.get(`/api/documents/${id}/analysis`)
    ).json()) as AnalysisView;
    expect(stale.document.status).toBe("failed");
    expect(stale.document.analysis_error).toBe("timeout");
  } finally {
    if (id)
      await page.request.delete(`/api/documents/${id}`, {
        headers: { Origin: origin },
      });
  }
});
