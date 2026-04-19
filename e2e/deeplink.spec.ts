import { test, expect } from "@playwright/test";

test.describe("Deep-link routing", () => {
  test("/map?nav=food-beer auto-activates a route", async ({ page }) => {
    await page.goto("/map?nav=food-beer");

    // The ETA chip appears when a route is active.
    await expect(page.getByText(/navigating to/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/walk$/i)).toBeVisible();

    // Clear route button should be present.
    await expect(page.getByRole("button", { name: /clear route/i })).toBeVisible();
  });

  test("clearing the route removes the nav query param", async ({ page }) => {
    await page.goto("/map?nav=food-beer");
    await page.getByRole("button", { name: /clear route/i }).click();
    await expect(page).toHaveURL(/\/map$/);
  });
});
