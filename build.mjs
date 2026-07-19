// build.mjs — esbuildによるビルドスクリプト
// 使い方: node build.mjs        （1回ビルド）
//        node build.mjs --watch （変更監視）
import * as esbuild from "esbuild";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const watch = process.argv.includes("--watch");
const extensionBuild = process.argv.includes("--extension");
const rootDir = path.resolve(".");
const firebaseDefaults = {
  apiKey: "AIzaSyDN9IUtgYOZEk6fiQDALiWMA9SWhvHVXZg",
  authDomain: "jobhunt-b0f49.firebaseapp.com",
  projectId: "jobhunt-b0f49",
  storageBucket: "jobhunt-b0f49.firebasestorage.app",
  messagingSenderId: "517342175968",
  appId: "1:517342175968:web:2e97e54ad9a5e7824c2685",
  measurementId: "G-LJMM163TMF",
};

const common = {
  bundle: true,
  format: "esm",
  absWorkingDir: rootDir,
  tsconfig: "tsconfig.json",
  nodePaths: [path.join(rootDir, "node_modules")],
  target: "chrome114",
  jsx: "automatic",
  jsxImportSource: "preact",
  logLevel: "info",
  minify: false,
  sourcemap: false,
  define: {
    __JOBHUNT_FIREBASE_CONFIG__: JSON.stringify({
      apiKey: process.env.JOBHUNT_FIREBASE_API_KEY ?? firebaseDefaults.apiKey,
      authDomain: process.env.JOBHUNT_FIREBASE_AUTH_DOMAIN ?? firebaseDefaults.authDomain,
      projectId: process.env.JOBHUNT_FIREBASE_PROJECT_ID ?? firebaseDefaults.projectId,
      storageBucket: process.env.JOBHUNT_FIREBASE_STORAGE_BUCKET ?? firebaseDefaults.storageBucket,
      messagingSenderId: process.env.JOBHUNT_FIREBASE_MESSAGING_SENDER_ID ?? firebaseDefaults.messagingSenderId,
      appId: process.env.JOBHUNT_FIREBASE_APP_ID ?? firebaseDefaults.appId,
      measurementId: process.env.JOBHUNT_FIREBASE_MEASUREMENT_ID ?? firebaseDefaults.measurementId,
    }),
  },
};

const extensionContexts = [
  { entryPoints: ["./src/background/index.ts"], outfile: "dist/background.js" },
  { entryPoints: ["./src/content-scripts/entryList.ts"], outfile: "dist/content/list.js", format: "iife" },
  { entryPoints: ["./src/content-scripts/entryDetail.ts"], outfile: "dist/content/detail.js", format: "iife" },
  { entryPoints: ["./src/content-scripts/entryPage.ts"], outfile: "dist/content/page.js", format: "iife" },
  { entryPoints: ["./src/sidepanel/index.tsx"], outfile: "dist/sidepanel/index.js" },
];

const webContexts = [
  { entryPoints: ["./src/web/index.tsx"], outfile: "web-dist/app.js" },
];

function copyStatic() {
  mkdirSync("dist/sidepanel", { recursive: true });
  mkdirSync("dist/icons", { recursive: true });
  if (existsSync("public/index.html")) {
    cpSync("public/index.html", "dist/index.html");
  }
  cpSync("public/manifest.json", "dist/manifest.json");
  cpSync("src/sidepanel/index.html", "dist/sidepanel/index.html");
  cpSync("src/sidepanel/styles.css", "dist/sidepanel/styles.css");
  cpSync("public/icons", "dist/icons", { recursive: true });
}

function copyWebStatic() {
  mkdirSync("web-dist", { recursive: true });
  cpSync("src/web/index.html", "web-dist/index.html");
  cpSync("src/web/styles.css", "web-dist/styles.css");
}

const contexts = extensionBuild ? extensionContexts : webContexts;
if (extensionBuild) copyStatic();
else copyWebStatic();

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
  console.log(
    extensionBuild
      ? "extension build complete → dist/"
      : "web build complete → web-dist/"
  );
}
