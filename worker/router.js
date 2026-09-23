import { assertOrigin, errorResponse, json, readJson } from "./http.js";
import { GameError } from "../public/core/game.js";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const windows = new Map();
function rateLimit(request, isCreate) {
  // Best-effort edge-isolate limit, not a global abuse/billing guarantee.
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const key = `${isCreate ? "create" : "join"}:${ip}`, now = Date.now();
  let state = windows.get(key);
  if (!state || now >= state.until) state = { count: 0, until: now + 60_000 };
  if (++state.count > (isCreate ? 12 : 120)) throw new GameError("RATE", "Too many room requests. Try again in a minute.", 429);
  windows.set(key, state);
  if (windows.size > 4096) for (const [k, v] of windows) if (v.until <= now) windows.delete(k);
  if (windows.size > 8192) windows.delete(windows.keys().next().value);
}
export async function route(request, env) {
  try {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (path === "/api/health" && request.method === "GET") return json({ ok: true, game: "ECHO RELAY", version: "0.1.0" });
    if (request.method !== "GET" || request.headers.get("Upgrade")) assertOrigin(request);
    if (path === "/api/rooms" && request.method === "POST") {
      rateLimit(request, true);
      const input = await readJson(request);
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => alphabet[b % alphabet.length]).join("");
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const internal = new URL(request.url); internal.pathname = `/internal/create/${code}`; internal.search = "";
        const response = await stub.fetch(new Request(internal, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: input.name }) }));
        if (response.status !== 409) return response;
      }
      throw new GameError("BUSY", "We could not find a free relay code. Please try again.", 503);
    }
    const match = path.match(/^\/api\/rooms\/([A-HJ-NP-Z2-9]{6})\/(join|session|socket)$/);
    if (match) {
      const [_, code, endpoint] = match;
      if ((endpoint === "join" && request.method !== "POST") || (endpoint !== "join" && request.method !== "GET")) return json({ message: "That method is not supported." }, 405);
      if (endpoint !== "session") rateLimit(request, false);
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
    }
    return json({ message: "That game endpoint does not exist." }, 404);
  } catch (error) { return errorResponse(error); }
}
