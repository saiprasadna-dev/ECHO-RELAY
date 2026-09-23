/**
 * Dependency-free LOOPBACK-ONLY development adapter.
 * Runs the SAME router and RoomService as the Cloudflare deployment.
 * This is not workerd/Miniflare and is not a production hosting server.
 * Production uses Cloudflare's native WebSocket implementation and storage.
 */
import http from "node:http";
import { createHash } from "node:crypto";
import { readFile, writeFile, rename, mkdir, unlink } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RoomService } from "../worker/room-service.js";
import { route } from "../worker/router.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = resolve(ROOT, "public");
const DATA = resolve(ROOT, process.env.RELAY_DATA_DIR || ".local-data");
const PORT = Number(process.env.PORT || 8787);
await mkdir(DATA, { recursive: true });

function frame(opcode, payload) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (data.length < 126) { header = Buffer.alloc(2); header[1] = data.length; }
  else if (data.length <= 65535) { header = Buffer.alloc(4); header[1] = 126; header.writeUInt16BE(data.length, 2); }
  else { header = Buffer.alloc(10); header[1] = 127; header.writeBigUInt64BE(BigInt(data.length), 2); }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, data]);
}
class LocalSocket {
  readyState = 0; attachment = null; pending = []; net = null; finished = false;
  serializeAttachment(data) { this.attachment = structuredClone(data); }
  deserializeAttachment() { return structuredClone(this.attachment); }
  send(data) {
    if (this.readyState !== 1) throw new Error("socket closed");
    const bytes = frame(1, data);
    if (this.net) this.net.write(bytes); else this.pending.push(bytes);
  }
  close(code = 1000, reason = "") {
    if (this.finished) return;
    const text = Buffer.from(reason).subarray(0, 120), bytes = Buffer.alloc(text.length + 2);
    bytes.writeUInt16BE(code, 0); text.copy(bytes, 2);
    if (this.net && !this.net.destroyed) this.net.end(frame(8, bytes));
    this.finish();
  }
  finish() {
    if (this.finished) return;
    this.finished = true; this.readyState = 3;
    this.context?.service.close(this).catch(console.error);
    if (this.context) this.context.sockets = this.context.sockets.filter(s => s !== this);
  }
  attach(net, initial) {
    this.net = net; let buffer = Buffer.alloc(0), fragments = [], fragmentBytes = 0, fragmenting = false;
    for (const bytes of this.pending) net.write(bytes); this.pending = [];
    const deliver = data => {
      let text;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(data); }
      catch { this.close(1007, "Invalid UTF-8"); return; }
      this.context.service.message(this, text).catch(console.error);
    };
    const receive = chunk => {
      if (this.finished) return;
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const first = buffer[0], second = buffer[1], fin = Boolean(first & 128), op = first & 15;
        if ((first & 112) || !(second & 128)) { this.close(1002, "Malformed frame"); return; }
        let length = second & 127, start = 2;
        if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); start = 4; }
        else if (length === 127) {
          if (buffer.length < 10) return;
          const n = buffer.readBigUInt64BE(2);
          if (n > 4096n) { this.close(1009, "Message too large"); return; }
          length = Number(n); start = 10;
        }
        if (length > 4096 || (op >= 8 && (length > 125 || !fin))) { this.close(1009, "Frame too large"); return; }
        if (buffer.length < start + 4 + length) return;
        const mask = buffer.subarray(start, start + 4), body = Buffer.from(buffer.subarray(start + 4, start + 4 + length));
        for (let i = 0; i < body.length; i++) body[i] ^= mask[i % 4];
        buffer = buffer.subarray(start + 4 + length);
        if (op === 8) { this.close(1000); return; }
        if (op === 9) { net.write(frame(10, body)); continue; }
        if (op === 10) continue;
        if (op === 2) { this.close(1003, "Text messages only"); return; }
        if (op === 1) {
          if (fragmenting) { this.close(1002, "Unexpected text frame"); return; }
          if (fin) deliver(body);
          else { fragments = [body]; fragmentBytes = body.length; fragmenting = true; }
        } else if (op === 0 && fragmenting) {
          fragmentBytes += body.length;
          if (fragmentBytes > 4096) { this.close(1009, "Message too large"); return; }
          fragments.push(body);
          if (fin) { deliver(Buffer.concat(fragments)); fragments = []; fragmentBytes = 0; fragmenting = false; }
        } else { this.close(1002, "Unexpected frame"); return; }
      }
    };
    net.on("data", receive); net.on("close", () => this.finish()); net.on("error", () => this.finish());
    if (initial?.length) receive(initial);
  }
}
class LocalContext {
  sockets = []; timer = null; values = null;
  constructor(code) {
    this.file = resolve(DATA, `${code}.json`);
    this.storage = {
      get: async key => { await this.load(); return structuredClone(this.values[key]); },
      put: async (key, value) => { await this.load(); this.values[key] = structuredClone(value); await this.flush(); },
      setAlarm: async timestamp => {
        await this.load(); this.values._alarm = timestamp; await this.flush(); clearTimeout(this.timer);
        this.timer = setTimeout(() => this.service.alarm().catch(console.error), Math.max(1, timestamp - Date.now()));
        this.timer.unref();
      },
      deleteAll: async () => { this.values = {}; clearTimeout(this.timer); await unlink(this.file).catch(() => {}); }
    };
  }
  async load() {
    if (this.values !== null) return;
    try { this.values = JSON.parse(await readFile(this.file, "utf8")); }
    catch (e) { if (e.code !== "ENOENT") throw e; this.values = {}; }
  }
  async flush() { await writeFile(`${this.file}.tmp`, JSON.stringify(this.values)); await rename(`${this.file}.tmp`, this.file); }
  acceptWebSocket(ws) { ws.readyState = 1; ws.context = this; this.sockets.push(ws); }
  getWebSockets() { return this.sockets; }
}
const rooms = new Map();
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const env = {
  ROOMS: {
    idFromName: code => code,
    get(code) {
      if (!rooms.has(code)) {
        const ctx = new LocalContext(code);
        ctx.service = new RoomService(ctx, { pair() { const server = new LocalSocket(); return [{ server }, server]; }, upgrade(client) { return { localUpgrade: client.server }; } });
        rooms.set(code, ctx.service);
      }
      return rooms.get(code);
    }
  },
  ASSETS: { async fetch(request) {
    let path;
    try { path = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response("Bad path", { status: 400 }); }
    let file = resolve(PUBLIC, `.${path}`);
    if (file !== PUBLIC && !file.startsWith(PUBLIC + "/")) return new Response("Not found", { status: 404 });
    if (path === "/" || !extname(path)) file = resolve(PUBLIC, "index.html");
    try {
      const bytes = await readFile(file);
      return new Response(bytes, { headers: { "Content-Type": mime[extname(file)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" } });
    } catch { return new Response("Not found", { status: 404 }); }
  } }
};
function allowedHost(req) { return req.headers.host === `127.0.0.1:${PORT}` || req.headers.host === `localhost:${PORT}`; }
function webRequest(req, body) {
  return new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, ...(body?.length ? { body } : {}) });
}
const server = http.createServer(async (req, res) => {
  try {
    if (!allowedHost(req)) { res.writeHead(400); res.end("Use localhost or 127.0.0.1"); return; }
    const pieces = []; let size = 0;
    for await (const part of req) { size += part.length; if (size > 4096) { res.writeHead(413); res.end("Too large"); return; } pieces.push(part); }
    const result = await route(webRequest(req, Buffer.concat(pieces)), env);
    const headers = Object.fromEntries(result.headers.entries());
    res.writeHead(result.status, headers); res.end(Buffer.from(await result.arrayBuffer()));
  } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500); res.end("Development server error"); }
});
server.on("upgrade", async (req, socket, head) => {
  try {
    if (!allowedHost(req) || req.headers["sec-websocket-version"] !== "13" || Buffer.from(req.headers["sec-websocket-key"] || "", "base64").length !== 16) { socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"); return; }
    const result = await route(webRequest(req), env);
    if (!result.localUpgrade) { socket.end(`HTTP/1.1 ${result.status} Rejected\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n${await result.text()}`); return; }
    const accept = createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    result.localUpgrade.attach(socket, head);
  } catch (e) { console.error(e); socket.destroy(); }
});
server.listen(PORT, "127.0.0.1", () => console.log(`\nECHO RELAY local development\nhttp://127.0.0.1:${PORT}\nTwo players: use two different browser profiles or one private window.\nLocal adapter only; use npm run cloudflare:dev for native workerd verification.\n`));
