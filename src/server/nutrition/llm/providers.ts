import "server-only";
import type { EstimateProvider } from "@/lib/nutrition/types";
import { extractJson } from "./interpret";

export interface LlmProvider {
  id: Extract<EstimateProvider, "gemini" | "groq" | "ollama" | "anthropic">;
  model: string;
  complete(system: string, user: string): Promise<unknown>;
}

const TIMEOUT_MS = 20_000;

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Google Gemini — free tier via an AI Studio key (https://aistudio.google.com/apikey). */
function gemini(key: string): LlmProvider {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  return {
    id: "gemini",
    model,
    async complete(system, user) {
      const json = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        },
        { "x-goog-api-key": key },
      );
      const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      return extractJson(text);
    },
  };
}

/** Groq — free tier, OpenAI-compatible API (https://console.groq.com/keys). */
function groq(key: string): LlmProvider {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  return {
    id: "groq",
    model,
    async complete(system, user) {
      const json = await postJson(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        { authorization: `Bearer ${key}` },
      );
      return extractJson(json?.choices?.[0]?.message?.content ?? "");
    },
  };
}

/** Ollama — runs models locally, free indefinitely (https://ollama.com). */
function ollama(baseUrl: string): LlmProvider {
  const model = process.env.OLLAMA_MODEL || "llama3.2";
  return {
    id: "ollama",
    model,
    async complete(system, user) {
      const json = await postJson(
        `${baseUrl.replace(/\/$/, "")}/api/chat`,
        {
          model,
          stream: false,
          format: "json",
          options: { temperature: 0.2 },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        },
        {},
      );
      return extractJson(json?.message?.content ?? "");
    },
  };
}

/** Anthropic Claude — paid API, optional. */
function anthropic(key: string): LlmProvider {
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  return {
    id: "anthropic",
    model,
    async complete(system, user) {
      const json = await postJson(
        "https://api.anthropic.com/v1/messages",
        { model, max_tokens: 1500, temperature: 0.2, system, messages: [{ role: "user", content: user }] },
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
      );
      const text = (json?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
      return extractJson(text);
    },
  };
}

/**
 * Picks the provider from LLM_PROVIDER, or the first one with credentials.
 * Returns null when none is configured — callers fall back to templates.
 */
export function getLlmProvider(): LlmProvider | null {
  const pref = (process.env.LLM_PROVIDER || "").toLowerCase();
  const env = process.env;
  const available: Record<string, () => LlmProvider | null> = {
    gemini: () => (env.GEMINI_API_KEY ? gemini(env.GEMINI_API_KEY) : null),
    groq: () => (env.GROQ_API_KEY ? groq(env.GROQ_API_KEY) : null),
    ollama: () => (env.OLLAMA_URL ? ollama(env.OLLAMA_URL) : null),
    anthropic: () => (env.ANTHROPIC_API_KEY ? anthropic(env.ANTHROPIC_API_KEY) : null),
  };
  if (pref === "none") return null;
  if (pref && available[pref]) return available[pref]();
  for (const k of ["gemini", "groq", "ollama", "anthropic"]) {
    const p = available[k]();
    if (p) return p;
  }
  return null;
}
