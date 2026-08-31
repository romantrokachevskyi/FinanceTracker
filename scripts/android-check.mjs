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

export async function checkAndroid() {
  const failures = [];
  await checkStaging(failures);
  await checkGitignore(failures);
  await checkIdentity(failures);
  await checkPrivacy(failures);
  return failures;
}
