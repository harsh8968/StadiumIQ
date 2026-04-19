import { NextResponse } from "next/server";
import { orderStore } from "@/lib/mock/orderStore";
import { PlaceOrderRequestSchema } from "@/lib/schemas/order";
import type { Order } from "@/lib/schemas/order";
import { PoisSchema } from "@/lib/schemas/poi";
import { generatePickupCode } from "@/lib/util/pickupCode";
import { rateLimit, clientKeyFrom } from "@/lib/security/rateLimit";
import { sanitizedErrorResponse } from "@/lib/security/errorSanitizer";
import rawPois from "@/public/venue/pois.json";

const pois = PoisSchema.parse(rawPois);
const poiMap = new Map(pois.map((p) => [p.id, p]));

const ORDER_RATE_LIMIT_MAX = 10;
const ORDER_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const userId = request.headers.get("X-User-Id");
    if (!userId) {
      return NextResponse.json({ error: "Missing X-User-Id header" }, { status: 400 });
    }

    const limit = rateLimit(
      `order:${clientKeyFrom(request)}:${userId}`,
      ORDER_RATE_LIMIT_MAX,
      ORDER_RATE_LIMIT_WINDOW_MS,
    );
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many orders — please wait a moment." },
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
    const parsed = PlaceOrderRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { poiId, items } = parsed.data;
    const poi = poiMap.get(poiId);
    if (!poi) {
      return NextResponse.json({ error: `Unknown POI: ${poiId}` }, { status: 400 });
    }

    const totalCents = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
    const pickupCode = generatePickupCode(orderStore.getActiveCodes());

    const order: Order = {
      id: crypto.randomUUID(),
      userId,
      poiId,
      poiName: poi.name,
      items,
      totalCents,
      pickupCode,
      state: "placed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    orderStore.create(order);
    return NextResponse.json(order);
  } catch (error) {
    return sanitizedErrorResponse(
      "api/order",
      error,
      "Something went wrong placing the order. Please try again.",
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const all = searchParams.get("all");

    let orders;
    if (all === "true") {
      orders = orderStore.getAll();
    } else if (userId) {
      orders = orderStore.getByUserId(userId);
    } else {
      return NextResponse.json({ error: "Provide ?userId= or ?all=true" }, { status: 400 });
    }

    const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json(sorted);
  } catch (error) {
    return sanitizedErrorResponse("api/order", error, "Unable to load orders.");
  }
}
