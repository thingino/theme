#!/usr/bin/env node
/* Serves the preview page, after copying Bootstrap and Montserrat in from a
 * sibling app checkout.
 *
 * Those assets are NOT committed here. The apps own the Bootstrap version pin,
 * and a second copy in the theme repo would be free to drift from it without
 * anything noticing. So the preview borrows whatever the apps are actually
 * shipping, which is also the honest thing to preview against.
 *
 *   node scripts/preview.mjs            # find a sibling checkout, serve :8080
 *   node scripts/preview.mjs --port N
 */

import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = join(ROOT, "preview", "vendor");

/* In sibling-checkout order of preference. Each ships the same vendored trio. */
const DONORS = [
  join(ROOT, "..", "thingino-verify", "web", "vendor"),
  join(ROOT, "..", "thingino-image-builder", "web", "vendor"),
];
const WANT = ["bootstrap.min.css", "bootstrap-icons.min.css", "montserrat.css"];

function vendor() {
  const donor = DONORS.find((d) => existsSync(join(d, "bootstrap.min.css")));
  if (!donor) {
    console.warn("preview: no sibling app checkout with vendor/ found, looked in:");
    for (const d of DONORS) console.warn("  " + d);
    console.warn("preview: the page will load but Bootstrap parts will be unstyled.");
    return;
  }
  mkdirSync(VENDOR, { recursive: true });
  for (const f of WANT) {
    if (existsSync(join(donor, f))) copyFileSync(join(donor, f), join(VENDOR, f));
  }
  /* Font files and icon glyphs live in subdirectories next to the CSS; copy
   * whatever is there so @font-face src urls resolve. */
  for (const entry of readdirSync(donor)) {
    const p = join(donor, entry);
    if (!statSync(p).isDirectory()) continue;
    mkdirSync(join(VENDOR, entry), { recursive: true });
    for (const f of readdirSync(p)) {
      const fp = join(p, f);
      if (statSync(fp).isFile()) copyFileSync(fp, join(VENDOR, entry, f));
    }
  }
  console.log("preview: vendored assets from %s", donor);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
};

vendor();

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? Number(process.argv[portArg + 1]) : 8080;

createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/preview/index.html";
  /* Serve from the repo root so /preview/ can reach ../dist/. normalize() then
   * the prefix test keeps `..` in a request from escaping the repo. */
  const file = normalize(join(ROOT, p));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found: " + p);
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  res.end(readFileSync(file));
}).listen(port, () => {
  console.log("preview: http://localhost:%d/preview/index.html", port);
});
