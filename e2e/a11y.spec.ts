import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility audit across the critical fan surfaces. We assert
 * that no `serious` or `critical` violations exist against WCAG 2.2 AA.
 * `minor` / `moderate` violations are tracked manually in docs/ACCESSIBILITY.md
 * and triaged per-surface.
 */
const SURFACES = [
  { name: "landing", path: "/" },
  { name: "map", path: "/map" },
  { name: "concierge", path: "/concierge" },
  { name: "order", path: "/order" },
] as const;

for (const surface of SURFACES) {
  test(`a11y: ${surface.name} has no serious/critical violations`, async ({ page }) => {
    await page.goto(surface.path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    if (blocking.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `[a11y:${surface.name}] blocking violations:\n` +
          blocking
            .map(
              (v) =>
                `  - ${v.id} (${v.impact}): ${v.help}\n    ${v.helpUrl}\n    nodes: ${v.nodes
                  .slice(0, 3)
                  .map((n) => n.target.join(" "))
                  .join(", ")}`,
            )
            .join("\n"),
      );
    }

    expect(blocking).toEqual([]);
  });
}
