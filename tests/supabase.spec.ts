import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { login, testUsers } from "./helpers";
import { docxFixture, pdfFixture } from "./fixtures.mjs";

const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
async function databaseClient(index = 0) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const result = await client.auth.signInWithPassword(testUsers[index]);
  expect(result.error?.code).toBeUndefined();
  return client;
}

test("private routes, login errors, safe callback and registration network failure", async ({
  page,
  request,
}) => {
  for (const path of [
    "/dashboard",
    "/create",
    "/documents",
    "/history",
    "/quiz",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).origin).toBe(origin);
  }
  await page.getByLabel("Email", { exact: true }).fill(testUsers[0].email);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Incorrect-test-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".inline-error")).toContainText(
    "Email hoặc mật khẩu chưa đúng",
  );
  const callback = await request.get(
    "/auth/callback?error=access_denied&next=https://example.org",
    { maxRedirects: 0 },
  );
  expect(callback.status()).toBe(307);
  expect(callback.headers().location).toBe(`${origin}/login?reason=oauth`);
  expect(callback.headers()["cache-control"]).toContain("no-store");
  await page.goto("/register");
  await expect(
    page.getByRole("button", { name: "Tiếp tục với Google" }),
  ).toBeVisible();
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ google: false }),
    }),
  );
  await page.getByRole("button", { name: "Tiếp tục với Google" }).click();
  await expect(page.locator(".inline-error")).toContainText(
    "Google chưa sẵn sàng",
  );
  await page.route("**/api/auth/email", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Không thể tạo tài khoản lúc này. Hãy thử lại sau.",
        code: "network_error",
      }),
    }),
  );
  await page
    .getByLabel("Email", { exact: true })
    .fill("network-test@example.com");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("SafeTestPassword123!");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page.locator(".inline-error")).toContainText(
    "Không thể tạo tài khoản",
  );
  await expect(
    page.getByRole("button", { name: "Tạo tài khoản", exact: true }),
  ).toBeEnabled();
  expect(
    (
      await request.post("/api/documents", { headers: { Origin: origin } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/documents", {
        headers: { Origin: "https://example.org" },
      })
    ).status(),
  ).toBe(403);
});

