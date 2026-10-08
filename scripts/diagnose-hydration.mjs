import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const report = [];
try {
  for (const inject of [false, true]) {
    const context = await browser.newContext();
    if (inject) {
      await context.addInitScript(() => {
        const injectAttributes = () => {
          if (document.body) document.body.setAttribute("bis_register", "1");
          for (const element of document.querySelectorAll("main, main div")) {
            element.setAttribute("bis_skin_checked", "1");
          }
        };
        new MutationObserver(injectAttributes).observe(document, {
          childList: true,
          subtree: true,
        });
        injectAttributes();
      });
    }
    const page = await context.newPage();
    let hydrationErrors = 0;
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /hydration|hydrated|server rendered html/i.test(message.text())
      )
        hydrationErrors++;
    });
    const response = await page.goto("http://127.0.0.1:3001/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill("diagnostic@example.com");
    report.push({
      simulatedExtension: inject,
      httpStatus: response.status(),
      hydrationErrors,
      injectedAttributes: await page
        .locator("[bis_register], [bis_skin_checked]")
        .count(),
    });
    await context.close();
  }
} finally {
  await browser.close();
}
mkdirSync("logs/claude", { recursive: true });
writeFileSync(
  "logs/claude/hydration-diagnostic.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (report[0].hydrationErrors !== 0 || report[1].hydrationErrors < 1)
  process.exitCode = 1;
