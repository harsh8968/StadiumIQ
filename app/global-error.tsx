"use client";

/**
 * Root-level error boundary. Catches errors that bubble past every nested
 * `error.tsx` (including the root layout itself). Because this replaces the
 * entire `<html>` tree when it renders, it must ship its own `<html>` and
 * `<body>` tags and cannot rely on the app-wide Tailwind theme / fonts.
 */
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#020617",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <p
          style={{
            fontSize: "4rem",
            fontWeight: 900,
            color: "#1e293b",
            margin: 0,
          }}
        >
          500
        </p>
        <p style={{ fontWeight: 600, marginTop: "12px" }}>
          StadiumIQ hit an unexpected error.
        </p>
        <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "4px" }}>
          Our team has been notified. Try again in a moment.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "20px",
            background: "#0ea5e9",
            border: "none",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.875rem",
            padding: "10px 24px",
            borderRadius: "9999px",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
