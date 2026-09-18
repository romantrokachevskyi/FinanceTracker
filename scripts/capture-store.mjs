// Captures raw store screenshots from the debug build on a connected device or
// emulator: every shot in store-seeds.mjs, in each store language. Crop the
// result with scripts/store-shots.mjs.
//
//   node scripts/capture-store.mjs [raw-dir]     (default docs/store/assets/raw)
//
// Needs the debug build installed (WebView debugging is on only there) and
// Android 13+ for per-app locales. The demo state is written through the
// WebView's DevTools socket, so index.html carries no store-only code. This
// replaces the app's local data on the device and leaves a demo plan behind.

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SEEDS, STORE_LANGUAGES, STORE_SHOTS } from "./store-seeds.mjs";

const run = promisify(execFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PACKAGE = "io.github.romantrokachevskyi.dozarplaty";
const ADB = process.env.ADB
  ?? `${process.env.ANDROID_HOME ?? `${process.env.LOCALAPPDATA}/Android/Sdk`}/platform-tools/adb`;
const PORT = 9333;
const RAW = process.argv[2]
  ? pathToFileURL(process.argv[2].replace(/\/?$/, "/"))
  : new URL("../docs/store/assets/raw/", import.meta.url);

const adb = (...args) => run(ADB, args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });

// Polls the DevTools socket until the app's page is listed.
async function pageUrl() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = pages.find((entry) => entry.type === "page" && entry.url.startsWith("https://localhost"));
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // DevTools socket not up yet.
    }
    await sleep(500);
  }
  throw new Error("the app's WebView never exposed a DevTools page; is the debug build installed?");
}

async function launch() {
  await adb("shell", "am", "force-stop", PACKAGE);
  await adb("shell", "monkey", "-p", PACKAGE, "-c", "android.intent.category.LAUNCHER", "1");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    // pidof exits non-zero until the process exists.
    const pid = (await adb("shell", "pidof", PACKAGE).catch(() => ({ stdout: "" }))).stdout.toString().trim();
    if (pid) {
      await adb("forward", `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
      return pageUrl();
    }
    await sleep(500);
  }
  throw new Error(`${PACKAGE} did not start`);
}

function connect(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    const failure = message.error?.message ?? message.result?.exceptionDetails?.exception?.description;
    if (failure) call.reject(new Error(failure));
    else call.resolve(message.result?.result?.value);
  });
  socket.addEventListener("close", () => {
    for (const { reject } of pending.values()) reject(new Error("DevTools socket closed"));
    pending.clear();
  });
  // awaitPromise lets an expression wait on the page itself.
  const evaluate = (expression) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true } }));
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve({ evaluate, close: () => socket.close() }));
    socket.addEventListener("error", () => reject(new Error(`cannot open DevTools socket ${url}`)));
  });
}

async function capture(language, name, seed) {
  const { state, open } = seed();
  const page = await connect(await launch());
  const writes = [
    "localStorage.clear()",
    `localStorage.setItem("financeTrackerLocaleV1",${JSON.stringify(language)})`,
    state ? `localStorage.setItem("financeTrackerStateV1",${JSON.stringify(JSON.stringify(state))})` : ""
  ].filter(Boolean).join(";");
  // The reply can be lost to the reload it triggers; the reconnect below is
  // what confirms the page came back.
  page.evaluate(`${writes};setTimeout(()=>location.reload())`).catch(() => {});
  await sleep(500);
  page.close();
  // A reload keeps the process, so reconnect to the same page once it has
  // loaded. The app moves focus to a heading on load; its outline would read
  // as a glitch in a store image, so drop focus last.
  await sleep(500);
  const reloaded = await connect(await pageUrl());
  await reloaded.evaluate(
    `new Promise(done=>document.readyState==="complete"?done():addEventListener("load",()=>done()))`
  );
  const reveal = open ? `document.getElementById(${JSON.stringify(open)}).click();` : "";
  await reloaded.evaluate(`${reveal}document.activeElement?.blur()`);
  reloaded.close();
  await sleep(1000);
  const png = (await adb("exec-out", "screencap", "-p")).stdout;
  await writeFile(new URL(`${language}/${name}.png`, RAW), png);
  console.log(`${language}/${name}.png`);
}

try {
  for (const [language, locale] of Object.entries(STORE_LANGUAGES)) {
    await mkdir(new URL(`${language}/`, RAW), { recursive: true });
    await adb("shell", "cmd", "locale", "set-app-locales", PACKAGE, "--locales", locale);
    for (const [name, seedName] of Object.entries(STORE_SHOTS)) {
      await capture(language, name, SEEDS[seedName]);
    }
  }
  console.log(`raw captures in ${fileURLToPath(RAW)}`);
} finally {
  await adb("shell", "cmd", "locale", "set-app-locales", PACKAGE, "--locales", "").catch(() => {});
  await adb("forward", "--remove", `tcp:${PORT}`).catch(() => {});
}
