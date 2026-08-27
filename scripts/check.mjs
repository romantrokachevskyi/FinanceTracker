import { readFile } from "node:fs/promises";

const files = {
  html: new URL("../index.html", import.meta.url),
  agents: new URL("../AGENTS.md", import.meta.url),
  claude: new URL("../CLAUDE.md", import.meta.url),
  project: new URL("../.agents/project.md", import.meta.url),
  workflow: new URL("../.agents/workflow.md", import.meta.url)
};
const content = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([name, url]) => [name, await readFile(url, "utf8")])
));
const html = content.html;
const failures = [];

function requireMatch(pattern, message) {
  if (!pattern.test(html)) failures.push(message);
}

requireMatch(/<html\s+lang="uk">/, "index.html must declare Ukrainian content");
requireMatch(/viewport-fit=cover/, "mobile viewport must preserve safe-area support");
requireMatch(/const KEY="financeTrackerStateV1"/, "primary storage key changed");
requireMatch(/Date\.UTC\(/, "calendar calculations must remain DST-safe");
requireMatch(/<form\b/, "interactive inputs must retain form semantics");

if (content.claude.trim() !== "@AGENTS.md") {
  failures.push("CLAUDE.md must remain a thin import of AGENTS.md");
}

for (const name of ["agents", "project", "workflow"]) {
  if (content[name].split("\n").length > 120) {
    failures.push(`${name} instructions exceed the 120-line context budget`);
  }
}

if (/localStorage\.(?:clear|removeItem)\s*\(/.test(html)) {
  failures.push("destructive localStorage operation detected");
}

if (/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(html)) {
  failures.push("network API detected in the offline app");
}

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if (scripts.length !== 1) failures.push("expected exactly one inline application script");

for (const [, source] of scripts) {
  try {
    Function(source);
  } catch (error) {
    failures.push(`JavaScript syntax error: ${error.message}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("FinanceTracker checks passed");
}
