// Captures raw store screenshots from the debug build on a connected device or
// emulator: every seed in store-seeds.mjs, in each store language. Crop the
// result with scripts/store-shots.mjs.
//
//   node scripts/capture-store.mjs [raw-dir]     (default docs/store/assets/raw)
//
// Needs the debug build installed (WebView debugging is on only there) and
// Android 13+ for per-app locales. The demo state is written through the
// WebView's DevTools socket, so index.html carries no store-only code. This
// clears the app's local data on the device.

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SEEDS } from "./store-seeds.mjs";

const run = promisify(execFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PACKAGE = "io.github.romantrokachevskyi.dozarplaty";
const ADB = process.env.ADB
  ?? `${process.env.ANDROID_HOME ?? `${process.env.LOCALAPPDATA}/Android/Sdk`}/platform-tools/adb`;
const PORT = 9333;
const RAW = process.argv[2]
  ? pathToFileURL(process.argv[2].replace(/\/?$/, "/"))
  : new URL("../docs/store/assets/raw/", import.meta.url);

// Store language folder → Android locale that also sets date formats.
const LANGUAGES = { en: "en-US", uk: "uk-UA" };
const SHOTS = { "01-setup": "setup", "02-dashboard": "dashboard", "03-checkin": "checkin", "04-payday": "payday" };

const adb = (...args) => run(ADB, args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });

async function pageUrl() {
  const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  return pages.find((entry) => entry.type === "page" && entry.url.startsWith("https://localhost"))?.webSocketDebuggerUrl;
}

async function launch() {
  await adb("shell", "am", "force-stop", PACKAGE);
  await adb("shell", "monkey", "-p", PACKAGE, "-c", "android.intent.category.LAUNCHER", "1");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(500);
    const pid = (await adb("shell", "pidof", PACKAGE)).stdout.toString().trim();
    if (!pid) continue;
    await adb("forward", `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`);
    try {
      const url = await pageUrl();
      if (url) return url;
    } catch {
      // DevTools socket not up yet.
    }
  }
  throw new Error("the app's WebView never exposed a DevTools page; is the debug build installed?");
}

function connect(url) {
  const socket = new WebSocket(url);
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  const evaluate = (expression) => new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression } }));
  });
  return new Promise((resolve) => socket.addEventListener("open", () => resolve({ evaluate, close: () => socket.close() })));
}

async function capture(language, name, seed) {
  const { state, open } = seed();
  const page = await connect(await launch());
  const writes = [
    "localStorage.clear()",
    `localStorage.setItem("financeTrackerLocaleV1",${JSON.stringify(language)})`,
    state ? `localStorage.setItem("financeTrackerStateV1",${JSON.stringify(JSON.stringify(state))})` : ""
  ].filter(Boolean).join(";");
  await page.evaluate(`${writes};location.reload()`);
  page.close();
  await sleep(2500);
  // A reload keeps the process, so reconnect to the same page. The app moves
  // focus to a heading on load; its outline would read as a glitch in a store
  // image, so drop focus before capturing.
  const reloaded = await connect(await pageUrl());
  const reveal = open ? `document.getElementById(${JSON.stringify(open)}).click();` : "";
  await reloaded.evaluate(`${reveal}document.activeElement?.blur()`);
  reloaded.close();
  await sleep(1000);
  const png = (await adb("exec-out", "screencap", "-p")).stdout;
  const out = new URL(`${language}/${name}.png`, RAW);
  await writeFile(out, png);
  console.log(`${language}/${name}.png`);
}

for (const [language, locale] of Object.entries(LANGUAGES)) {
  await mkdir(new URL(`${language}/`, RAW), { recursive: true });
  await adb("shell", "cmd", "locale", "set-app-locales", PACKAGE, "--locales", locale);
  for (const [name, seedName] of Object.entries(SHOTS)) {
    await capture(language, name, SEEDS[seedName]);
  }
}
await adb("shell", "cmd", "locale", "set-app-locales", PACKAGE, "--locales", "");
await adb("forward", "--remove", `tcp:${PORT}`);
console.log(`raw captures in ${fileURLToPath(RAW)}`);
