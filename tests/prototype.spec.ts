import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
});

async function createQuiz(page: Page) {
  await page.goto("/practice");
  await page.getByRole("button", { name: "Chuẩn bị bài mẫu" }).click();
  await expect(page).toHaveURL(/\/processing/);
  await expect(
    page.getByRole("heading", { name: "Đang chuẩn bị bài trắc nghiệm" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/topics/, { timeout: 20000 });
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(page).toHaveURL(/\/setup/);
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(page).toHaveURL(/\/quiz/);
}

test("complete flow: 8/10, review wrong answers, retry only 2 and get 100%", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await createQuiz(page);
  const selections = [0, 1, 1, 3, 0, 1, 3, 3, 0, 1];
  for (let index = 0; index < selections.length; index++) {
    await page.getByRole("radio").nth(selections[index]).click();
    await expect(
      page.getByRole("radio").nth(selections[index]),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Đáp án đúng", { exact: true })).toHaveCount(0);
    if (index === 3) {
      await page.reload();
      await expect(page.getByRole("radio").nth(3)).toHaveAttribute(
        "aria-checked",
        "true",
      );
    }
    if (index < 9) await page.getByRole("button", { name: "Câu tiếp" }).click();
  }
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Nộp bài", exact: true })
    .click();
  await expect(page).toHaveURL(/\/result/);
  await expect(page.locator(".score-ring strong")).toHaveText("8 / 10");
  await expect(page.locator(".score-description > strong")).toHaveText("80%");
  await page.getByRole("link", { name: "Xem đáp án" }).click();
  await page.getByRole("button", { name: /Sai \/ bỏ trống/ }).click();
  await expect(page.locator(".review-card")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Giải thích" })).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "Làm lại 2 câu sai" }).click();
  await expect(page.locator(".question-navigator button")).toHaveCount(2);
  await page.getByRole("radio").nth(2).click();
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await page.getByRole("radio").nth(2).click();
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Nộp bài", exact: true })
    .click();
  await expect(page.locator(".score-ring strong")).toHaveText("2 / 2");
  await expect(page.locator(".score-description > strong")).toHaveText("100%");
  await expect(
    page.getByRole("button", { name: "Làm lại câu sai", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Làm lại toàn bộ" }).click();
  await expect(page).toHaveURL(/\/quiz/);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("validation, failed processing, retry and empty states", async ({
  page,
}) => {
  await page.goto("/create");
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a supported document"),
  });
  await expect(page.locator(".inline-error")).toContainText(
    "Định dạng chưa được hỗ trợ",
  );
  await expect(
    page.getByRole("button", { name: "Tải tài liệu lên" }),
  ).toBeDisabled();
  await page.locator('input[type="file"]').setInputFiles({
    name: "empty.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(""),
  });
  await expect(page.locator(".inline-error")).toContainText(
    "Tài liệu đang trống",
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "Bài học.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 demo document"),
  });
  await expect(page.locator(".selected-file")).toContainText("Bài học.pdf");
  await page.goto("/practice");
  await page.getByText("Công cụ phát triển", { exact: true }).click();
  await page.getByLabel("Mô phỏng lỗi chuẩn bị").check();
  await page.getByRole("button", { name: "Chuẩn bị bài mẫu" }).click();
  await expect(
    page.getByRole("heading", { name: "Chưa thể chuẩn bị bài mẫu" }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page).toHaveURL(/\/topics/, { timeout: 15000 });
  await page.getByLabel("Chọn tất cả", { exact: true }).uncheck();
  await expect(
    page.getByRole("button", { name: "Tiếp tục", exact: true }),
  ).toBeDisabled();
  await page.getByLabel(/Bài tập nhiệt lượng/).check();
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await page.getByLabel(/Câu hỏi trong tài liệu/).uncheck();
  await page.getByLabel(/Câu hỏi bổ sung trong bài mẫu/).uncheck();
  await expect(
    page.getByRole("button", { name: "Bắt đầu làm bài" }),
  ).toBeDisabled();
  await page.getByLabel(/Câu hỏi trong tài liệu/).check();
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  await page.getByLabel("Trộn câu hỏi", { exact: true }).check();
  await page.getByLabel("Trộn đáp án", { exact: true }).check();
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await expect(page.locator(".question-navigator button")).toHaveCount(10);
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("10 câu bỏ trống");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Nộp bài", exact: true })
    .click();
  await expect(page.locator(".score-description > strong")).toHaveText("0%");
  await expect(
    page.getByRole("button", { name: "Làm lại câu sai", exact: true }),
  ).toBeDisabled();
  await page.goto("/settings");
  await page.getByText("Công cụ phát triển", { exact: true }).click();
  await page.getByRole("button", { name: "Thử trạng thái trống" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận" })
    .click();
  await page.goto("/documents");
  await expect(
    page.getByRole("heading", { name: "Chưa có tài liệu" }),
  ).toBeVisible();
  await page.goto("/history");
  await expect(
    page.getByRole("heading", { name: "Chưa có bài trắc nghiệm gần đây" }),
  ).toBeVisible();
});

test("responsive audit: desktop, laptop, tablet, phone", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/history");
  await page.locator(".history-row").first().click();
  await expect(page).toHaveURL(/\/result/);
  await expect(page.locator(".score-ring strong")).toHaveText("8 / 10");
  await page.goto("/practice");
  await page.getByRole("button", { name: "Chuẩn bị bài mẫu" }).click();
  await expect(page).toHaveURL(/\/topics/, { timeout: 15000 });
  for (const width of [1440, 1280, 834, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const path of [
      "/",
      "/create",
      "/documents",
      "/history",
      "/topics",
      "/setup",
      "/quiz",
      "/result",
      "/review",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByText(/Bản trải nghiệm|bản prototype|Prototype sử dụng/),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} overflows at ${width}px`,
      ).toBeTruthy();
      await page.screenshot({
        path: `logs/ui-audit/${width}-${path === "/" ? "dashboard" : path.slice(1)}.png`,
        fullPage: true,
      });
    }
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page
    .getByRole("navigation", { name: "Điều hướng mobile" })
    .getByRole("link", { name: "Tạo bài trắc nghiệm" })
    .click();
  await expect(page).toHaveURL(/\/create/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".button.primary")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("1e-05s");
  await page.goto("/settings");
  await page.getByText("Công cụ phát triển", { exact: true }).click();
  await page.getByRole("button", { name: "Thử trạng thái trống" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận" })
    .click();
  for (const width of [1440, 1280, 834, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const path of ["/", "/documents", "/history", "/result"]) {
      await page.goto(path);
      await expect(page.locator(".empty-state").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      if (path === "/") {
        await expect(page.locator("main .button.primary")).toHaveCount(1);
        expect(
          await page
            .locator(".continue-section .empty-state")
            .evaluate((element) => element.getBoundingClientRect().height),
        ).toBeLessThan(150);
      }
      if (path === "/documents") {
        await expect(
          page.getByRole("textbox", { name: "Tìm tài liệu" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Thêm tài liệu" }),
        ).toHaveCount(1);
      }
      await page.screenshot({
        path: `logs/ui-audit/${width}-${path === "/" ? "dashboard" : path.slice(1)}-empty.png`,
        fullPage: true,
      });
    }
  }
});

test("keyboard selection, navigator, pause and resume preserve progress", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio").nth(1)).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page
    .getByRole("button", { name: "Câu 1, đã trả lời", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Nội năng của một vật",
  );
  await page.getByRole("button", { name: "Thoát", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Thoát", exact: true }).click();
  await page.getByRole("button", { name: "Lưu và thoát" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("study-quiz-ai:milestone-1")!).active
          .startedAt,
    ),
  ).toBe(0);
  await page.reload();
  await expect(page.locator(".continue-metadata")).toContainText("27 / 30");
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await expect(page.getByRole("radio").first()).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page
    .getByRole("button", { name: "Câu 27, đã trả lời", exact: true })
    .click();
  await expect(page.getByRole("radio").nth(1)).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
