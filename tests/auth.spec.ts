import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { login, testUsers } from "./helpers";

const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";

test("real email login returns cookies without exposing tokens; session survives reload and logout blocks private pages", async ({ page }) => {
  let status = 0;
  let payload: unknown;
  // Forward the real request and read its body before the browser navigates away.
  await page.route("**/api/auth/email", async (route) => {
    const response = await route.fetch();
    status = response.status();
    payload = await response.json();
    await route.fulfill({ response });
  });
  await login(page);
  expect(status).toBe(200);
  expect(payload).toEqual({ success: true, confirmationRequired: false });
  await page.unroute("**/api/auth/email");
  await expect(page.locator(".profile strong")).toHaveText("Kiểm thử A");
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".profile strong")).toHaveText("Kiểm thử A");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("auth endpoint validates origin and bounded input; Supabase returns the actual invalid-credentials code", async ({ request }) => {
  const data = { mode: "login", email: testUsers[0].email, password: "Incorrect-test-password" };
  expect((await request.post("/api/auth/email", { headers: { Origin: "https://example.org" }, data })).status()).toBe(403);
  expect((await request.post("/api/auth/email", { headers: { Origin: origin }, data: { ...data, email: "bad-email" } })).status()).toBe(400);
  expect((await request.post("/api/auth/email", { headers: { Origin: origin }, data: { ...data, password: "x".repeat(5000) } })).status()).toBe(400);
  const response = await request.post("/api/auth/email", { headers: { Origin: origin }, data });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ code: "invalid_credentials", error: "Email hoặc mật khẩu chưa đúng. Nếu chưa có tài khoản, hãy đăng ký trước." });
});

test("signup quota, unconfirmed email and confirmation success display distinct messages without repeated submissions (simulated responses)", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/auth/email", async (route) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ code: "over_email_send_rate_limit", error: "Dịch vụ gửi email đã đạt giới hạn. Vui lòng chờ trước khi đăng ký lại." }) });
  });
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill("ui-only@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("UiOnlyTest123!");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đang xử lý…", exact: true })).toBeDisabled();
  await expect(page.locator(".auth-fields").getByRole("alert")).toContainText("đạt giới hạn");
  expect(calls).toBe(1);
  await page.unroute("**/api/auth/email");
  await page.route("**/api/auth/email", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, confirmationRequired: true }) }));
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("kiểm tra hộp thư");
  await expect(page).toHaveURL(/\/register$/);
  await page.unroute("**/api/auth/email");
  await page.route("**/api/auth/email", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "email_not_confirmed", error: "Hãy xác nhận email trước khi đăng nhập." }) }));
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("ui-only@example.com");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("UiOnlyTest123!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".auth-fields").getByRole("alert")).toContainText("xác nhận email");
});

test("clean Chrome has no hydration errors or extension-injected DOM attributes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  const hydration: string[] = [];
  page.on("console", (message) => {
    if (/hydration|hydrated|server rendered html/i.test(message.text())) hydration.push(message.type());
  });
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("browser-check@example.com");
  const injectedAttributes = await page.evaluate(() => ({
    processed: Array.from(document.body.attributes).filter((attribute) => attribute.name.startsWith("__processed_")).length,
    register: document.body.hasAttribute("bis_register"),
    skinChecked: document.querySelectorAll("[bis_skin_checked]").length,
  }));
  expect(errors).toEqual([]);
  expect(hydration).toEqual([]);
  expect(injectedAttributes).toEqual({ processed: 0, register: false, skinChecked: 0 });
  mkdirSync("logs/auth-fix", { recursive: true });
  writeFileSync("logs/auth-fix/browser-check.json", JSON.stringify({ pageErrors: errors.length, hydrationErrors: hydration.length, injectedAttributes }, null, 2));
  await page.screenshot({ path: "logs/auth-fix/login-clean-chrome.png", fullPage: true });
});
