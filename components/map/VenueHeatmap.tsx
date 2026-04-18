"use client";

import { motion } from "framer-motion";
import type { Poi } from "@/lib/schemas/poi";
import type { DensityMap } from "@/lib/data/crowd";
import { CROWD_THRESHOLDS } from "@/lib/constants";

// Hex values matching CLAUDE.md thresholds
const DENSITY_COLORS = {
  low: "#22c55e",      // green-500  ≤ 0.30
  medium: "#eab308",   // yellow-500 ≤ 0.60
  high: "#f97316",     // orange-500 ≤ 0.85
  critical: "#ef4444", // red-500    > 0.85
} as const;

function colorForDensity(d: number): string {
  if (d <= CROWD_THRESHOLDS.LOW) return DENSITY_COLORS.low;
  if (d <= CROWD_THRESHOLDS.MEDIUM) return DENSITY_COLORS.medium;
  if (d <= CROWD_THRESHOLDS.HIGH) return DENSITY_COLORS.high;
  return DENSITY_COLORS.critical;
}

const POI_TYPE_RADIUS: Record<Poi["type"], number> = {
  gate: 22,
  food: 18,
  restroom: 14,
  merch: 16,
  firstaid: 14,
};

interface Props {
  pois: Poi[];
  density: DensityMap;
  onSelect?: (poiId: string) => void;
  children?: React.ReactNode;
}

export function VenueHeatmap({ pois, density, onSelect, children }: Props) {
  return (
    <svg
      viewBox="0 0 1000 600"
      className="w-full h-full"
      role="img"
      aria-label="Stadium venue map with live crowd density for each point of interest"
    >
      <title>Stadium venue map</title>
      <desc>
        Interactive venue floor plan showing points of interest coloured by live
        crowd density. Green is low density, red is critical density. Each POI
        is focusable and announces its current density to assistive technology.
      </desc>
      {/* ── Venue shell ──────────────────────────────────────────────── */}
      <ellipse
        cx={500}
        cy={300}
        rx={460}
        ry={265}
        fill="#1e293b"
        stroke="#334155"
        strokeWidth={3}
      />
      {/* Playing field */}
      <ellipse
        cx={500}
        cy={300}
        rx={310}
        ry={175}
        fill="#166534"
        stroke="#15803d"
        strokeWidth={2}
        opacity={0.9}
      />
      {/* Centre circle */}
      <circle
        cx={500}
        cy={300}
        r={55}
        fill="none"
        stroke="#15803d"
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Halfway line */}
      <line
        x1={500} y1={127} x2={500} y2={473}
        stroke="#15803d"
        strokeWidth={1.5}
        opacity={0.6}
      />

      {/* ── Concourse ring ────────────────────────────────────────────── */}
      <ellipse
        cx={500}
        cy={300}
        rx={460}
        ry={265}
        fill="none"
        stroke="#475569"
        strokeWidth={1}
        strokeDasharray="6 4"
        opacity={0.4}
      />

      {/* ── Overlay layer (route, user marker) ───────────────────────── */}
      {children}

      {/* ── POI markers ───────────────────────────────────────────────── */}
      {pois.map((poi) => {
        const d = density[poi.id] ?? 0;
        const fill = colorForDensity(d);
        const r = POI_TYPE_RADIUS[poi.type];
        const labelY = poi.coords.y + r + 14;

        return (
          <g
            key={poi.id}
            onClick={() => onSelect?.(poi.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(poi.id);
              }
            }}
            className="cursor-pointer focus:outline-none focus-visible:[&>circle:nth-child(2)]:stroke-sky-400"
            role="button"
            tabIndex={0}
            aria-label={`${poi.name}, ${poi.type}, ${Math.round(d * 100)}% crowd density`}
          >
            {/* Glow ring — static, always present */}
            <circle
              cx={poi.coords.x}
              cy={poi.coords.y}
              r={r + 6}
              fill={fill}
              opacity={0.18}
            />

            {/* Animated fill circle */}
            <motion.circle
              cx={poi.coords.x}
              cy={poi.coords.y}
              r={r}
              stroke="#0f172a"
              strokeWidth={2}
              animate={{ fill }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />

            {/* POI name label */}
            <text
              x={poi.coords.x}
              y={labelY}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize={10}
              fontFamily="var(--font-geist-sans, sans-serif)"
              className="pointer-events-none select-none"
            >
              {poi.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
