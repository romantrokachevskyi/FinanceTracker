// Local development and screenshot server.
//
// Serves the repository root. When a request for the app carries ?seed=<name>,
// a small script is injected that writes financeTrackerStateV1 before the app
// script runs, so store screenshots show real states without adding any
// store-only code to index.html.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { SEEDS } from "./store-seeds.mjs";

const ROOT = new URL("../", import.meta.url);
const PORT = Number(process.argv[2] ?? 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function inject(html, seed) {
  const { state, open } = SEEDS[seed]();
  const write = state
    ? `localStorage.setItem("financeTrackerStateV1",${JSON.stringify(JSON.stringify(state))});`
    : "";
  const reveal = open
    ? `<script>addEventListener("load",function(){var b=document.getElementById(${JSON.stringify(open)});if(b)b.click()})</script>`
    : "";
  const script = `<script>try{localStorage.clear();${write}}catch(e){}</script>`;
  return html.replace("</head>", `${script}</head>`) + reveal;
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const path = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (path.includes("..")) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("forbidden");
    return;
  }
  try {
    const body = await readFile(new URL(path, ROOT));
    const type = TYPES[extname(path)] ?? "application/octet-stream";
    const seed = url.searchParams.get("seed");
    response.writeHead(200, { "content-type": type });
    if (path === "index.html" && seed && Object.hasOwn(SEEDS, seed)) {
      response.end(inject(body.toString("utf8"), seed));
      return;
    }
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
}).listen(PORT, () => console.log(`serving on http://localhost:${PORT}`));
