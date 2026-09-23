import { DurableObject } from "cloudflare:workers";
import { RoomService } from "./room-service.js";
import { route } from "./router.js";

/** Each SQLite-backed Durable Object is one isolated, authoritative game room. */
export class RelayRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.service = new RoomService(ctx, {
      pair() { const pair = new WebSocketPair(); return [pair[0], pair[1]]; },
      upgrade(client) { return new Response(null, { status: 101, webSocket: client }); }
    });
  }
  fetch(request) { return this.service.fetch(request); }
  webSocketMessage(ws, message) { return this.service.message(ws, message); }
  webSocketClose(ws, code, reason, wasClean) {
    try { ws.close(code, reason); } catch { /* Peer has already closed. */ }
    return this.service.close(ws);
  }
  webSocketError(ws) { return this.service.close(ws); }
  alarm() { return this.service.alarm(); }
}
export default { fetch: route };
