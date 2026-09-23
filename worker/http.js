import { GameError } from "../public/core/game.js";

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders }
  });
}
export function errorResponse(error) {
  if (error instanceof GameError) return json({ error: error.code, message: error.message }, error.status);
  console.error("Relay request failed:", error?.name || "Error");
  return json({ error: "INTERNAL", message: "The relay could not finish that request. Please try again." }, 500);
}
export async function readJson(request) {
  if (!request.headers.get("Content-Type")?.includes("application/json")) throw new GameError("FORMAT", "Send a JSON request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new GameError("BODY", "This request is empty.");
  const chunks = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 4096) { await reader.cancel(); throw new GameError("SIZE", "This request is too large.", 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("not object");
    return result;
  } catch (error) {
    if (error instanceof GameError) throw error;
    throw new GameError("JSON", "That request could not be read.");
  }
}
export function assertOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin) throw new GameError("ORIGIN", "Open the game directly before sending this request.", 403);
}
export function tokenCookie(code, value, secure) {
  return `relay_${code}=${value}; Path=/api/rooms/${code}; HttpOnly; SameSite=Strict; Max-Age=86400${secure ? "; Secure" : ""}`;
}
export function readCookie(request, code) {
  const name = `relay_${code}=`;
  const pair = (request.headers.get("Cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(name));
  return pair?.slice(name.length) || null;
}
export async function hashToken(token) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, "0")).join("");
}
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function equalHash(a, b) {
  if (typeof a !== "string" || a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
