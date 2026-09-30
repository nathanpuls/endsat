# ends.at

The Google Sheet controls the home page, project connections, order, names, and pages:
https://docs.google.com/spreadsheets/d/1YM3Kgc-uKrnZlvKFA9Ul-_d1NRk02FWfthSfsV0Mij8/edit

## Home

Put any HTML (including styles and scripts), Markdown, or redirect URL in **Home!A2**. Its content becomes the root home page without an added frame. The other cells in Home are left alone. Settings can point to another tab or cell.

**Settings** uses column A for a setting and B for its value:

| Setting | Default | Behavior |
| --- | --- | --- |
| home_mode | auto | auto uses the Home cell when filled, otherwise lists projects; projects always lists projects; content always uses Home |
| home_tab | Home | Tab holding the home content |
| home_cell | A2 | One cell holding home HTML, Markdown, or redirect |
| site_title | ends.at | Title of the standard project index; custom HTML controls its own title |
| projects_tab | Projects (Connected Sheets) | Tab holding project connections |

Switch home_mode to projects without deleting the saved Home content. Switch back to auto or content to reconnect it. `/projects` always provides the standard index, and `/projects.json` provides the current public name/path/description list for custom home pages.

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

Each connected tab uses A for HTML, Markdown, or redirect content and B for an optional name. Rows appear in sheet order. A Content/Title header is skipped; otherwise A1 is included. Named page routes are lowercase, with spaces converted to hyphens. Unnamed redirects use the destination as the visible name and derive a route from it (go.com becomes go-com). Other unnamed pages use their HTML title, Markdown heading, or first text line. Cell aliases such as a2 remain available but aren't shown as labels.

`/current/name` and `/old/name` are your current connections. `/sheet/name` remains an alias of the connected Current tab; disconnecting Current also disables this alias. `project.ends.at/path?query` redirects to `ends.at/project/path?query`.

Sheet content is loaded on navigation. Google may briefly cache sheet edits; refresh after editing. Content remains on the original publicly shared sheet. Custom HTML runs as authored.

## Deploy

`npm test` tests home modes, redirects, aliases, project order, disconnect/reconnect, custom content, and source routing. `npm run deploy` uses the existing Cloudflare Worker ends-at-text. Native Cloudflare Git builds deploy main automatically. Previous source remains in nathanpuls/ends-old-; existing older databases are retained.
