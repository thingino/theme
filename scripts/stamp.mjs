/* Stamps the built commit into the preview page.
 *
 * The theme documents the footer every thingino app carries as
 * `<repo-name> v<version>-<short sha>`, so the demo should follow its own
 * spec, and "which commit is this page actually showing" is the first thing
 * you want to know when checking whether a token change went out.
 *
 * The page ships with `data-sha="dev"`, which is the truthful answer for an
 * unstamped working copy; both the local server and the Pages build replace it
 * with the real short sha.
 */

import { execFileSync } from "node:child_process";

/* GITHUB_SHA on a runner, git otherwise, "dev" if neither (a tarball, say). */
export function buildSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "dev";
  }
}

export function stamp(html, sha = buildSha()) {
  return html.replace('data-sha="dev"', 'data-sha="' + sha + '"');
}
