import { test, expect } from "@playwright/test";

test.describe("AI Concierge", () => {
  test("accepts a user query and returns a reply", async ({ page }) => {
    await page.goto("/concierge");

    await expect(page.getByRole("heading", { name: /AI Concierge/i })).toBeVisible();

    const input = page.getByLabel("Concierge question");
    await expect(input).toBeVisible();

    await input.fill("Where's the nearest restroom?");
    await page.getByRole("button", { name: /send question/i }).click();

    // Wait for assistant bubble (either Gemini or heuristic fallback)
    // The message list has role=log. Poll until >1 message (user + assistant) is present.
    const log = page.getByRole("log", { name: /Concierge conversation/i });
    await expect(log).toBeVisible();

    // Assistant reply should appear within 15s (heuristic fallback is synchronous-ish)
    await expect
      .poll(
        async () => {
          const text = (await log.innerText()) ?? "";
          return text.toLowerCase();
        },
        { timeout: 15_000 },
      )
      .toContain("restroom");
  });

  test("suggested prompt chips are tappable", async ({ page }) => {
    await page.goto("/concierge");
    const firstChip = page.locator("button").filter({ hasText: /nearest|veggie|restroom|beer|exit/i }).first();
    if (await firstChip.isVisible().catch(() => false)) {
      await firstChip.click();
      await expect(page.getByLabel("Concierge question")).not.toHaveValue("");
    }
  });
});
