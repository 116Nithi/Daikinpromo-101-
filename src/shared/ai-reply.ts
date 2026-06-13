// External AI service (separate Node/Python server on the local network).
// AI_API_URL defaults to LAN address used in dev; override via env in prod.
const AI_API_URL = process.env.AI_API_URL ?? "http://192.168.1.175:3000/api/ask";
const AI_API_KEY = process.env.AI_API_KEY ?? "";

// Send a user message to the AI service and return the reply text.
// userId is forwarded so the AI service can maintain per-user conversation
// history / context on its own side.
// Throws on non-2xx so the caller (event-processor) can catch and skip silently.
export async function askAI(userId: string, question: string): Promise<string> {
  const res = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": AI_API_KEY },
    body: JSON.stringify({ question, userId }),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status} ${res.statusText}`);
  const data = await res.json() as Record<string, unknown>;
  // Accept multiple response field names so we stay compatible if the AI
  // service changes its schema (answer → reply → message → text → fallback).
  return (
    (data.answer as string) ??
    (data.reply  as string) ??
    (data.message as string) ??
    (data.text   as string) ??
    "ขออภัย ไม่สามารถตอบได้ในขณะนี้"
  );
}
