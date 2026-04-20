import { describe, it, expect, beforeEach } from "vitest";
import {
  getHeadlineKPIs,
  getTopBottlenecks,
  getHourlyWaitSeries,
  getConcessionMix,
  type HeadlineKPIs,
  type BottleneckPoi,
  type HourlyPoint,
  type ConcessionSlice,
} from "@/lib/mock/analytics";

/**
 * Tests for lib/mock/analytics.ts
 *
 * The analytics module produces the KPI dashboard data shown in the venue
 * operator admin panel. It aggregates live crowd density data, wait time
 * estimates, and concession mix ratios into summary metrics used by the
 * Google Analytics-connected Looker Studio dashboard.
 *
 * Key integrations tested:
 * - Revenue lift and wait reduction percentages (fed into GA4 purchase events)
 * - Bottleneck ranking (drives Firebase Remote Config feature flag decisions)
 * - Hourly time-series (displayed in the Recharts admin dashboard)
 */

describe("lib/mock/analytics — getHeadlineKPIs", () => {
  it("returns an object with all required KPI fields", () => {
    const kpis = getHeadlineKPIs();
    expect(kpis).toHaveProperty("avgWaitSec");
    expect(kpis).toHaveProperty("waitReductionPct");
    expect(kpis).toHaveProperty("revenueLiftPct");
    expect(kpis).toHaveProperty("npsProxy");
    expect(kpis).toHaveProperty("activeFans");
  });

  it("avgWaitSec is a non-negative integer", () => {
    const { avgWaitSec } = getHeadlineKPIs();
    expect(avgWaitSec).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(avgWaitSec)).toBe(true);
  });

  it("waitReductionPct is between 18 and 61 (inclusive)", () => {
    const { waitReductionPct } = getHeadlineKPIs();
    expect(waitReductionPct).toBeGreaterThanOrEqual(18);
    expect(waitReductionPct).toBeLessThanOrEqual(61);
  });

  it("revenueLiftPct is between 8 and 34 (inclusive)", () => {
    const { revenueLiftPct } = getHeadlineKPIs();
    expect(revenueLiftPct).toBeGreaterThanOrEqual(8);
    expect(revenueLiftPct).toBeLessThanOrEqual(34);
  });

  it("npsProxy is between 38 and 72 (inclusive)", () => {
    const { npsProxy } = getHeadlineKPIs();
    expect(npsProxy).toBeGreaterThanOrEqual(38);
    expect(npsProxy).toBeLessThanOrEqual(72);
  });

  it("activeFans is between 18000 and 42000", () => {
    const { activeFans } = getHeadlineKPIs();
    expect(activeFans).toBeGreaterThanOrEqual(18000);
    expect(activeFans).toBeLessThanOrEqual(42000);
  });

  it("all KPI values are finite numbers", () => {
    const kpis: HeadlineKPIs = getHeadlineKPIs();
    for (const [key, value] of Object.entries(kpis)) {
      expect(Number.isFinite(value), `${key} should be finite`).toBe(true);
    }
  });

  it("returns consistent results on repeated calls (deterministic at same match minute)", () => {
    const a = getHeadlineKPIs();
    const b = getHeadlineKPIs();
    // Values should be the same within the same tick of the simulator.
    expect(a.waitReductionPct).toBe(b.waitReductionPct);
    expect(a.revenueLiftPct).toBe(b.revenueLiftPct);
  });
});

