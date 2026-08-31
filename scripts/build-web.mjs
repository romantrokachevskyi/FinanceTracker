import { cp, mkdir, rm } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("www/", ROOT);

const ENTRIES = ["index.html", "manifest.webmanifest", "icons"];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const entry of ENTRIES) {
  await cp(new URL(entry, ROOT), new URL(entry, OUT), { recursive: true });
}

console.log(`staged ${ENTRIES.length} web entries into www/`);
