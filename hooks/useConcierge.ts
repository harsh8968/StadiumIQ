"use client";

import { useState } from "react";
import type { ConciergeMessage, ConciergeRecommendation, ConciergeResponse } from "@/lib/schemas/concierge";
import { ConciergeResponseSchema } from "@/lib/schemas/concierge";
import { USER_SEAT_NODE_ID } from "@/lib/constants";

const GREETING: ConciergeMessage = {
  role: "assistant",
  content: JSON.stringify({
    reply: "Hi — I'm your venue concierge. Ask me anything about food, restrooms, or getting around.",
    recommendation: null,
    action: "info",
  } satisfies ConciergeResponse),
};

export interface UseConciergeResult {
  messages: ConciergeMessage[];
  send: (text: string) => Promise<void>;
  loading: boolean;
  latestRecommendation: ConciergeRecommendation | null;
}

/**
 * Concierge chat state + send API. Posts the full message history plus the
 * user's current `nodeId` to `/api/concierge`, defensively parses the response
 * through the Zod schema, and shows a friendly fallback on schema-parse or
 * network failure. Never renders raw LLM text.
 */
export function useConcierge(): UseConciergeResult {
  const [messages, setMessages] = useState<ConciergeMessage[]>([GREETING]);
  const [loading, setLoading] = useState(false);
  const [latestRecommendation, setLatestRecommendation] = useState<ConciergeRecommendation | null>(null);

  async function send(text: string): Promise<void> {
    if (loading || !text.trim()) return;

    const userMessage: ConciergeMessage = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          userLocation: { nodeId: USER_SEAT_NODE_ID },
        }),
      });

      const data: unknown = await res.json();
      const parsed = ConciergeResponseSchema.safeParse(data);

      const response: ConciergeResponse = parsed.success
        ? parsed.data
        : { reply: "I'm having a moment — please ask me again!", recommendation: null, action: "info" };

      setLatestRecommendation(response.recommendation);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: JSON.stringify(response) },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: JSON.stringify({
            reply: "Network error — please try again.",
            recommendation: null,
            action: "info",
          } satisfies ConciergeResponse),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return { messages, send, loading, latestRecommendation };
}
