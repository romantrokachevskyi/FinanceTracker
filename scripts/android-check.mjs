import { readFile, readdir } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

const WEB_ASSETS = ["index.html", "manifest.webmanifest", "icons"];

async function readIfPresent(relativePath) {
  try {
    return await readFile(new URL(relativePath, ROOT), "utf8");
  } catch {
    return null;
  }
}

async function checkStaging(failures) {
  const source = await readIfPresent("scripts/build-web.mjs");
  if (source === null) {
    failures.push("scripts/build-web.mjs is missing");
    return;
  }
  for (const asset of WEB_ASSETS) {
    if (!source.includes(`"${asset}"`)) {
      failures.push(`build-web.mjs must stage ${asset}`);
    }
  }
  for (const forbidden of ["node_modules", "docs", ".agents", "android"]) {
    if (source.includes(`"${forbidden}"`)) {
      failures.push(`build-web.mjs must not stage ${forbidden}`);
    }
  }
}

async function checkGitignore(failures) {
  const ignore = await readIfPresent(".gitignore");
  if (ignore === null) {
    failures.push(".gitignore is missing");
    return;
  }
  for (const entry of ["node_modules", "www/", "keystore.properties", "*.jks"]) {
    if (!ignore.includes(entry)) {
      failures.push(`.gitignore must ignore ${entry}`);
    }
  }
}

export async function checkAndroid() {
  const failures = [];
  await checkStaging(failures);
  await checkGitignore(failures);
  return failures;
}