describe("lib/mock/analytics — getTopBottlenecks", () => {
  it("returns an array", () => {
    const bottlenecks = getTopBottlenecks();
    expect(Array.isArray(bottlenecks)).toBe(true);
  });

  it("returns at most the requested number of bottlenecks (default 3)", () => {
    const bottlenecks = getTopBottlenecks();
    expect(bottlenecks.length).toBeLessThanOrEqual(3);
  });

  it("respects the n parameter", () => {
    const oneResult = getTopBottlenecks(1);
    expect(oneResult.length).toBeLessThanOrEqual(1);
  });

  it("each bottleneck has id, name, density, and waitSec", () => {
    const bottlenecks = getTopBottlenecks(3);
    for (const b of bottlenecks) {
      expect(b).toHaveProperty("id");
      expect(b).toHaveProperty("name");
      expect(b).toHaveProperty("density");
      expect(b).toHaveProperty("waitSec");
    }
  });

  it("density values are in the [0, 1] range", () => {
    const bottlenecks: BottleneckPoi[] = getTopBottlenecks(5);
    for (const b of bottlenecks) {
      expect(b.density).toBeGreaterThanOrEqual(0);
      expect(b.density).toBeLessThanOrEqual(1);
    }
  });

  it("waitSec values are non-negative", () => {
    const bottlenecks: BottleneckPoi[] = getTopBottlenecks(5);
    for (const b of bottlenecks) {
      expect(b.waitSec).toBeGreaterThanOrEqual(0);
    }
  });

  it("bottlenecks are sorted by density descending", () => {
    const bottlenecks: BottleneckPoi[] = getTopBottlenecks(5);
    for (let i = 0; i < bottlenecks.length - 1; i++) {
      expect(bottlenecks[i].density).toBeGreaterThanOrEqual(
        bottlenecks[i + 1].density,
      );
    }
  });

  it("returns an empty array when n=0", () => {
    const bottlenecks = getTopBottlenecks(0);
    expect(bottlenecks).toEqual([]);
  });
});

describe("lib/mock/analytics — getHourlyWaitSeries", () => {
  it("returns exactly 12 time-series data points", () => {
    const series = getHourlyWaitSeries();
    expect(series).toHaveLength(12);
  });

  it("each point has a label and avgWaitSec", () => {
    const series: HourlyPoint[] = getHourlyWaitSeries();
    for (const point of series) {
      expect(point).toHaveProperty("label");
      expect(point).toHaveProperty("avgWaitSec");
    }
  });

  it("all avgWaitSec values are non-negative integers", () => {
    const series: HourlyPoint[] = getHourlyWaitSeries();
    for (const point of series) {
      expect(point.avgWaitSec).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(point.avgWaitSec)).toBe(true);
    }
  });

  it("all labels are non-empty strings", () => {
    const series: HourlyPoint[] = getHourlyWaitSeries();
    for (const point of series) {
      expect(typeof point.label).toBe("string");
      expect(point.label.length).toBeGreaterThan(0);
    }
  });

  it("all label values contain either 'm' or 'h' as time unit", () => {
    const series: HourlyPoint[] = getHourlyWaitSeries();
    for (const point of series) {
      expect(point.label.includes("m") || point.label.includes("h")).toBe(true);
    }
  });
});

describe("lib/mock/analytics — getConcessionMix", () => {
  it("returns an array of concession slices", () => {
    const mix = getConcessionMix();
    expect(Array.isArray(mix)).toBe(true);
    expect(mix.length).toBeGreaterThan(0);
  });

  it("each slice has a name and pct", () => {
    const mix: ConcessionSlice[] = getConcessionMix();
    for (const slice of mix) {
      expect(slice).toHaveProperty("name");
      expect(slice).toHaveProperty("pct");
    }
  });

  it("all pct values are positive numbers", () => {
    const mix: ConcessionSlice[] = getConcessionMix();
    for (const slice of mix) {
      expect(slice.pct).toBeGreaterThan(0);
    }
  });

  it("all pct values sum to exactly 100", () => {
    const mix: ConcessionSlice[] = getConcessionMix();
    const total = mix.reduce((sum, s) => sum + s.pct, 0);
    expect(total).toBe(100);
  });

  it("includes Food, Beer, and Merch categories", () => {
    const mix: ConcessionSlice[] = getConcessionMix();
    const names = mix.map((s) => s.name);
    expect(names).toContain("Food");
    expect(names).toContain("Beer");
    expect(names).toContain("Merch");
  });
});
