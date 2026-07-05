// tests/smoke.test.mjs — 実DOMフィクスチャに対するパーサーのスモークテスト
// 実行: node tests/smoke.test.mjs
// サイトのDOMが変わった疑いがあるときは、対象ページを「名前を付けて保存」して
// tests/fixtures/ を差し替え、このテストで検証してからセレクタを直す。
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

const abs = (p) => path.resolve(p).replace(/\\/g, "/");

await esbuild.build({
  entryPoints: ["./tests/smoke.entry.ts"],
  tsconfig: abs("tsconfig.json"),
  nodePaths: [abs("node_modules")],
  bundle: true, format: "esm", outfile: abs("tests/smoke.bundle.mjs"), platform: "node",
});
const { parseWantedlyList, parseOnecareerList, parseOpenwork } = await import("./smoke.bundle.mjs");

function load(file, url) {
  const html = readFileSync(`tests/fixtures/${file}`, "utf-8");
  const dom = new JSDOM(html, { url });
  globalThis.location = dom.window.location;
  return dom.window.document;
}

const wCards = parseWantedlyList(load("wantedly-list.html", "https://www.wantedly.com/projects"));
console.log(`[Wantedly] ${wCards.length}件抽出`);
for (const c of wCards.slice(0, 3)) console.log("  -", c.companyName, "|", c.jobTitle.slice(0, 35), "|", c.detailUrl);

const oCards = parseOnecareerList(load("onecareer-list.html", "https://www.onecareer.jp/companies"));
console.log(`[ONE CAREER] ${oCards.length}件抽出`);
for (const c of oCards.slice(0, 3)) console.log("  -", c.companyName, "|", c.detailUrl);

const owText = parseOpenwork(load("openwork-home.html", "https://www.openwork.jp/"));
console.log(`[OpenWork] 抽出${owText.length}文字`);

const pass = wCards.length >= 5 && oCards.length >= 5 && owText.length > 100;
console.log(pass ? "\n=== SMOKE TEST: PASS ===" : "\n=== SMOKE TEST: FAIL ===");
process.exit(pass ? 0 : 1);
