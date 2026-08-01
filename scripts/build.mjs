#!/usr/bin/env node
/* Builds dist/ from src/. No dependencies: `node scripts/build.mjs` is the
 * whole toolchain, so a consumer can regenerate the theme with nothing but a
 * node binary and CI needs no install step.
 *
 * `--check` builds to memory and diffs against the committed dist/ instead of
 * writing, exiting non-zero if they differ. That is what keeps a hand-edit of
 * src/ from shipping without its rebuilt bundle.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const check = process.argv.includes("--check");

const read = (name) => readFileSync(join(SRC, name), "utf8").trimEnd();

/* Each bundle is a plain concatenation in load order. Ordering matters:
 * tokens must precede anything that reads them, and the Bootstrap bridge must
 * come last so it can override components. */
const BUNDLES = {
  /* Tokens alone, for an app that wants the palette and nothing else. */
  "thingino-tokens.css": ["tokens.css"],
  /* Framework-neutral: tokens + shared widgets. buildscope's tier. */
  "thingino-base.css": ["tokens.css", "components.css"],
  /* Everything, for the Bootstrap apps: one <link>, one file to vendor. The
   * alt layer rides along inert (`data-th-alt` on <html> switches it on), and
   * so does RTL (inert until something sets dir="rtl"). */
  "thingino-theme.css": ["tokens.css", "components.css", "bootstrap.css", "alt.css", "rtl.css"],
  /* Opt-in bare-name compatibility. Deliberately its own file. */
  "thingino-aliases.css": ["aliases.css"],
  /* Standalone RTL for apps not on the full bundle. */
  "thingino-rtl.css": ["rtl.css"],
};

function banner(parts) {
  return [
    "/*! thingino theme v" + version,
    " *",
    " * GENERATED FILE, DO NOT EDIT. Built from src/" +
      parts.join(" + src/") +
      ".",
    " * Source and issues: https://github.com/thingino/theme",
    " */",
    "",
  ].join("\n");
}

const built = new Map();
for (const [out, parts] of Object.entries(BUNDLES)) {
  built.set(out, banner(parts) + parts.map(read).join("\n\n") + "\n");
}

/* tokens.json: the same values in a form JS can read, so a canvas chart or a
 * React app picks colors from the one source instead of re-typing hexes.
 * Values are all literals (no var() indirection), so they are usable as-is. */
const tokensCss = read("tokens.css");
const tokens = {};
for (const m of tokensCss.matchAll(/^\s*(--th-[\w-]+)\s*:\s*([^;]+);/gm)) {
  tokens[m[1]] = m[2].trim().replace(/\s*\n\s*/g, " ");
}
if (Object.keys(tokens).length < 20) {
  console.error("build: only %d tokens parsed, src/tokens.css changed shape?", Object.keys(tokens).length);
  process.exit(1);
}
built.set(
  "tokens.json",
  JSON.stringify({ version, tokens }, null, 2) + "\n",
);

if (check) {
  let bad = 0;
  for (const [name, content] of built) {
    const path = join(DIST, name);
    const have = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (have !== content) {
      console.error("out of date: dist/%s", name);
      bad++;
    }
  }
  if (bad) {
    console.error("\n%d file(s) stale. Run `node scripts/build.mjs` and commit dist/.", bad);
    process.exit(1);
  }
  console.log("dist/ is in sync with src/ (%d files)", built.size);
} else {
  mkdirSync(DIST, { recursive: true });
  for (const [name, content] of built) {
    writeFileSync(join(DIST, name), content);
    console.log("wrote dist/%s (%d bytes)", name, Buffer.byteLength(content));
  }
}
