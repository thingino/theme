#!/usr/bin/env node
/* Assembles _site/, the static bundle published to GitHub Pages.
 *
 *   _site/index.html    the preview page, verbatim
 *   _site/vendor/       Bootstrap, Bootstrap Icons, Montserrat (borrowed)
 *   _site/dist/         the built theme bundles and tokens.json
 *
 * This is exactly the layout scripts/preview.mjs serves locally, so the page
 * needs no path rewriting on the way out and the published copy cannot break in
 * a way the local one hides.
 *
 * dist/ is rebuilt here rather than trusted: the demo should show what src/
 * currently says. If a stale dist/ was committed, CI's separate --check job is
 * what complains about it.
 */

import { execFileSync } from "node:child_process";
import { rmSync, mkdirSync, cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { vendor, ROOT } from "./vendor.mjs";

const SITE = join(ROOT, "_site");

execFileSync(process.execPath, [join(ROOT, "scripts", "build.mjs")], { stdio: "inherit" });

rmSync(SITE, { recursive: true, force: true });
mkdirSync(SITE, { recursive: true });

cpSync(join(ROOT, "preview", "index.html"), join(SITE, "index.html"));
cpSync(join(ROOT, "dist"), join(SITE, "dist"), { recursive: true });

if (!vendor(join(SITE, "vendor"))) {
  console.error(
    "site: no sibling checkout to borrow Bootstrap from. In CI, check " +
      "thingino/thingino-verify out as a sibling directory first.",
  );
  process.exit(1);
}

/* Fail loudly rather than publishing a page that 404s half its assets. */
const REQUIRED = [
  "index.html",
  "dist/thingino-theme.css",
  "dist/tokens.json",
  "vendor/bootstrap.min.css",
  "vendor/bootstrap-icons.min.css",
  "vendor/montserrat.css",
];
const missing = REQUIRED.filter((f) => !existsSync(join(SITE, f)));
if (missing.length) {
  console.error("site: incomplete, missing:\n  " + missing.join("\n  "));
  process.exit(1);
}

let files = 0;
let bytes = 0;
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else {
      files++;
      bytes += st.size;
    }
  }
})(SITE);

console.log(
  "site: %s ready, %d files, %d KiB",
  relative(ROOT, SITE),
  files,
  Math.round(bytes / 1024),
);
