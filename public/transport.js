import { makeId } from "./core/game.js";
export async function api(path, body) {
  if (!['http:', 'https:'].includes(location.protocol)) throw new Error('Online play needs the local server or a Cloudflare deployment. Use solo practice in this offline preview.');
  const response = await fetch(path, {
    credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  });
  let data;
  try { data = await response.json(); } catch { throw new Error("The server returned an unexpected response. Check the deployment and try again."); }
  if (!response.ok) { const error = new Error(data.message || "The relay could not answer."); error.status = response.status; throw error; }
  return data;
}
export class RelayConnection {
  constructor({ onState, onStatus, onError }) {
    Object.assign(this, { onState, onStatus, onError });
    this.generation = 0; this.socket = null; this.stopped = true; this.retry = 0; this.timer = null; this.heartbeat = null;
  }
  async connect(code) {
    this.stop(); this.stopped = false; this.code = code; this.retry = 0;
    const generation = this.generation;
    await api(`/api/rooms/${code}/session`);
    if (!this.stopped && generation === this.generation) this.open();
  }
  open() {
    if (this.stopped) return;
    this.onStatus(this.retry ? "reconnecting" : "connecting");
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const generation = this.generation;
    const ws = new WebSocket(`${protocol}//${location.host}/api/rooms/${this.code}/socket`);
    this.socket = ws; let lastPong = Date.now();
    const handshake = setTimeout(() => { if (ws.readyState === WebSocket.CONNECTING) ws.close(); }, 12000);
    ws.onopen = () => {
      clearTimeout(handshake);
      if (this.stopped || this.socket !== ws) { ws.close(); return; } this.retry = 0; this.onStatus("connected");
      clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (Date.now() - lastPong > 70000) { ws.close(); return; }
        ws.send("ping");
      }, 25000);
    };
    ws.onmessage = event => {
      if (this.stopped || this.socket !== ws) return;
      if (event.data === "pong") { lastPong = Date.now(); return; }
      try {
        const data = JSON.parse(event.data);
        if (data.type === "state") { this.view = data.view; this.onState(data.view); }
        if (data.type === "error") this.onError(data.message);
      } catch { this.onError("A signal arrived unreadable. Reconnecting…"); ws.close(); }
    };
    ws.onerror = () => { /* onclose owns reconnect scheduling. */ };
    ws.onclose = event => {
      clearTimeout(handshake);
      if (this.stopped || this.socket !== ws) return;
      clearInterval(this.heartbeat);
      if (event.code === 4001 || event.code === 4004) {
        this.stopped = true; this.onStatus("disconnected");
        this.onError(event.code === 4001 ? "This role is open in another tab. Continue there, or return home and resume here." : "This relay has expired. Return home to start a new one."); return;
      }
      this.onStatus("reconnecting");
      const delay = Math.min(8000, 800 * 2 ** this.retry++) + Math.random() * 300;
      this.timer = setTimeout(async () => {
        try { await api(`/api/rooms/${this.code}/session`); if (generation === this.generation) this.open(); }
        catch (error) {
          if (this.stopped || generation !== this.generation) return;
          if (error.status === 401 || error.status === 404) { this.stopped = true; this.onStatus("disconnected"); this.onError(error.message); }
          else { this.open(); }
        }
      }, delay);
    };
  }
  send(command) {
    if (this.socket?.readyState !== WebSocket.OPEN || !this.view) { this.onError("Wait for the relay to reconnect before acting."); return false; }
    this.socket.send(JSON.stringify({ ...command, id: makeId(), epoch: this.view.epoch }));
    return true;
  }
  stop() {
    this.generation++; this.stopped = true; clearTimeout(this.timer); clearInterval(this.heartbeat);
    this.socket?.close(1000, "Left this screen"); this.socket = null; this.view = null;
  }
}
