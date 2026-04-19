import { z } from "zod";

/**
 * Hard caps for inbound concierge traffic. These defend against:
 *  - unbounded request bodies (DoS)
 *  - prompt-injection payloads hidden in long messages
 *  - runaway conversation histories inflating token costs
 */
export const CONCIERGE_MAX_MESSAGE_LEN = 500;
export const CONCIERGE_MAX_HISTORY_LEN = 20;
export const CONCIERGE_MAX_NODE_ID_LEN = 64;

export const ConciergeMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(CONCIERGE_MAX_MESSAGE_LEN),
});
export type ConciergeMessage = z.infer<typeof ConciergeMessageSchema>;

export const ConciergeRequestSchema = z.object({
  messages: z.array(ConciergeMessageSchema).min(1).max(CONCIERGE_MAX_HISTORY_LEN),
  userLocation: z.object({ nodeId: z.string().min(1).max(CONCIERGE_MAX_NODE_ID_LEN) }),
});
export type ConciergeRequest = z.infer<typeof ConciergeRequestSchema>;

export const ConciergeRecommendationSchema = z.object({
  poiId: z.string(),
  poiName: z.string(),
  walkTimeSec: z.number().nonnegative(),
  currentDensity: z.number().min(0).max(1),
  reason: z.string(),
});
export type ConciergeRecommendation = z.infer<typeof ConciergeRecommendationSchema>;

export const ConciergeActionSchema = z.enum(["navigate", "order", "info"]);
export type ConciergeAction = z.infer<typeof ConciergeActionSchema>;

export const ConciergeResponseSchema = z.object({
  reply: z.string(),
  recommendation: ConciergeRecommendationSchema.nullable(),
  action: ConciergeActionSchema,
});
export type ConciergeResponse = z.infer<typeof ConciergeResponseSchema>;
