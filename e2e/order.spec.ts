import { test, expect } from "@playwright/test";

test.describe("Virtual queue ordering", () => {
  test("lists concessions and places an order", async ({ page }) => {
    await page.goto("/order");
    await expect(page.getByRole("heading", { name: /order food/i })).toBeVisible();

    // Pick the first concession in the list.
    const firstConcession = page.locator("button", { hasText: /items/i }).first();
    await firstConcession.click();

    // Menu should appear; increment the first item.
    const addButtons = page.locator("button", { hasText: /^\+$/ });
    await expect(addButtons.first()).toBeVisible();
    await addButtons.first().click();

    // Place order button in the cart summary.
    const placeOrder = page.getByRole("button", { name: /place order|checkout|pay/i }).first();
    await expect(placeOrder).toBeEnabled();
    await placeOrder.click();

    // A pickup code (4 digits) should appear within 10s.
    await expect
      .poll(async () => await page.getByText(/pickup code/i).count(), { timeout: 10_000 })
      .toBeGreaterThan(0);

    const code = page.locator("p", { hasText: /^\d{4}$/ }).first();
    await expect(code).toBeVisible();
  });
});
