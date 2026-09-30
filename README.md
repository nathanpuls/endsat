# ends.at

The Google Sheet controls the home page, project connections, order, names, and pages:
https://docs.google.com/spreadsheets/d/1YM3Kgc-uKrnZlvKFA9Ul-_d1NRk02FWfthSfsV0Mij8/edit

## Home

In **Settings**, choose **Project**, then **Page**. Any individual page in that connected project becomes `/`, rendering its HTML (including styles and scripts), Markdown, or redirect without an added frame. The built-in **Home** option preserves the existing custom Home tab.

**Settings** uses column A for a setting and B for its value:

| Setting | Default | Behavior |
| --- | --- | --- |
| home_mode | auto | auto uses the selected page when filled, otherwise lists projects; projects always lists projects; content always uses the selected page |
| Project | Home | Native dropdown of enabled connections, plus the existing Home tab |
| Page | ends.at · A2 | Native dropdown of nonempty pages in the selected project |
| site_title | ends.at | Title of the standard project index; custom HTML controls its own title |
| projects_tab | Projects (Connected Sheets) | Tab holding project connections |

Switch home_mode to projects without deleting the saved Home content. Switch back to auto or content to reconnect it. `/projects` always provides the standard index, and `/projects.json` provides the current public name/path/description list for custom home pages.

Page labels use the manual name in column B, HTML title, HTML/Markdown heading, redirect destination, then the cell reference (for example A7). Named options include their cell reference to distinguish duplicate titles. After changing Project, choose Page again. A stale option that is absent from the new project produces a selection error rather than silently showing another cell.

The hidden `_Homepage` tab contains native formulas for project and page choices. Settings rows 8–10 contain formulas resolving the selection to `home_tab`, `home_cell`, and `home_project_path`; leave these rows visible because Google excludes hidden rows from its visualization feed. The Worker uses the connection's source URL and resolved cell. Legacy manually configured home_tab/home_cell settings still work when no Project setting exists. For pages in another workbook, supply its explicit Tab name and authorize Google's IMPORTRANGE access when prompted. `homepage-sheet-config.json` records the formulas and validation ranges for maintenance or restoration.

## Projects (Connected Sheets)

Move whole rows to reorder projects on the site. No sorting or separate order numbers.

| Column | Behavior |
| --- | --- |
| URL | Google Sheet URL or ID; must be publicly readable |
| Name | Display name; also default route name |
| Tab | Optional explicit tab name. For this workbook, defaults to Name; for another workbook, uses its linked gid or first tab |
| Path | Optional stable route, such as current. Set it to keep a route when changing the display name |
| Enabled | Checked/TRUE connects; unchecked/FALSE disconnects both list and routes. Blank also connects |
| Description | Optional short detail on the standard index |

Blank URLs are ignored. Duplicate or reserved paths produce a clear error instead of silently routing to the wrong project. `/projects`, `/projects.json`, and `/sheet` are reserved. Static projects under public remain independent of connected-sheet projects.

## Page content

Each connected tab uses A for HTML, Markdown, or redirect content and B for an optional name. Rows appear in sheet order. A Content/Title header is skipped; otherwise A1 is included. Named page routes are lowercase, with spaces converted to hyphens. Unnamed redirects use the destination as the visible name and derive a route from it (go.com becomes go-com). Other unnamed pages use their HTML title or HTML/Markdown heading, falling back to A2 rather than Cell A2. Cell aliases such as a2 remain available; existing route generation is unchanged.

`/current/name` and `/old/name` are your current connections. `/sheet/name` remains an alias of the connected Current tab; disconnecting Current also disables this alias. `project.ends.at/path?query` redirects to `ends.at/project/path?query`.

Sheet content is loaded on navigation. Google may briefly cache sheet edits; refresh after editing. Content remains on the original publicly shared sheet. Custom HTML runs as authored.

## Deploy

`npm test` tests home modes, redirects, aliases, project order, disconnect/reconnect, custom content, and source routing. `npm run deploy` uses the existing Cloudflare Worker ends-at-text. Native Cloudflare Git builds deploy main automatically. Previous source remains in nathanpuls/ends-old-; existing older databases are retained.
