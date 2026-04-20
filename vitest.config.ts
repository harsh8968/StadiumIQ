import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config.
 *
 * - Component tests under `tests/components/` run in jsdom via
 *   `environmentMatchGlobs`. Everything else stays on node for speed.
 * - esbuild handles JSX natively via `esbuild.jsx = "automatic"` — no need
 *   for @vitejs/plugin-react, which is ESM-only and breaks CJS config loads.
 * - Coverage now spans hooks + concierge + security so the number reflects
 *   real behavior, not just pure-function reach.
 */
export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["tests/components/**", "jsdom"],
      ["tests/hooks/**", "jsdom"],
      ["tests/mock/**", "node"],
      ["tests/security/**", "node"],
      ["tests/google/**", "node"],
      ["tests/firebase/**", "node"],
    ],
    env: {
      // API route integration tests assume the demo's mock-mode flag so
      // density reads resolve to the in-memory store, not "not implemented".
      NEXT_PUBLIC_MOCK_MODE: "true",
    },
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        // Core business logic
        "lib/routing/**",
        "lib/mock/**",
        "lib/schemas/**",
        "lib/concierge/**",
        "lib/security/**",
        "lib/constants.ts",
        "lib/env.ts",
        // Google Services — all Google/Firebase/Gemini integrations
        "lib/google/**",
        "lib/firebase/**",
        "lib/gemini/**",
        // Hooks
        "hooks/**",
        // Components
        "components/concierge/**",
        "components/order/**",
      ],
      exclude: [
        "**/*.d.ts",
        "node_modules/**",
        "**/index.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
