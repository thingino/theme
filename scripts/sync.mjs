#!/usr/bin/env node
/* Copies the built theme into sibling app checkouts.
 *
 * Dry by default: it prints what would change and touches nothing. Pass
 * --write to actually copy. It never runs git, so a theme change arrives in
 * each app as a plain working-tree diff for you to read and commit there.
 *
 *   node scripts/sync.mjs                    # what would change, everywhere
 *   node scripts/sync.mjs --write            # copy it in
 *   node scripts/sync.mjs --write verify     # just one target
 */

import { readFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { createHash } from "node:crypto";

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

const sha = (p) =>
  existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : null;

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
    const before = sha(dst);
    const after = sha(src);
    if (before === after) {
      console.log("%s %s up to date", pad(t.name), dest);
      continue;
    }
    changed++;
    const verb = before === null ? "NEW " : "DIFF";
    console.log("%s %s %s", pad(t.name), verb, dest);
    if (write) {
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
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
