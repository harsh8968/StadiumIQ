/**
 * Centralized error response helper. Keeps stack traces and internal error
 * messages off the wire while preserving a server-side log breadcrumb for
 * debugging.
 *
 * Never return raw `Error.message` to clients — it can leak paths, library
 * internals, and occasionally secrets (e.g. a misconfigured API key echoed
 * back by a third-party SDK).
 */
import { NextResponse } from "next/server";

export interface SanitizedErrorBody {
  error: string;
  code?: string;
}

/**
 * Log the full error server-side, then return a generic JSON response.
 *
 * @param scope Short label used in the server log (e.g. `"api/order"`).
 * @param error The caught `unknown` — will be coerced to a string for logs.
 * @param clientMessage Safe, user-facing message. Must not reference internals.
 * @param status HTTP status (defaults to 500).
 */
export function sanitizedErrorResponse(
  scope: string,
  error: unknown,
  clientMessage: string,
  status = 500,
): NextResponse<SanitizedErrorBody> {
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, detail);
  return NextResponse.json({ error: clientMessage }, { status });
}

/**
 * Narrow a caught `unknown` to a string message. Safe for logs, NOT for
 * client responses (use `sanitizedErrorResponse` for those).
 */
export function errorMessageFrom(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