test("real PDF/DOCX upload, persistence, idempotency, private storage, two-user RLS and deletion", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const clientA = await databaseClient();
  const clientB = await databaseClient(1);
  const names = [
    `Kiểm thử-${randomUUID().slice(0, 8)}.pdf`,
    `Kiểm thử-${randomUUID().slice(0, 8)}.docx`,
  ];
  const uploaded: string[] = [];
  await login(page);
  // This suite verifies upload/storage only; live Gemini extraction has a separate suite.
  await page.route("**/api/documents/*/analyze", (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ status: "processing" }),
    }),
  );
  await expect(page.locator(".profile strong")).toHaveText("Kiểm thử A");
  await expect(page.locator(".avatar")).toHaveText("TA");
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  const userBContext = await browser.newContext();
  const otherPage = await userBContext.newPage();
  try {
    // A renamed HTML file must be rejected by the server before a DB record is created.
    await page.goto("/create");
    await page.locator('input[type="file"]').setInputFiles({
      name: "renamed.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("<html>not a PDF</html>"),
    });
    await page.getByRole("button", { name: "Tải tài liệu lên" }).click();
    await expect(page.locator(".inline-error")).toContainText("PDF hợp lệ");
    for (const [index, name] of names.entries()) {
      await page.goto("/create");
      await page.locator('input[type="file"]').setInputFiles({
        name,
        mimeType:
          index === 0
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: index === 0 ? pdfFixture() : docxFixture(),
      });
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/documents") &&
          response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Tải tài liệu lên" }).click();
      const uploadResponse = await responsePromise;
      expect(await uploadResponse.json()).toMatchObject({
        id: expect.any(String),
      });
      expect(uploadResponse.ok()).toBeTruthy();
      const result: { id: string } = await uploadResponse.json();
      uploaded.push(result.id);
      await expect(page).toHaveURL(/\/processing\?documentId=/);
      await page.goto("/documents?uploaded=1");
      await expect(page.getByRole("status")).toContainText("thành công");
      await expect(
        page.locator(".library-row").filter({ hasText: name }),
      ).toContainText("Đã tải lên");
    }
    await page.reload();
    for (const name of names)
      await expect(
        page.locator(".library-row").filter({ hasText: name }),
      ).toBeVisible();
    await page.goto("/dashboard");
    for (const name of names)
      await expect(page.locator(".document-list")).toContainText(
        name.replace(/\.(pdf|docx)$/, ""),
      );
    // Repeating the same upload ID must return the original record.
    const repeated = await page.request.post("/api/documents", {
      headers: { Origin: origin },
      multipart: {
        document_id: uploaded[0],
        user_id: testUsers[1].id,
        file: {
          name: names[0],
          mimeType: "application/pdf",
          buffer: pdfFixture(),
        },
      },
    });
    expect(repeated.status()).toBe(200);
    expect(await repeated.json()).toEqual({ id: uploaded[0] });
    const ownDocuments = await clientA
      .from("documents")
      .select("*")
      .in("id", uploaded);
    expect(ownDocuments.error).toBeNull();
    expect(ownDocuments.data).toHaveLength(2);
    for (const row of ownDocuments.data!) {
      expect(row.user_id).toBe(testUsers[0].id);
      expect(row.status).toBe("uploaded");
      expect(row.storage_path).toMatch(
        new RegExp(`^${testUsers[0].id}/${row.id}/[a-z0-9-]+\\.(pdf|docx)$`),
      );
      const file = await clientA.storage
        .from("study-documents")
        .download(row.storage_path);
      expect(file.error).toBeNull();
      expect(file.data?.size).toBe(row.file_size);
      expect(
        (
          await clientB.storage
            .from("study-documents")
            .download(row.storage_path)
        ).error,
      ).not.toBeNull();
      const publicURL = clientA.storage
        .from("study-documents")
        .getPublicUrl(row.storage_path).data.publicUrl;
      expect((await page.request.get(publicURL)).ok()).toBeFalsy();
    }
    expect(
      (await clientB.from("documents").select("*").in("id", uploaded)).data,
    ).toEqual([]);
    expect(
      (await clientB.from("profiles").select("*").eq("id", testUsers[0].id))
        .data,
    ).toEqual([]);
    expect(
      (
        await clientB
          .from("documents")
          .update({ original_filename: "wrong.pdf" })
          .eq("id", uploaded[0])
          .select("id")
      ).data,
    ).toEqual([]);
    const wrongInsert = await clientB.from("documents").insert({
      id: randomUUID(),
      user_id: testUsers[0].id,
      original_filename: "wrong.pdf",
      storage_path: ownDocuments.data![0].storage_path,
      mime_type: "application/pdf",
      file_size: 100,
      file_sha256: "0".repeat(64),
    });
    expect(wrongInsert.error?.code).toBe("42501");
    await login(otherPage, 1);
    await otherPage.goto("/documents");
    for (const name of names)
      await expect(otherPage.getByText(name, { exact: true })).toHaveCount(0);
    expect(
      (
        await otherPage.request.get(`/api/documents/${uploaded[0]}/download`, {
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(404);
    await otherPage.request.delete(`/api/documents/${uploaded[0]}`, {
      headers: { Origin: origin },
    });
    expect(
      (await clientA.from("documents").select("id").eq("id", uploaded[0])).data,
    ).toHaveLength(1);
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/documents");
    await expect(page).toHaveURL(/\/login/);
    await login(page);
    await page.goto("/documents");
    for (const name of names)
      await expect(
        page.locator(".library-row").filter({ hasText: name }),
      ).toBeVisible();
    await page
      .getByRole("button", { name: `Xóa ${names[0]}`, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Giữ lại" })
      .click();
    await expect(
      page.getByRole("heading", { name: names[0], exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: `Xóa ${names[0]}`, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Xóa tài liệu", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: names[0], exact: true }),
    ).toHaveCount(0);
    expect(
      (await clientA.from("documents").select("id").eq("id", uploaded[0])).data,
    ).toEqual([]);
    const deletedDocument = ownDocuments.data!.find(
      (document) => document.id === uploaded[0],
    )!;
    expect(
      (
        await clientA.storage
          .from("study-documents")
          .info(deletedDocument.storage_path)
      ).error,
    ).not.toBeNull();
  } finally {
    for (const id of uploaded)
      await page.request.delete(`/api/documents/${id}`, {
        headers: { Origin: origin },
      });
    await userBContext.close();
  }
});

test("auth pages fit phone and desktop screens", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/login", "/register"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: `logs/supabase/${width}-${path.slice(1)}.png`,
        fullPage: true,
      });
    }
  }
});
