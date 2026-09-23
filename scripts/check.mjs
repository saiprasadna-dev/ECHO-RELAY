import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
const roots = ["public", "worker", "scripts", "tests"];
let checked = 0;
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) { await walk(file); continue; }
    if (!/\.(?:m?js)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g)) await readFile(resolve(dirname(file), match[1]));
    checked++;
  }
}
for (const root of roots) await walk(root);
console.log(`Syntax and local imports checked: ${checked} JavaScript modules.`);
