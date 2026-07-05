// build.mjs — esbuildによるビルドスクリプト
// 使い方: node build.mjs        （1回ビルド）
//        node build.mjs --watch （変更監視）
import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";

const watch = process.argv.includes("--watch");

const common = {
  bundle: true,
  format: "esm",
  absWorkingDir: process.cwd(),
  tsconfig: path.resolve("tsconfig.json"),
  target: "chrome114",
  jsx: "automatic",
  jsxImportSource: "preact",
  logLevel: "info",
  minify: false,
  sourcemap: false,
};

const contexts = [
  { entryPoints: [path.resolve("src/background/index.ts")], outfile: path.resolve("dist/background.js") },
  { entryPoints: [path.resolve("src/content-scripts/entryList.ts")], outfile: path.resolve("dist/content/list.js"), format: "iife" },
  { entryPoints: [path.resolve("src/content-scripts/entryDetail.ts")], outfile: path.resolve("dist/content/detail.js"), format: "iife" },
  { entryPoints: [path.resolve("src/content-scripts/entryPage.ts")], outfile: path.resolve("dist/content/page.js"), format: "iife" },
  { entryPoints: [path.resolve("src/sidepanel/index.tsx")], outfile: path.resolve("dist/sidepanel/index.js") },
];

function copyStatic() {
  mkdirSync("dist/sidepanel", { recursive: true });
  mkdirSync("dist/icons", { recursive: true });
  cpSync("public/manifest.json", "dist/manifest.json");
  cpSync("src/sidepanel/index.html", "dist/sidepanel/index.html");
  cpSync("src/sidepanel/styles.css", "dist/sidepanel/styles.css");
  cpSync("public/icons", "dist/icons", { recursive: true });
}

copyStatic();

if (watch) {
  for (const cfg of contexts) {
    const ctx = await esbuild.context({ ...common, ...cfg });
    await ctx.watch();
  }
  console.log("watching…");
} else {
  for (const cfg of contexts) {
    await esbuild.build({ ...common, ...cfg });
  }
  console.log("build complete → dist/");
}
