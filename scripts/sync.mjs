#!/usr/bin/env node
/* Copies the built theme into sibling app checkouts.
 *
 * Dry by default: it prints what would change and touches nothing. Pass
 * --write to actually copy. It never COMMITS anything, so a theme change
 * arrives in each app as a plain working-tree diff for you to read and commit
 * there.
 *
 * Each copy gets the theme commit appended to its banner line
 * (`· thingino/theme@<sha>`), so a vendored file always answers "which theme
 * is this?" on its own, and an app that has fallen behind is detectable by
 * reading one line. The sha is the last commit that touched src/ or dist/,
 * not HEAD, so a docs-only commit here does not make every app look stale.
 *
 *   node scripts/sync.mjs                    # what would change, everywhere
 *   node scripts/sync.mjs --write            # copy it in
 *   node scripts/sync.mjs --write verify     # just one target
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIBS = join(ROOT, "..");

/* Where each app wants the theme. `bundle` is the dist file, `dest` is
 * relative to that app's checkout. Both are chosen to sit beside the other
 * vendored CSS the app already loads. */
const TARGETS = [
  {
    name: "image-builder",
    repo: "thingino-image-builder",
    files: [["thingino-theme.css", "web/vendor/thingino-theme.css"]],
  },
  {
    name: "verify",
    repo: "thingino-verify",
    files: [["thingino-theme.css", "web/vendor/thingino-theme.css"]],
  },
  {
    name: "webflash",
    repo: "thingino-dfu",
    files: [["thingino-theme.css", "web/src/thingino-theme.css"]],
  },
  {
    name: "buildscope",
    repo: "buildscope",
    files: [
      ["thingino-base.css", "viewer/src/thingino-base.css"],
      ["thingino-aliases.css", "viewer/src/thingino-aliases.css"],
    ],
  },
];

const write = process.argv.includes("--write");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

/* util.format has no width specifier, so column alignment is done here. */
const pad = (s) => String(s).padEnd(14);

/* The provenance stamp: full sha of the last commit touching the theme's
 * content, `+dirty` if src/ or dist/ has uncommitted edits (so a copy made
 * from a half-finished tree confesses to it). */
function themeStamp() {
  try {
    const git = (args) =>
      execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
    const sha = git(["log", "-1", "--format=%H", "--", "src", "dist"]);
    const dirty = git(["status", "--porcelain", "--", "src", "dist"]) !== "";
    if (dirty) console.warn("sync: src/ or dist/ has uncommitted changes, stamping +dirty\n");
    return "thingino/theme@" + sha + (dirty ? "+dirty" : "");
  } catch {
    return "thingino/theme@unknown";
  }
}

/* Appends the stamp to the banner build.mjs wrote. Refusing to sync an
 * unrecognised banner beats silently shipping an unstamped file. */
function stampBanner(content, stamp) {
  const re = /^(\/\*! thingino theme v[^\n]*)/;
  if (!re.test(content)) {
    console.error("sync: bundle banner not found; build.mjs changed shape?");
    process.exit(1);
  }
  return content.replace(re, "$1 · " + stamp);
}

const stamp = themeStamp();
let changed = 0;
let missing = 0;

for (const t of TARGETS) {
  if (only.length && !only.includes(t.name)) continue;
  const repo = join(SIBS, t.repo);
  if (!existsSync(repo)) {
    console.log("%s no checkout at %s, skipped", pad(t.name), relative(ROOT, repo));
    missing++;
    continue;
  }
  for (const [bundle, dest] of t.files) {
    const src = join(ROOT, "dist", bundle);
    const dst = join(repo, dest);
    if (!existsSync(src)) {
      console.error("%s missing dist/%s, run build.mjs first", pad(t.name), bundle);
      process.exit(1);
    }
    /* Compare stamped-vs-stamped, so "up to date" means bytes AND provenance
     * agree, and re-running sync at the same commit is a no-op. */
    const expected = stampBanner(readFileSync(src, "utf8"), stamp);
    const before = existsSync(dst) ? readFileSync(dst, "utf8") : null;
    if (before === expected) {
      console.log("%s %s up to date", pad(t.name), dest);
      continue;
    }
    changed++;
    const verb = before === null ? "NEW " : "DIFF";
    console.log("%s %s %s", pad(t.name), verb, dest);
    if (write) {
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, expected);
    }
  }
}

console.log("");
if (missing) console.log("%d target(s) had no sibling checkout.", missing);
if (!changed) {
  console.log("Nothing to do: every checkout already has this build.");
} else if (write) {
  console.log("Copied %d file(s). Review and commit in each app repo.", changed);
} else {
  console.log("%d file(s) would change. Re-run with --write to copy.", changed);
}
