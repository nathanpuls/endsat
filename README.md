# ends.at

This spreadsheet’s tabs become routes automatically. Projects (Connected Sheets) connects other spreadsheets. The Google Sheet controls the home page, names, and pages:
https://docs.google.com/spreadsheets/d/1YM3Kgc-uKrnZlvKFA9Ul-_d1NRk02FWfthSfsV0Mij8/edit

## Home

In **Settings**, choose **Project**, then **Page**. Any individual page in a local tab or connected external project becomes `/`, rendering its HTML (including styles and scripts), Markdown, or redirect without an added frame. The built-in **Home** option preserves the existing custom Home tab.

**Settings** uses column A for a setting and B for its value:

| Setting | Default | Behavior |
| --- | --- | --- |
| home_mode | auto | auto uses the selected page when filled, otherwise lists projects; projects always lists projects; content always uses the selected page |
| Project | Home | Native dropdown of automatic local tabs and enabled external connections |
| Page | ends.at · A2 | Native dropdown of nonempty pages in the selected project |
| site_title | ends.at | Title of the standard project index; custom HTML controls its own title |
| projects_tab | Projects (Connected Sheets) | Tab holding project connections |

Switch home_mode to projects without deleting the saved Home content. Switch back to auto or content to reconnect it. `/projects` always provides the standard index, and `/projects.json` provides the current public name/path/description list for custom home pages.

Page labels use the manual name in column B, HTML title, HTML/Markdown heading, redirect destination, then the cell reference (for example A7). Named options include their cell reference to distinguish duplicate titles. After changing Project, choose Page again. A stale option that is absent from the new project produces a selection error rather than silently showing another cell.

The hidden `_Homepage` tab uses `IMPORTDATA("https://ends.at/projects.csv")` for project choices and native formulas for page choices. The CSV has selection label, source URL, tab, and path; Google may cache the import, so new dropdown choices may lag behind live website routes. Allow the data import when Google prompts. The feed reads only Settings A6:B6 for projects_tab, avoiding a circular dependency on the dropdown formulas. Settings rows 8–10 contain formulas resolving the selection to `home_tab`, `home_cell`, and `home_project_path`; leave these rows visible because Google excludes hidden rows from its visualization feed. The Worker uses the local tab or external connection’s source URL and resolved cell. Legacy manually configured home_tab/home_cell settings still work when no Project setting exists. For pages in another workbook, supply its explicit Tab name and authorize Google's IMPORTRANGE access when prompted. `homepage-sheet-config.json` records the formulas and validation ranges for maintenance or restoration.

## Automatic tabs

Visible content tabs in the main spreadsheet become routes by name: Ideas → /ideas, Recipes → /recipes, New Ideas → /new-ideas. No connection row is needed. The index follows spreadsheet tab order. Adding, renaming, rearranging, or removing a tab updates the routes and list on the next navigation (subject to Google’s brief feed caching). Renaming changes its URL.

Settings, the configured connection tab, hidden tabs, and tabs starting with `_` are excluded. Home remains available for homepage selection and at /home. The Worker discovers visible tabs through Google’s public HTML view, using the spreadsheet’s existing public sharing; no Google API key or new service is needed. If Google changes that catalog format, discovery fails clearly rather than selecting an unrelated tab.

## Projects (Connected Sheets)

Use this tab only for **other** Google spreadsheets, including those owned or shared by someone else. They must be publicly readable by the existing website. A private sharing invitation alone does not give the public Worker access. Set URL, Name, optional Tab, and the ends.at Path you want.

External connections appear after the local tabs, in row order. Move whole external rows to reorder them. No sorting or separate order numbers.

| Column | Behavior |
| --- | --- |
| URL | Google Sheet URL or ID; must be publicly readable |
| Name | Display name; also default route name |
| Tab | Optional explicit tab name; otherwise uses its linked gid or first tab. For homepage Page choices, provide an explicit Tab |
| Path | Optional stable route, such as current. Set it to keep a route when changing the display name |
| Enabled | Checked/TRUE connects; unchecked/FALSE disconnects both list and routes. Blank also connects |
| Description | Optional short detail on the standard index |

Blank URLs and legacy connection rows pointing to the main spreadsheet are ignored. They cannot disable or override an automatic local tab. Duplicate paths, paths conflicting with local tabs, and reserved paths produce a clear error instead of silently routing to the wrong project. `/projects`, `/projects.json`, `/projects.csv`, `/sheet`, and `/api` are reserved. Static projects under public remain independent of connected-sheet projects.

## Page content

Each connected tab uses A for HTML, Markdown, or redirect content and B for an optional name. Rows appear in sheet order. A Content/Title header is skipped; otherwise A1 is included. Named page routes are lowercase, with spaces converted to hyphens. Unnamed redirects use the destination as the visible name and derive a route from it (go.com becomes go-com). Other unnamed pages use their HTML title or HTML/Markdown heading, falling back to A2 rather than Cell A2. Cell aliases such as a2 remain available; existing route generation is unchanged.

`/current/name` and `/old/name` are automatic local routes. `/sheet/name` remains an alias of the local Current tab; removing or hiding Current disables this alias. `project.ends.at/path?query` redirects to `ends.at/project/path?query`.

Sheet content is loaded on navigation. Google may briefly cache sheet edits; refresh after editing. Content remains on the original publicly shared sheet. Custom HTML runs as authored.

## Deploy

`npm test` tests home modes, redirects, aliases, tab discovery/order/renaming, external disconnect/reconnect and collisions, custom content, and source routing. `npm run deploy` uses the existing Cloudflare Worker ends-at-text. Native Cloudflare Git builds deploy main automatically. Previous source remains in nathanpuls/ends-old-; existing older databases are retained.
