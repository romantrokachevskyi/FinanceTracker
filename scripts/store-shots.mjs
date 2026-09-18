// Builds the Play Console artwork in docs/store/assets/.
//
// Screenshots are real captures from the app running on a device, made by
// scripts/capture-store.mjs into <raw>/<language>/<name>.png. A phone capture is 1080x2424, which is 2.24:1 and taller than the
// 2:1 the Console accepts, so each one is cropped to 1080x1920 with the status
// bar and navigation bar trimmed off.
//
// Cropping and the feature graphic both render through headless Chrome, so the
// repository needs no image library. Chrome enforces a minimum window width,
// which is why every capture here is well above it.

import { execFile } from "node:child_process";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const run = promisify(execFile);

const CHROME = process.env.CHROME_PATH
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const OUT = new URL("../docs/store/assets/", import.meta.url);
const RAW = process.argv[2]
  ? pathToFileURL(process.argv[2].replace(/\/?$/, "/"))
  : new URL("raw/", OUT);

const WIDTH = 1080;
const HEIGHT = 1920;
const TOP_TRIM = 140; // status bar

const LANGUAGES = ["en", "uk"];
const SCREENSHOTS = ["01-setup", "02-dashboard", "03-checkin", "04-payday"];

async function shoot(url, file, width, height) {
  await run(CHROME, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--virtual-time-budget=3000",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    `--screenshot=${fileURLToPath(file)}`,
    url
  ]);
}

async function dimensions(file) {
  const bytes = await readFile(file);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

for (const language of LANGUAGES) {
  const dir = new URL(`${language}/`, OUT);
  await mkdir(dir, { recursive: true });
  for (const name of SCREENSHOTS) {
    const source = new URL(`${language}/${name}.png`, RAW);
    const page = new URL(`.${name}-crop.html`, dir);
    await writeFile(
      fileURLToPath(page),
      `<body style="margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden">` +
        `<img src="${source.href}" style="position:absolute;left:0;top:${-TOP_TRIM}px;width:${WIDTH}px">`
    );
    const out = new URL(`${name}.png`, dir);
    await shoot(page.href, out, WIDTH, HEIGHT);
    await rm(page);
    console.log(`${language}/${name}.png -> ${await dimensions(out)}`);
  }
  const graphic = new URL("feature-graphic.png", dir);
  await shoot(new URL("feature-graphic.svg", dir).href, graphic, 1024, 500);
  console.log(`${language}/feature-graphic.png -> ${await dimensions(graphic)}`);
}
