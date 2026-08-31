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

const APP_ID = "io.github.romantrokachevskyi.dozarplaty";
const APP_NAME_UK = "До зарплати";

async function checkIdentity(failures) {
  const raw = await readIfPresent("capacitor.config.json");
  if (raw === null) {
    failures.push("capacitor.config.json is missing");
  } else {
    const config = JSON.parse(raw);
    if (config.appId !== APP_ID) failures.push(`capacitor appId must be ${APP_ID}`);
    if (config.webDir !== "www") failures.push("capacitor webDir must be www");
    if (config.server?.androidScheme !== "https") {
      failures.push("androidScheme must be https to keep the localStorage origin stable");
    }
  }

  const gradle = await readIfPresent("android/app/build.gradle");
  if (gradle === null) {
    failures.push("android/app/build.gradle is missing");
  } else {
    if (!gradle.includes(`applicationId "${APP_ID}"`)) {
      failures.push(`gradle applicationId must be ${APP_ID}`);
    }
    if (!/versionName "\d+\.\d+\.\d+"/.test(gradle)) {
      failures.push("gradle versionName must be semantic");
    }
  }

  const variables = await readIfPresent("android/variables.gradle");
  if (variables === null) {
    failures.push("android/variables.gradle is missing");
  } else {
    for (const key of ["compileSdkVersion", "targetSdkVersion"]) {
      if (!variables.includes(`${key} = 36`)) {
        failures.push(`${key} must be 36 for Play submission`);
      }
    }
  }

  const strings = await readIfPresent("android/app/src/main/res/values/strings.xml");
  if (strings === null) {
    failures.push("android strings.xml is missing");
  } else if (!strings.includes(`>${APP_NAME_UK}<`)) {
    failures.push(`android app_name must be ${APP_NAME_UK}`);
  }
}

async function checkPrivacy(failures) {
  const manifest = await readIfPresent("android/app/src/main/AndroidManifest.xml");
  if (manifest === null) {
    failures.push("AndroidManifest.xml is missing");
    return;
  }
  if (!manifest.includes('android:allowBackup="false"')) {
    failures.push("allowBackup must be false to keep financial data on device");
  }
  if (!manifest.includes("android:dataExtractionRules")) {
    failures.push("dataExtractionRules must be declared");
  }
  if (!manifest.includes('android.permission.INTERNET" tools:node="remove"')) {
    failures.push("INTERNET permission must stay removed so the offline promise is OS-enforced");
  }
}

async function checkArtwork(failures) {
  // Compare without line endings: the two files were committed under different
  // eol rules, so a byte comparison fails on a fresh checkout even when the
  // artwork is identical.
  const normalize = (text) => text.replace(/\r\n/g, "\n").trim();
  const source = await readIfPresent("icons/app-icon.svg");
  const generated = await readIfPresent("assets/icon.svg");
  if (generated === null) {
    failures.push("assets/icon.svg is missing");
  } else if (source !== null && normalize(source) !== normalize(generated)) {
    failures.push("assets/icon.svg must stay identical to icons/app-icon.svg");
  }
  try {
    const mipmaps = await readdir(new URL("android/app/src/main/res/mipmap-anydpi-v26", ROOT));
    if (!mipmaps.includes("ic_launcher.xml")) {
      failures.push("adaptive launcher icon is missing");
    }
  } catch {
    failures.push("adaptive launcher icon directory is missing");
  }
}

async function checkSigning(failures) {
  const gradle = await readIfPresent("android/app/build.gradle");
  if (gradle === null) return;
  if (!gradle.includes("keystore.properties")) {
    failures.push("release signing must read android/keystore.properties");
  }
  if (!gradle.includes("signingConfigs")) {
    failures.push("release signingConfig is missing");
  }
  const example = await readIfPresent("android/keystore.properties.example");
  if (example === null) {
    failures.push("android/keystore.properties.example is missing");
  } else if (example.split("\n").some((line) => !line.startsWith("#") && /=\s*\S/.test(line))) {
    failures.push("keystore.properties.example must not contain real values");
  }
  const ignore = await readIfPresent(".gitignore");
  if (ignore !== null && !ignore.includes("android/keystore.properties")) {
    failures.push("android/keystore.properties must be gitignored");
  }
}

async function checkServer(failures) {
  const source = await readIfPresent("scripts/serve.mjs");
  if (source === null) {
    failures.push("scripts/serve.mjs is missing");
    return;
  }
  for (const seed of ["setup", "dashboard", "checkin", "payday"]) {
    if (!source.includes(`${seed}:`)) {
      failures.push(`serve.mjs must define the ${seed} seed`);
    }
  }
  const html = await readIfPresent("index.html");
  if (html !== null && html.includes("seed")) {
    failures.push("index.html must not contain seeding hooks");
  }
}

async function checkPolicy(failures) {
  const policy = await readIfPresent("docs/privacy/index.html");
  if (policy === null) {
    failures.push("docs/privacy/index.html is missing");
    return;
  }
  for (const marker of ['lang="uk"', "конфіденційності", "Privacy Policy"]) {
    if (!policy.includes(marker)) {
      failures.push(`privacy policy must include ${marker}`);
    }
  }
  if ((await readIfPresent("docs/index.html")) === null) {
    failures.push("docs/index.html is missing, GitHub Pages would serve a directory listing");
  }
}

const LISTINGS = [
  ["docs/store/listing-uk.md", APP_NAME_UK],
  ["docs/store/listing-en.md", "Until Payday"]
];

async function checkListing(failures) {
  for (const [path, name] of LISTINGS) {
    const text = await readIfPresent(path);
    if (text === null) {
      failures.push(`${path} is missing`);
      continue;
    }
    if (!text.includes(name)) failures.push(`${path} must use the app name ${name}`);
    const short = text.match(/## Short description\n\n(.+)/);
    if (!short) {
      failures.push(`${path} must contain a short description`);
    } else if (short[1].trim().length > 80) {
      failures.push(`${path} short description is ${short[1].trim().length} chars, over Play's 80 limit`);
    }
    const full = text.match(/## Full description\n\n([\s\S]+?)\n## /);
    if (!full) {
      failures.push(`${path} must contain a full description`);
    } else if (full[1].trim().length > 4000) {
      failures.push(`${path} full description is ${full[1].trim().length} chars, over Play's 4000 limit`);
    }
  }
  if ((await readIfPresent("docs/store/data-safety.md")) === null) {
    failures.push("docs/store/data-safety.md is missing");
  }
}

const STORE_IMAGES = [
  ["docs/store/assets/01-setup.png", 1080, 1920],
  ["docs/store/assets/02-dashboard.png", 1080, 1920],
  ["docs/store/assets/03-checkin.png", 1080, 1920],
  ["docs/store/assets/04-english.png", 1080, 1920],
  ["docs/store/assets/feature-graphic.png", 1024, 500]
];

async function checkStoreImages(failures) {
  for (const [path, width, height] of STORE_IMAGES) {
    let bytes;
    try {
      bytes = await readFile(new URL(path, ROOT));
    } catch {
      failures.push(`${path} is missing`);
      continue;
    }
    const actual = `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
    if (actual !== `${width}x${height}`) {
      failures.push(`${path} is ${actual}, the Console expects ${width}x${height}`);
    }
  }
}

export async function checkAndroid() {
  const failures = [];
  await checkStaging(failures);
  await checkGitignore(failures);
  await checkIdentity(failures);
  await checkPrivacy(failures);
  await checkArtwork(failures);
  await checkSigning(failures);
  await checkServer(failures);
  await checkPolicy(failures);
  await checkListing(failures);
  await checkStoreImages(failures);
  return failures;
}
