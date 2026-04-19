import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

/**
 * Google Gemini client for the AI Concierge.
 *
 * Uses `gemini-2.0-flash` — fast, generous free tier, and supports the
 * JSON-response-mode we rely on for the structured concierge contract.
 * (The 1.5 line was deprecated for new keys on the v1beta endpoint.)
 */
const API_KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL_NAME = "gemini-2.0-flash";

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Call Gemini with a system prompt + message history, parse the response as
 * JSON, and validate it against the provided Zod schema.
 *
 * Throws if the key is missing or the response doesn't match the schema.
 */
export async function structuredChat<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  systemPrompt: string,
): Promise<T> {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  });

  // Gemini's chat history uses { role: "user" | "model", parts: [{ text }] }.
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const last = messages[messages.length - 1];
  if (!last) throw new Error("structuredChat requires at least one message");

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(last.content);
  const text = result.response.text();

  // Gemini's JSON mode returns the raw JSON object. We still defensively extract
  // the first {...} block in case the model wraps it in commentary.
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in Gemini response");
  }

  const parsed: unknown = JSON.parse(jsonMatch[0]);
  return schema.parse(parsed);
}
