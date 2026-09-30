# ends.at

A minimal home for independent projects and custom pages from the existing LINKSAW Google Sheet.

## Addresses

- `/`: project index, defined by `public/projects.json`.
- `/sheet`: automatic index of all nonempty cells in Sheet1 column A.
- `/sheet/<name>`: page name from column B (lowercase, spaces become hyphens).
- `/sheet/a17`: cell A17, useful for unnamed pages. Named routes take priority over cell aliases.
- `project.ends.at/path?query`: redirects to `ends.at/project/path?query`.

Column A accepts complete HTML including styles and scripts, Markdown, or a redirect URL. Column B is optional. Every nonempty row is included, including A1; there is no header row. Duplicate names receive a cell suffix. Sheet remains unchanged. Google may cache published values briefly; refresh after editing. Public sharing is required, as in the original Linksaw renderer.

Sheet: https://docs.google.com/spreadsheets/d/1YM3Kgc-uKrnZlvKFA9Ul-_d1NRk02FWfthSfsV0Mij8/edit
Original renderer: https://github.com/nathanpuls/linksaw-shortcuts/blob/main/index.html

## Adding a project

Put a project's files under `public/<project>/` with its own `index.html`, then add a name/path/description to `public/projects.json`. Projects requiring APIs can add their routes to `worker.js`. No sheet change is needed. Project assets should use relative URLs or their own path prefix.

## Deploy

Install dependencies, run `npm test`, then `npm run deploy`. Deployment reuses Cloudflare Worker `ends-at-text`. Root and wildcard routes both map to it. Existing databases and the older `ends-notes` Worker are retained for rollback. Only the `public` folder is exposed as assets.

The previous text-library source is preserved in private repository `nathanpuls/ends-old-`. Existing text-library data remains in its original Cloudflare D1 database; it is not listed in the new project hub.
