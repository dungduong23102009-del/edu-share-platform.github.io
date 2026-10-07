import { readFileSync, existsSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
export interface TestUser {
  email: string;
  password: string;
  id: string;
}
export const testUsers: TestUser[] = existsSync("logs/test-users.json")
  ? JSON.parse(readFileSync("logs/test-users.json", "utf8"))
  : ["A", "B"].map((label) => ({
      email: process.env[`E2E_EMAIL_${label}`] || "",
      password: process.env[`E2E_PASSWORD_${label}`] || "",
      id: process.env[`E2E_USER_ID_${label}`] || "",
    }));
export async function login(page: Page, index = 0) {
  if (!testUsers[index].email || !testUsers[index].password)
    throw new Error(
      "Cần hai tài khoản test riêng: E2E_EMAIL_A/B, E2E_PASSWORD_A/B và E2E_USER_ID_A/B trong env local.",
    );
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(testUsers[index].email);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(testUsers[index].password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
}
