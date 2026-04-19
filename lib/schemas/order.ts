import { z } from "zod";

export const ORDER_STATES = ["placed", "preparing", "ready", "collected"] as const;

export const OrderStateSchema = z.enum(ORDER_STATES);
export type OrderState = z.infer<typeof OrderStateSchema>;

export const OrderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceCents: z.number().int().positive(),
  qty: z.number().int().positive(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  poiId: z.string(),
  poiName: z.string(),
  items: z.array(OrderItemSchema),
  totalCents: z.number().int().nonnegative(),
  pickupCode: z.string().length(4),
  state: OrderStateSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Order = z.infer<typeof OrderSchema>;

// ── API request schemas ──────────────────────────────────────────────────────

/**
 * Hard caps for inbound order traffic. These defend against:
 *  - unbounded request bodies (DoS)
 *  - excessively long identifiers hiding payloads
 *  - enormous cart submissions that would take forever to prepare
 */
export const ORDER_MAX_ITEMS = 20;
export const ORDER_MAX_POI_ID_LEN = 64;
export const ORDER_MAX_ITEM_QTY = 20;

export const PlaceOrderRequestSchema = z.object({
  poiId: z.string().min(1).max(ORDER_MAX_POI_ID_LEN),
  items: z
    .array(
      OrderItemSchema.extend({
        qty: z.number().int().positive().max(ORDER_MAX_ITEM_QTY),
      }),
    )
    .min(1)
    .max(ORDER_MAX_ITEMS),
});
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;

export const AdvanceOrderRequestSchema = z.object({
  id: z.string(),
});
export type AdvanceOrderRequest = z.infer<typeof AdvanceOrderRequestSchema>;

// ── API response schemas ─────────────────────────────────────────────────────

export const OrderResponseSchema = OrderSchema;
export type OrderResponse = Order;

export const OrderListResponseSchema = z.array(OrderSchema);
export type OrderListResponse = Order[];
