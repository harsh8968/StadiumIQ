import { NextResponse } from "next/server";
import { mockStore } from "@/lib/mock/store";
import { dispatch } from "@/lib/mock/events";
import { SimulateRequestSchema } from "@/lib/schemas/simulate";
import { rateLimit, clientKeyFrom } from "@/lib/security/rateLimit";
import { sanitizedErrorResponse } from "@/lib/security/errorSanitizer";
import pois from "@/public/venue/pois.json";
import { PoisSchema } from "@/lib/schemas/poi";

const validatedPois = PoisSchema.parse(pois);

const SIMULATE_RATE_LIMIT_MAX = 30;
const SIMULATE_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const limit = rateLimit(
      `simulate:${clientKeyFrom(request)}`,
      SIMULATE_RATE_LIMIT_MAX,
      SIMULATE_RATE_LIMIT_WINDOW_MS,
    );
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many simulation events — please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(limit.resetInMs / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    const body: unknown = await request.json().catch(() => null);
    const parsed = SimulateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid event", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    dispatch(parsed.data.event, mockStore, validatedPois);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return sanitizedErrorResponse(
      "api/simulate",
      error,
      "Unable to dispatch simulation event.",
    );
  }
}
