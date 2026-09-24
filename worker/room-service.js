import { applyCommand, createAdventureRoom, joinRoom, projectView, roleFor, ROOM_TTL, GameError } from "../public/core/game.js";
import { json, errorResponse, readJson, readCookie, hashToken, randomToken, equalHash, tokenCookie } from "./http.js";

/** Shared application logic. platform only supplies the WebSocket upgrade primitives. */
export class RoomService {
  constructor(ctx, platform) {
    this.ctx = ctx; this.platform = platform; this.room = null; this.queue = Promise.resolve();
    this.loaded = ctx.storage.get("room").then(room => { this.room = room || null; });
  }
  exclusive(fn) {
    const result = this.queue.then(async () => { await this.loaded; return fn(); });
    this.queue = result.catch(() => {});
    return result;
  }
  activeSockets() {
    return this.ctx.getWebSockets().filter(ws => ws.readyState === 1 && !ws.deserializeAttachment()?.revoked);
  }
  online() { return new Set(this.activeSockets().map(ws => ws.deserializeAttachment()?.playerId).filter(Boolean)); }
  send(ws, data) { try { ws.send(typeof data === "string" ? data : JSON.stringify(data)); } catch { /* Close callback will update presence. */ } }
  broadcast() {
    if (!this.room) return;
    const online = this.online();
    for (const ws of this.activeSockets()) {
      const id = ws.deserializeAttachment()?.playerId;
      if (roleFor(this.room, id)) this.send(ws, { type: "state", view: projectView(this.room, id, online) });
    }
  }
  async commit(next) {
    await this.ctx.storage.put("room", next); // Persist before acknowledging/broadcasting the state.
    this.room = next;
  }
  async requireRoom() {
    if (!this.room || Date.now() >= this.room.lastActivity + ROOM_TTL) {
      if (this.room) await this.expire();
      throw new GameError("MISSING", "This relay does not exist or has expired. Check the code or create a new room.", 404);
    }
    return this.room;
  }
  async authenticate(request, allowMissing = false) {
    const token = readCookie(request, this.room.code);
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
      const hash = await hashToken(token);
      for (const player of Object.values(this.room.players)) if (player && equalHash(player.tokenHash, hash)) return player;
    }
    if (allowMissing) return null;
    throw new GameError("AUTH", "Join this relay first. To return to your role, use the same browser and device.", 401);
  }
  fetch(request) {
    return this.exclusive(async () => {
      try {
        const url = new URL(request.url), secure = url.protocol === "https:";
        const creating = url.pathname.match(/^\/internal\/create\/([A-Z2-9]{6})$/);
        if (creating && request.method === "POST") {
          if (this.room && Date.now() < this.room.lastActivity + ROOM_TTL) return json({ error: "COLLISION", message: "That relay code is occupied." }, 409);
          if (this.room) await this.expire();
          const input = await readJson(request), token = randomToken(), id = crypto.randomUUID();
          const code = creating[1], hash = await hashToken(token);
          const room = createAdventureRoom(code, input.name, id, hash, crypto.getRandomValues(new Uint32Array(1))[0]);
          await this.commit(room);
          await this.ctx.storage.setAlarm(room.lastActivity + ROOM_TTL);
          return json({ code, role: "past" }, 201, { "Set-Cookie": tokenCookie(code, token, secure) });
        }
        await this.requireRoom();
        const endpoint = url.pathname.split("/").at(-1);
        if (endpoint === "join" && request.method === "POST") {
          const existing = await this.authenticate(request, true);
          if (existing) return json({ code: this.room.code, role: roleFor(this.room, existing.id) });
          const input = await readJson(request), token = randomToken(), id = crypto.randomUUID();
          const next = joinRoom(this.room, input.name, id, await hashToken(token));
          await this.commit(next); this.broadcast();
          return json({ code: next.code, role: "future" }, 201, { "Set-Cookie": tokenCookie(next.code, token, secure) });
        }
        const player = await this.authenticate(request);
        if (endpoint === "session" && request.method === "GET") return json({ code: this.room.code, role: roleFor(this.room, player.id) });
        if (endpoint === "socket" && request.method === "GET") {
          if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ message: "A WebSocket connection is required." }, 426);
          for (const previous of this.activeSockets()) {
            const meta = previous.deserializeAttachment();
            if (meta?.playerId === player.id) {
              previous.serializeAttachment({ ...meta, revoked: true });
              previous.close(4001, "This role was opened in another tab.");
            }
          }
          const [client, server] = this.platform.pair();
          this.ctx.acceptWebSocket(server, [player.id]);
          server.serializeAttachment({ playerId: player.id, revoked: false, since: Date.now(), count: 0 });
          // Both ready players may have disconnected before the second connection arrived.
          if (this.room.status === "lobby" && this.room.players.past?.ready && this.room.players.future?.ready && this.online().size === 2) {
            await this.commit(applyCommand(this.room, player.id, { id: crypto.randomUUID(), epoch: this.room.epoch, type: "ready", value: true }, this.online()));
          }
          this.broadcast();
          return this.platform.upgrade(client);
        }
        return json({ message: "That game endpoint does not exist." }, 404);
      } catch (error) { return errorResponse(error); }
    });
  }
  message(ws, message) {
    return this.exclusive(async () => {
      let command;
      try {
        await this.requireRoom();
        const meta = ws.deserializeAttachment();
        if (!meta || meta.revoked || ws.readyState !== 1) return;
        if (message === "ping") { this.send(ws, "pong"); return; }
        if (typeof message !== "string" || new TextEncoder().encode(message).length > 4096) throw new GameError("SIZE", "Keep relay messages small.", 413);
        const now = Date.now();
        if (now - meta.since >= 1000) { meta.since = now; meta.count = 0; }
        meta.count++;
        ws.serializeAttachment(meta);
        if (meta.count > 10) throw new GameError("RATE", "Too many signals at once. Wait a moment.", 429);
        try { command = JSON.parse(message); } catch { throw new GameError("JSON", "That signal was unreadable."); }
        const next = applyCommand(this.room, meta.playerId, command, this.online(), now);
        if (next !== this.room) { await this.commit(next); this.broadcast(); }
        this.send(ws, { type: "ack", id: command.id });
      } catch (error) {
        this.send(ws, { type: "error", id: command?.id, code: error instanceof GameError ? error.code : "INTERNAL", message: error instanceof GameError ? error.message : "The relay could not save that action. Please try again." });
      }
    });
  }
  close(ws) {
    return this.exclusive(() => {
      const meta = ws.deserializeAttachment();
      if (meta) ws.serializeAttachment({ ...meta, revoked: true });
      this.broadcast();
    });
  }
  async expire() {
    for (const ws of this.activeSockets()) ws.close(4004, "This relay has expired.");
    await this.ctx.storage.deleteAll();
    this.room = null;
  }
  alarm() {
    return this.exclusive(async () => {
      if (!this.room || Date.now() >= this.room.lastActivity + ROOM_TTL) await this.expire();
      else await this.ctx.storage.setAlarm(this.room.lastActivity + ROOM_TTL);
    });
  }
}
