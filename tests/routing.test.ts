import { describe, it, expect } from "vitest";
import { shortestPath } from "@/lib/routing/dijkstra";
import type { VenueGraph } from "@/lib/schemas/graph";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_SPEED = 12;
const DEFAULT_ROUND_TO = 5;

/** Build a tiny 4-node diamond graph: A → B → D and A → C → D, equal weights. */
function diamond(): VenueGraph {
  return {
    nodes: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 10, y: 0 },
      { id: "C", x: 0, y: 10 },
      { id: "D", x: 10, y: 10 },
    ],
    edges: [
      { from: "A", to: "B", weight: 10 },
      { from: "A", to: "C", weight: 10 },
      { from: "B", to: "D", weight: 10 },
      { from: "C", to: "D", weight: 10 },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("shortestPath (Dijkstra with crowd weighting)", () => {
  it("returns a direct edge when it's the shortest route", () => {
    const graph: VenueGraph = {
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 1, y: 0 },
      ],
      edges: [{ from: "A", to: "B", weight: 1 }],
    };
    const result = shortestPath(graph, "A", "B", {}, DEFAULT_SPEED, DEFAULT_ROUND_TO);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["A", "B"]);
    expect(result!.totalWeight).toBe(1);
  });

  it("returns null when no path exists", () => {
    const graph: VenueGraph = {
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 1, y: 0 },
        { id: "C", x: 2, y: 0 },
      ],
      edges: [{ from: "A", to: "B", weight: 1 }],
    };
    const result = shortestPath(graph, "A", "C", {}, DEFAULT_SPEED, DEFAULT_ROUND_TO);
    expect(result).toBeNull();
  });

  it("treats graph as undirected", () => {
    const graph: VenueGraph = {
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 1, y: 0 },
      ],
      edges: [{ from: "A", to: "B", weight: 1 }],
    };
    const forward = shortestPath(graph, "A", "B", {}, DEFAULT_SPEED, DEFAULT_ROUND_TO);
    const reverse = shortestPath(graph, "B", "A", {}, DEFAULT_SPEED, DEFAULT_ROUND_TO);
    expect(forward!.totalWeight).toBe(reverse!.totalWeight);
  });

  it("picks both diamond branches equally when densities match", () => {
    const graph = diamond();
    const result = shortestPath(graph, "A", "D", {}, DEFAULT_SPEED, DEFAULT_ROUND_TO);
    expect(result!.totalWeight).toBe(20);
    expect(result!.path[0]).toBe("A");
    expect(result!.path[result!.path.length - 1]).toBe("D");
    expect(result!.path.length).toBe(3);
  });

  it("avoids the crowded branch when one side is congested", () => {
    const graph = diamond();
    // Branch through B is crowded, branch through C is empty.
    const result = shortestPath(
      graph,
      "A",
      "D",
      { B: 1.0 },
      DEFAULT_SPEED,
      DEFAULT_ROUND_TO,
    );
    expect(result!.path).toContain("C");
    expect(result!.path).not.toContain("B");
  });

  it("returns ETA rounded to the specified increment", () => {
    const graph: VenueGraph = {
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 1, y: 0 },
      ],
      edges: [{ from: "A", to: "B", weight: 13 }],
    };
    // 13 / 12 = 1.08s → rounded to 5s
    const result = shortestPath(graph, "A", "B", {}, DEFAULT_SPEED, 5);
    expect(result!.etaSec).toBe(5);
  });

  it("never returns an ETA below the minimum round-to increment", () => {
    const graph: VenueGraph = {
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 1, y: 0 },
      ],
      edges: [{ from: "A", to: "B", weight: 0.01 }],
    };
    const result = shortestPath(graph, "A", "B", {}, DEFAULT_SPEED, 5);
    expect(result!.etaSec).toBeGreaterThanOrEqual(5);
  });

  it("crowd penalty triples the effective cost of a fully red edge", () => {
    const graph: VenueGraph = {
      nodes: [
        { id: "A", x: 0, y: 0 },
        { id: "B", x: 1, y: 0 },
      ],
      edges: [{ from: "A", to: "B", weight: 10 }],
    };
    const empty = shortestPath(graph, "A", "B", {}, DEFAULT_SPEED, DEFAULT_ROUND_TO);
    const red = shortestPath(graph, "A", "B", { B: 1 }, DEFAULT_SPEED, DEFAULT_ROUND_TO);
    // CROWD_PENALTY_MAX = 2.0 → empty is 10, red is 10 × (1 + 2.0 × 1) = 30
    expect(empty!.totalWeight).toBe(10);
    expect(red!.totalWeight).toBe(30);
  });
});
