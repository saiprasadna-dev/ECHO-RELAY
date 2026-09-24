import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("local adapter serves browser assets and rejects traversal on the host OS", { timeout: 15000 }, async t => {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));

  const dataDir = await mkdtemp(join(tmpdir(), "echo-relay-assets-"));
  const child = spawn(process.execPath, ["scripts/dev-server.mjs"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, PORT: String(port), RELAY_DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
    await rm(dataDir, { recursive: true, force: true });
  });
  let output = "", errors = "";
  child.stderr.on("data", chunk => { errors += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Adapter startup timed out: ${errors}`)), 8000);
    const finish = callback => value => { clearTimeout(timeout); callback(value); };
    child.once("error", finish(reject));
    child.once("exit", finish(() => reject(new Error(`Adapter exited before startup: ${errors}`))));
    child.stdout.on("data", chunk => {
      output += chunk;
      if (output.includes(`http://127.0.0.1:${port}`)) finish(resolve)();
    });
  });

  const origin = `http://127.0.0.1:${port}`;
  for (const [path, type, marker] of [
    ["/", "text/html", "ECHO RELAY"],
    ["/app.js", "text/javascript", "renderHome"],
    ["/core/game.js", "text/javascript", "createRoom"],
    ["/transport.js", "text/javascript", "RelayConnection"],
    ["/scenes.js", "text/javascript", "scene"],
    ["/styles.css", "text/css", ".hero"],
    ["/cinematic.css", "text/css", ".cinematic-world"],
    ["/favicon.svg", "image/svg+xml", "<svg"]
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get("content-type").startsWith(type), path);
    assert.ok((await response.text()).includes(marker), path);
  }
  for (const name of ["garden", "garden-past", "garden-bridge", "garden-flooded", "workshop", "observatory"]) {
    const response = await fetch(`${origin}/assets/${name}.webp`);
    assert.equal(response.status, 200, name);
    assert.equal(response.headers.get("content-type"), "image/webp", name);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), "WEBP", name);
  }
  for (const path of ["/..%2fpackage.json", "/..%5cpackage.json", "/missing.js", "/android.apk"]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 404, path);
    await response.text();
  }
});
