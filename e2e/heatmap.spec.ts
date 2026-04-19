import { test, expect } from "@playwright/test";

test.describe("Heatmap + venue map", () => {
  test("renders the venue SVG and POI markers", async ({ page }) => {
    await page.goto("/map");

    await expect(page.getByRole("heading", { name: "Venue Map" })).toBeVisible();

    // The heatmap SVG should mount with at least one POI circle.
    const svg = page.locator("svg").first();
    await expect(svg).toBeVisible();

    const circles = svg.locator("circle");
    await expect.poll(async () => await circles.count()).toBeGreaterThan(5);

    // Density legend should be visible
    await expect(page.getByText("Low")).toBeVisible();
    await expect(page.getByText("Critical")).toBeVisible();
  });

  test("opens the POI detail sheet when a marker is tapped", async ({ page }) => {
    await page.goto("/map");

    const firstPoi = page.locator("svg").first().locator("circle").nth(1);
    await firstPoi.click({ force: true });

    // The POI sheet shows an est. wait + Navigate button
    await expect(page.getByRole("button", { name: /navigate here/i })).toBeVisible();
  });
});
