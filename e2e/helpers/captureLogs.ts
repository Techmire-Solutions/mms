import type { Page } from "@playwright/test";

export function capturePageLogs(page: Page) {
  page.on("console", (msg) => console.log(`BROWSER LOG [${msg.type()}]: ${msg.text()}`));
  page.on("pageerror", (err) => console.log(`BROWSER ERROR: ${err.message}`));
}
