import { describe, it, expect } from "vitest";
import {
  sanitizedErrorResponse,
  errorMessageFrom,
} from "@/lib/security/errorSanitizer";

/**
 * Tests for lib/security/errorSanitizer.ts
 *
 * The error sanitizer is a core security control in StadiumIQ's API layer.
 * It ensures raw error messages — which can contain stack traces, file
 * paths, API keys echoed back by SDKs, and Firebase credential fragments —
 * never reach the client. Instead, a safe, user-facing message is returned
 * while the full detail is logged server-side.
 *
 * All API routes (`/api/order`, `/api/concierge`, `/api/density`,
 * `/api/analytics`) use `sanitizedErrorResponse` in their catch blocks.
 * This satisfies OWASP A05:2021 (Security Misconfiguration) and A09:2021
 * (Security Logging and Monitoring Failures).
 */

describe("lib/security/errorSanitizer — sanitizedErrorResponse", () => {
  it("returns a Response-like object with the client-safe message", async () => {
    const res = sanitizedErrorResponse(
      "api/order",
      new Error("Firebase credential invalid"),
      "Something went wrong placing your order.",
    );
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Something went wrong placing your order.");
  });

  it("defaults to HTTP 500 when no status is provided", () => {
    const res = sanitizedErrorResponse(
      "api/test",
      new Error("boom"),
      "Internal error.",
    );
    expect(res.status).toBe(500);
  });

  it("respects a custom HTTP status code", () => {
    const res = sanitizedErrorResponse("api/order", new Error("Not found"), "Not found.", 404);
    expect(res.status).toBe(404);
  });

  it("uses the custom status for 400 Bad Request errors", () => {
    const res = sanitizedErrorResponse("api/order", "validation failed", "Bad request.", 400);
    expect(res.status).toBe(400);
  });

  it("never leaks the raw error message in the JSON body", async () => {
    const sensitiveError = new Error("FIREBASE_ADMIN_PRIVATE_KEY=ABCDEF1234");
    const res = sanitizedErrorResponse("api/test", sensitiveError, "Oops.");
    const body = await res.json() as { error: string };
    // The word "FIREBASE" must not appear in the response body.
    expect(body.error).not.toContain("FIREBASE");
    expect(body.error).not.toContain("PRIVATE_KEY");
  });

  it("handles a non-Error thrown value (e.g. a plain string)", async () => {
    const res = sanitizedErrorResponse("api/test", "something exploded", "Error occurred.");
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Error occurred.");
    expect(res.status).toBe(500);
  });

  it("handles a null thrown value without throwing", async () => {
    expect(() =>
      sanitizedErrorResponse("api/test", null, "Null error."),
    ).not.toThrow();
  });

  it("handles an undefined thrown value without throwing", async () => {
    expect(() =>
      sanitizedErrorResponse("api/test", undefined, "Undefined error."),
    ).not.toThrow();
  });

  it("handles an object thrown value without throwing", async () => {
    expect(() =>
      sanitizedErrorResponse("api/test", { code: 123 }, "Object error."),
    ).not.toThrow();
  });

  it("returns Content-Type application/json", () => {
    const res = sanitizedErrorResponse("api/test", new Error("x"), "Error.");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

describe("lib/security/errorSanitizer — errorMessageFrom", () => {
  it("extracts the message from an Error instance", () => {
    const msg = errorMessageFrom(new Error("timeout after 5000ms"));
    expect(msg).toBe("timeout after 5000ms");
  });

  it("coerces a string to itself", () => {
    const msg = errorMessageFrom("validation failed");
    expect(msg).toBe("validation failed");
  });

  it("coerces a number to a string", () => {
    const msg = errorMessageFrom(42);
    expect(msg).toBe("42");
  });

  it("coerces null to a string", () => {
    const msg = errorMessageFrom(null);
    expect(msg).toBe("null");
  });

  it("coerces undefined to a string", () => {
    const msg = errorMessageFrom(undefined);
    expect(msg).toBe("undefined");
  });

  it("returns a string for a plain object", () => {
    const msg = errorMessageFrom({ code: "UNKNOWN" });
    expect(typeof msg).toBe("string");
  });

  it("always returns a string", () => {
    const inputs = [
      new Error("test"),
      "plain string",
      42,
      null,
      undefined,
      { a: 1 },
      true,
    ];
    for (const input of inputs) {
      expect(typeof errorMessageFrom(input)).toBe("string");
    }
  });
});
