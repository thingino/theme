#!/usr/bin/env node
/* Serves the preview page over http, after borrowing Bootstrap and Montserrat
 * from a sibling app checkout (see scripts/vendor.mjs for why they are not
 * committed here).
 *
 * http rather than opening the file directly because the page fetches
 * dist/tokens.json to draw its swatches, which file:// blocks.
 *
 *   node scripts/preview.mjs            # serve :8080
 *   node scripts/preview.mjs --port N
 */

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { vendor, ROOT } from "./vendor.mjs";
import { stamp } from "./stamp.mjs";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
};

if (!vendor()) {
  console.warn("preview: the page will load but Bootstrap parts will be unstyled.");
}

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? Number(process.argv[portArg + 1]) : 8080;

/* Maps a request onto the same layout scripts/site.mjs publishes:
 *
 *   /            preview/index.html
 *   /vendor/...  preview/vendor/...
 *   /dist/...    dist/...
 *
 * Serving the identical shape locally is the point: the preview page uses one
 * set of relative paths that works both here and on Pages, so nothing has to be
 * rewritten on the way out and the published page cannot break in a way the
 * local one hides. */
function resolve(pathname) {
  if (pathname === "/" || pathname === "/index.html") {
    return join(ROOT, "preview", "index.html");
  }
  if (pathname.startsWith("/vendor/")) return join(ROOT, "preview", pathname);
  if (pathname.startsWith("/dist/")) return join(ROOT, pathname);
  return null;
}

createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const target = resolve(p);
  /* normalize() then the prefix test keeps a `..` in the request from walking
   * out of the repo. */
  const file = target && normalize(target);
  if (!file || !file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found: " + p);
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] || "application/octet-stream",
    "cache-control": "no-store",
  });
  /* Stamped on the way out, the same substitution the Pages build does, so
     the local page and the published one differ in nothing at all. */
  res.end(
    extname(file) === ".html"
      ? stamp(readFileSync(file, "utf8"))
      : readFileSync(file),
  );
}).listen(port, () => {
  console.log("preview: http://localhost:%d/", port);
});
