import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock the Gemini SDK before importing the client.
const sendMessage = vi.fn();
const startChat = vi.fn(() => ({ sendMessage }));
const getGenerativeModel = vi.fn(() => ({ startChat }));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(() => ({ getGenerativeModel })),
}));

// Provide a key so the client instantiates.
vi.stubEnv("GEMINI_API_KEY", "test-key");

const Schema = z.object({ reply: z.string(), action: z.enum(["info", "navigate"]) });

describe("structuredChat (Gemini)", () => {
  beforeEach(() => {
    sendMessage.mockReset();
    startChat.mockClear();
    getGenerativeModel.mockClear();
  });

  it("parses a clean JSON response into the Zod schema", async () => {
    sendMessage.mockResolvedValue({
      response: { text: () => `{"reply":"hello","action":"info"}` },
    });

    const { structuredChat } = await import("@/lib/gemini/client");
    const out = await structuredChat(
      [{ role: "user", content: "hi" }],
      Schema,
      "system prompt",
    );

    expect(out).toEqual({ reply: "hello", action: "info" });
    expect(getGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-2.0-flash" }),
    );
  });

  it("extracts JSON even when wrapped in commentary", async () => {
    sendMessage.mockResolvedValue({
      response: {
        text: () => `Sure — here you go:\n{"reply":"go north","action":"navigate"}`,
      },
    });

    const { structuredChat } = await import("@/lib/gemini/client");
    const out = await structuredChat(
      [{ role: "user", content: "q" }],
      Schema,
      "system",
    );

    expect(out.action).toBe("navigate");
  });

  it("throws when response contains no JSON object", async () => {
    sendMessage.mockResolvedValue({
      response: { text: () => `I don't know.` },
    });

    const { structuredChat } = await import("@/lib/gemini/client");
    await expect(
      structuredChat([{ role: "user", content: "q" }], Schema, "system"),
    ).rejects.toThrow(/No JSON object/);
  });

  it("throws when response fails schema validation", async () => {
    sendMessage.mockResolvedValue({
      response: { text: () => `{"reply":"ok","action":"banana"}` },
    });

    const { structuredChat } = await import("@/lib/gemini/client");
    await expect(
      structuredChat([{ role: "user", content: "q" }], Schema, "system"),
    ).rejects.toThrow();
  });
});
