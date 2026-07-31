/* Borrows Bootstrap, Bootstrap Icons and Montserrat from a sibling app checkout.
 *
 * These are NOT committed here. The apps own the Bootstrap version pin, and a
 * second copy in the theme repo would be free to drift from it without anything
 * noticing. So the preview borrows whatever the apps are actually shipping,
 * which is also the honest thing to preview against.
 *
 * CI does the same: it checks thingino-verify out as a sibling (it is public,
 * so no token) and calls this. Local and published previews therefore render
 * against the identical assets.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* In order of preference. Each app ships the same vendored trio. */
const DONORS = [
  join(ROOT, "..", "thingino-verify", "web", "vendor"),
  join(ROOT, "..", "thingino-image-builder", "web", "vendor"),
];
const WANT = ["bootstrap.min.css", "bootstrap-icons.min.css", "montserrat.css"];

/* Copies into `dest`, defaulting to preview/vendor. Returns the donor path
 * used, or null if no sibling checkout was found. */
export function vendor(dest = join(ROOT, "preview", "vendor")) {
  const donor = DONORS.find((d) => existsSync(join(d, "bootstrap.min.css")));
  if (!donor) {
    console.warn("vendor: no sibling app checkout with vendor/ found, looked in:");
    for (const d of DONORS) console.warn("  " + d);
    return null;
  }
  mkdirSync(dest, { recursive: true });
  for (const f of WANT) {
    if (existsSync(join(donor, f))) copyFileSync(join(donor, f), join(dest, f));
  }
  /* Font files and icon glyphs live in subdirectories next to the CSS; copy
   * whatever is there so the @font-face src urls resolve. */
  for (const entry of readdirSync(donor)) {
    const p = join(donor, entry);
    if (!statSync(p).isDirectory()) continue;
    mkdirSync(join(dest, entry), { recursive: true });
    for (const f of readdirSync(p)) {
      const fp = join(p, f);
      if (statSync(fp).isFile()) copyFileSync(fp, join(dest, entry, f));
    }
  }
  console.log("vendor: copied from %s", donor);
  return donor;
}
