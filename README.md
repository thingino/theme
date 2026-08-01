# thingino theme

One palette, one set of shared widgets, for every thingino web app.

**Live demo: https://thingino.github.io/theme/** — every token and every
component on one page, rebuilt and redeployed on each push.

The apps grew up separately and each ended up carrying its own inline copy of
the same CSS. The help-balloon block in the image builder and in verify was
byte-identical; webflash's copy differed only in whitespace; the same twelve
hex values were retyped in four places. This repo is where those live now.

Change a color here, rebuild, and the apps pick it up on their next sync.

## Layout

| File | What it is | Depends on |
|---|---|---|
| `src/tokens.css` | Every color, face and radius, as `--th-*` custom properties. Declares only, selects nothing. | nothing |
| `src/components.css` | Shared widgets: log console, drop zone, file info, footer, help balloons. | tokens |
| `src/bootstrap.css` | Skins a stock Bootstrap 5.3 dark build into the thingino look. | tokens, Bootstrap |
| `src/aliases.css` | Opt-in bare-name aliases (`--bg` to `--th-bg`) for buildscope. | tokens |

`node scripts/build.mjs` concatenates those into `dist/`:

| Bundle | Contents | For |
|---|---|---|
| `thingino-theme.css` | tokens + components + bootstrap | the image builder, verify, webflash |
| `thingino-base.css` | tokens + components | apps with no framework |
| `thingino-tokens.css` | tokens | palette only |
| `thingino-aliases.css` | aliases | buildscope, on top of the above |
| `tokens.json` | the same values for JS | charts, React, anything computing a color |

`dist/` is committed so an app can vendor a single file without needing node.
CI runs `--check` and fails if `dist/` is out of step with `src/`.

## Using it

Load it **after** Bootstrap, last of your stylesheets:

```html
<link href="vendor/bootstrap.min.css" rel="stylesheet">
<link href="vendor/bootstrap-icons.min.css" rel="stylesheet">
<link href="vendor/montserrat.css" rel="stylesheet">
<link href="vendor/thingino-theme.css" rel="stylesheet">
```

Under a bundler, after the Bootstrap import:

```js
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './vendor/thingino-theme.css'
```

Reading tokens from JS:

```js
import { tokens } from '@thingino/theme/tokens.json'
ctx.fillStyle = tokens['--th-accent']
```

The theme does **not** bundle Montserrat. Each app ships its own subsets, via
`@fontsource` or a vendored `montserrat.css`, so it downloads only the scripts
it renders. The theme just names the face.

### Selector policy

Components are written with the `.th-*` name first and the class or id the
existing apps already carry grouped alongside it:

```css
.th-console,
#log { ... }
```

That is deliberate: it makes adoption a single `<link>` with no markup churn.
As an app's markup moves to the `.th-*` name, its legacy selector comes out of
the group here.

### Two rules that will bite

**Never set `--bs-body-bg`.** The apps override the *page* background only,
which leaves cards, modals and dropdowns on Bootstrap's own `#212529` grey.
Retinting `--bs-body-bg` flattens every card into the page, in all three
Bootstrap apps at once, and looks like a bug in each of them separately.

**Load order matters, except where it can't.** The two rules that must survive
being loaded *before* Bootstrap (some builds inline page CSS ahead of the
bundle) are written as `html:root` and `html body`, which outrank Bootstrap's
`:root` and `body` whichever way round they land. Everything else assumes the
theme comes last.

## Changing something

```sh
$EDITOR src/tokens.css
node scripts/build.mjs
node scripts/preview.mjs        # http://localhost:8080/
```

`preview/index.html` draws every token and every component on one page, with
the swatches generated from the built `tokens.json`, so it cannot drift from
what the apps actually get. It borrows Bootstrap and Montserrat from a sibling
app checkout rather than committing its own copy: the apps own that version
pin, and a second copy here would be free to drift from it unnoticed.

That same page is what gets published. `scripts/site.mjs` assembles `_site/`
(the page at the root, `dist/` and `vendor/` beside it) and the `pages`
workflow deploys it on every push that touches `src/`, `preview/`, `scripts/`
or `dist/`. The local server maps requests onto the identical layout, so one
set of relative paths works in both places and the published copy cannot break
in a way the local one hides:

```sh
node scripts/site.mjs           # build _site/ exactly as CI will
```

CI clones `thingino-verify` alongside to borrow the same vendored assets, so
the deployed demo renders against the Bootstrap an app is really shipping.

Then push the result out to the apps:

```sh
node scripts/sync.mjs           # dry run: what would change, in which checkout
node scripts/sync.mjs --write   # copy it in; review and commit in each repo
```

`sync.mjs` only copies files. It never commits and never pushes, so a theme
change lands in each app as a reviewable diff on your own schedule. If that
ever gets tedious, the natural upgrade is a workflow here that opens the four
PRs itself.

## Consumers

| Repo | Bundle | Notes |
|---|---|---|
| [thingino-image-builder](https://github.com/thingino/thingino-image-builder) | `thingino-theme.css` | `rtl.css` must stay the last stylesheet: it mirrors the notice sweep |
| [thingino-verify](https://github.com/thingino/thingino-verify) | `thingino-theme.css` | |
| [thingino-dfu](https://github.com/wltechblog/thingino-dfu) (webflash) | `thingino-theme.css` | can drop its `html:root` / `html body` specificity hacks once the theme loads after Bootstrap |
| [buildscope](https://github.com/thingino/buildscope) | `thingino-base.css` + `thingino-aliases.css` | aliases let its ~1400 existing lines keep reading `var(--bg)` unchanged |

Both apps enforce `default-src 'self'` in a CSP `<meta>`, and the image builder
serves offline through a service worker. That is why the theme is vendored into
each app rather than served from one origin: a shared stylesheet loaded
cross-origin would be blocked outright, and would put a network dependency in
front of a firmware verifier.

## License

MIT.
