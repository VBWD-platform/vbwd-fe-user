# vbwd-fe-user-plugin-cms-youtube

The worked extension example for **S47.3** — proves the cms content-type
renderer registry is **media-extensible with zero cms change** (master D10).

On `install()` it registers a `youtube` content-type renderer at placement
`top`, so any post whose `content_json.blocks` includes a
`{ type: "youtube", data: { video_id | url, title? } }` block shows a
privacy-friendly (`youtube-nocookie.com`), lazy-loaded, 16:9-responsive embed
as the **topmost** element. `deactivate()` unregisters only the `youtube`
type — cms's built-in `richtext` (and any other plugin's registration) is
untouched.

This is the template for future media kinds (`gallery`, `video`, `audio`, …):
each ships as its own plugin registering through the same registry.

## Engineering requirements (BINDING)

TDD-first · SOLID · DI · DRY · Liskov (unknown block → safe fallback in cms,
never a crash) · clean code · **core agnostic** (no cms edit to add a media
kind) · **NO OVERENGINEERING** (one renderer, no new table) · **plugin baseline
config files** (`config.json` + `admin-config.json` with `debug_mode`).
Gate: fe-user `npm run lint && npm run test` GREEN.
