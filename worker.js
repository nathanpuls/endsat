import {escapeHtml, getRenderableHtml, getRedirectUrl} from './render.js';
import {dropApi} from './drop.js';
export {DropQueue} from './drop.js';

export const SHEET_ID = '1YM3Kgc-uKrnZlvKFA9Ul-_d1NRk02FWfthSfsV0Mij8';
const PROJECTS_TAB = 'Projects (Connected Sheets)';
const slugify = value => String(value).trim().replace(/^https?:\/\/[^/]+/i, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '').toLowerCase().replace(/[^a-z0-9/_-]+/g, '-').replace(/^-+|-+$/g, '');
const off = value => /^(false|no|off|0|disabled)$/i.test(String(value).trim());
const RESERVED_PATHS = new Set(['projects', 'projects.json', 'projects.csv', 'sheet', 'api']);

// The public HTML view exposes Google's visible tab catalog without an API key.
// Parse its string literals as data; never execute spreadsheet-supplied JavaScript.
export function sheetTabs(html) {
  const literal = '"(?:\\\\.|[^"\\\\])*"';
  const pattern = new RegExp('items\\.push\\(\\{name:\\s*(' + literal + '),\\s*pageUrl:\\s*' + literal + ',\\s*gid:\\s*"(\\d+)"', 'g');
  const tabs = [...html.matchAll(pattern)].map(match => ({
    name:JSON.parse(match[1].replace(/\\x([0-9a-f]{2})/gi, '\\u00$1')), gid:match[2]
  }));
  if (!tabs.length) throw new Error('Could not discover spreadsheet tabs. Check the main spreadsheet’s public sharing.');
  return tabs;
}

export async function readTabs(id, fetcher = fetch) {
  const response = await fetcher(`https://docs.google.com/spreadsheets/d/${id}/htmlview`, {signal:AbortSignal.timeout(12000), cache:'no-store'});
  if (!response.ok) throw new Error('Could not load the main spreadsheet’s tabs. Check its public sharing.');
  return sheetTabs(await response.text());
}

export function automaticProjects(tabs, masterId = SHEET_ID, connectedTab = PROJECTS_TAB) {
  const used = new Set();
  return tabs.flatMap(({name, gid}) => {
    if (name === 'Settings' || name === connectedTab || name.startsWith('_')) return [];
    const path = slugify(name.replace(/\//g, '-'));
    if (!path || RESERVED_PATHS.has(path) || used.has(path)) throw new Error(`Tab "${name}" needs a unique, non-reserved route name.`);
    used.add(path);
    return [{name, path:'/' + path, description:'', id:masterId, tab:name, gid}];
  });
}

function mergeProjects(local, external) {
  const used = new Set(local.map(project => project.path));
  for (const project of external) {
    if (used.has(project.path)) throw new Error(`Connected Sheet path "${project.path}" conflicts with a spreadsheet tab. Choose another Path.`);
    used.add(project.path);
  }
  return [...local, ...external];
}

export function projectChoicesCsv(projects, masterId = SHEET_ID) {
  return projects.map(project => [project.id === masterId && project.tab === 'Home' ? 'Home' : `${project.name} — ${project.path}`, `https://docs.google.com/spreadsheets/d/${project.id}/edit${project.gid ? '#gid=' + project.gid : ''}`, project.tab, project.path]
    .map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
}

export function subdomainRedirect(url) {
  const suffix = '.ends.at';
  if (!url.hostname.endsWith(suffix)) return '';
  const name = url.hostname.slice(0, -suffix.length);
  const path = name === 'www' ? '' : '/' + name.split('.').map(encodeURIComponent).join('/');
  return `https://ends.at${path}${url.pathname === '/' ? '' : url.pathname}${url.search}`;
}

export function parseSheetSource(value) {
  const text = String(value).trim();
  const id = text.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] || (/^[\w-]{20,}$/.test(text) ? text : '');
  if (!id) throw new Error('Use a Google Sheets URL in the project URL column.');
  const gid = text.match(/[?#&]gid=(\d+)/)?.[1];
  return {id, gid};
}

export async function readSheet(id, tab, range, fetcher = fetch, gid) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`);
  url.searchParams.set('tqx', 'out:json');
  url.searchParams.set('headers', '0');
  url.searchParams.set('range', range);
  if (tab) url.searchParams.set('sheet', tab);
  else if (gid) url.searchParams.set('gid', gid);
  const response = await fetcher(url.toString(), {signal:AbortSignal.timeout(12000), cache:'no-store'});
  if (!response.ok) throw new Error(`Could not load ${tab || 'the connected sheet'}. Check its public sharing.`);
  const text = await response.text();
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0) throw new Error(`Google did not return readable data for ${tab || 'the connected sheet'}.`);
  const data = JSON.parse(text.slice(start, end + 1));
  if (data.status === 'error' || !data.table) throw new Error(`Could not read ${tab || 'the connected sheet'}. Check the tab name and sharing.`);
  return (data.table.rows || []).map(row => (row.c || []).map(cell => cell?.v ?? ''));
}

export function projectEntries(rows, masterId = SHEET_ID) {
  const headers = (rows[0] || []).map(value => String(value).trim().toLowerCase());
  if (!headers.includes('url') || !headers.includes('name')) throw new Error('Projects tab is missing. Restore Projects (Connected Sheets) with URL and Name headers, or update projects_tab in Settings.');
  const column = (name, fallback) => headers.includes(name) ? headers.indexOf(name) : fallback;
  const used = new Set(RESERVED_PATHS);
  return rows.slice(1).flatMap(row => {
    const source = String(row[column('url', 0)] || '').trim();
    if (!source || off(row[column('enabled', 4)])) return [];
    const {id, gid} = parseSheetSource(source);
    if (id === masterId) return []; // Local tabs no longer require connection rows.
    const name = String(row[column('name', 1)] || '').trim();
    const tab = String(row[column('tab', 2)] || '').trim() || (id === masterId && !gid ? name : '');
    const path = slugify(row[column('path', 3)] || name || tab || 'project');
    if (!path || used.has(path)) throw new Error(`Project path "${path}" is duplicated or reserved. Set a unique Path in Projects.`);
    used.add(path);
    return [{name:name || tab || 'Project', path:'/' + path, description:String(row[column('description', 5)] || ''), id, tab, gid}];
  });
}

export function pageEntries(rows) {
  const used = new Set();
  return rows.flatMap((row, index) => {
    const value = String(row[0] ?? '');
    if (!value.trim() || (index === 0 && /^content(?:\s*\(|$)/i.test(value.trim()) && /^(title|name)$/i.test(String(row[1]).trim()))) return [];
    const cell = `a${index + 1}`;
    const provided = String(row[1] || '').trim();
    const redirect = getRedirectUrl(value);
    const linkName = redirect ? redirect.replace(/^https?:\/\//i, '').replace(/\/$/, '') : '';
    const textLabel = text => String(text || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const htmlTitle = textLabel(value.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const heading = textLabel(value.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || value.match(/^#{1,6}\s+(.+)$/m)?.[1]);
    const label = provided || htmlTitle || heading || linkName || cell.toUpperCase();
    const slug = slugify(provided || linkName) || cell;
    let unique = slug;
    if (used.has(unique)) unique = `${slug}-${cell}`;
    while (used.has(unique)) unique += '-';
    used.add(unique);
    return [{value, slug:unique, cell, label}];
  });
}

function htmlResponse(body, status = 200) {
  return new Response(body, {status, headers:{'content-type':'text/html; charset=utf-8', 'cache-control':'no-store'}});
}

function indexHtml(title, entries, back = true) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#fff;color:#171717;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:680px;margin:12vh auto;padding:0 24px}h1{font-size:32px;font-weight:650;letter-spacing:-1px;margin:36px 0 40px}nav a{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px 0;border-bottom:1px solid #eee;color:inherit;text-decoration:none}a:hover{color:#666}small{display:block;color:#888;font-size:14px;margin-top:6px}.back{color:#777;text-decoration:none}.arrow{color:#999}</style></head><body><main>${back ? '<a class="back" href="/">← Home</a>' : ''}<h1>${escapeHtml(title)}</h1><nav aria-label="${escapeHtml(title)}">${entries.map(entry => `<a href="${escapeHtml(entry.path)}"><span>${escapeHtml(entry.name)}${entry.description ? `<small>${escapeHtml(entry.description)}</small>` : ''}</span><span class="arrow" aria-hidden="true">↗</span></a>`).join('') || '<p>No pages yet.</p>'}</nav></main></body></html>`;
}

function renderContent(value, request, backPath = '/projects') {
  const destination = getRedirectUrl(value);
  if (!destination) return htmlResponse(getRenderableHtml(value, {backPath}));
  // Web redirects are handled before HTML loads. Other supported protocols use the browser.
  if (/^https?:/i.test(destination)) return new Response(null, {status:302, headers:{location:destination, 'cache-control':'no-store'}});
  return htmlResponse(`<!doctype html><meta charset="utf-8"><a href="${escapeHtml(destination)}">Open ${escapeHtml(destination)}</a><script>location.replace(${JSON.stringify(destination).replace(/</g,'\\u003c')})</script>`);
}

export function createWorker(fetcher = fetch) {
  return {
    async fetch(request, env = {}) {
      const url = new URL(request.url);
      const redirect = subdomainRedirect(url);
      if (redirect) return new Response(null, {status:302, headers:{location:redirect,'cache-control':'no-store'}});
      if (url.pathname === '/api/drop' || url.pathname.startsWith('/api/drop/')) return dropApi(request, env);
      if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
      let response;
      try {
        response = await route(request, env, fetcher);
      } catch (error) {
        response = htmlResponse(indexHtml('Could not load this page', [{name:error.message, path:'/'}]), 503);
      }
      return request.method === 'HEAD' ? new Response(null, response) : response;
    }
  };
}

async function route(request, env, fetcher) {
  const url = new URL(request.url);
  const masterId = env.GOOGLE_SHEET_ID || SHEET_ID;
  const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
  // Static files stay independent of sheet availability.
  if (/\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|map|webmanifest)$/i.test(path)) return env.ASSETS.fetch(request);
  // This native dropdown feed must not read the Settings formulas that import it.
  if (path === '/projects.csv') {
    const rows = await readSheet(masterId, 'Settings', 'A6:B6', fetcher);
    const connectedTab = rows[0]?.[0] === 'projects_tab' ? String(rows[0][1] || PROJECTS_TAB) : PROJECTS_TAB;
    const [tabs, connections] = await Promise.all([readTabs(masterId, fetcher), readSheet(masterId, connectedTab, 'A1:F1000', fetcher)]);
    const projects = mergeProjects(automaticProjects(tabs, masterId, connectedTab), projectEntries(connections, masterId));
    return new Response(projectChoicesCsv(projects, masterId), {headers:{'content-type':'text/csv; charset=utf-8', 'cache-control':'no-store'}});
  }
  const settingsRows = await readSheet(masterId, 'Settings', 'A1:B100', fetcher);
  if (String(settingsRows[0]?.[0] || '').trim().toLowerCase() !== 'setting') throw new Error('Settings tab is missing. Restore Settings with Setting and Value headers to reconnect the website.');
  const settings = Object.fromEntries(settingsRows.filter(row => row[0]).map(row => [String(row[0]).trim().toLowerCase(), String(row[1] ?? '').trim()]));
  const title = settings.site_title || 'ends.at';
  let projectsPromise;
  const getProjects = () => projectsPromise ||= (async () => {
    const connectedTab = settings.projects_tab || PROJECTS_TAB;
    const [tabs, rows] = await Promise.all([readTabs(masterId, fetcher), readSheet(masterId, connectedTab, 'A1:F1000', fetcher)]);
    return mergeProjects(automaticProjects(tabs, masterId, connectedTab), projectEntries(rows, masterId));
  })();
  if (path === '/') {
    const mode = (settings.home_mode || 'auto').toLowerCase();
    if (!['auto', 'content', 'projects'].includes(mode)) throw new Error('home_mode must be auto, content, or projects.');
    if (mode !== 'projects') {
      const selected = Object.hasOwn(settings, 'project');
      const cell = selected ? settings.home_cell : settings.home_cell || 'A2';
      if (selected && !cell) throw new Error('Choose a Page from the selected Project in Settings.');
      if (!/^[A-Z]{1,2}[1-9]\d{0,3}$/i.test(cell)) throw new Error('home_cell must be a single cell, such as A2.');
      let source = {id:masterId, tab:settings.home_tab || 'Home'};
      if (selected && settings.project !== 'Home') {
        source = (await getProjects()).find(project => project.path === settings.home_project_path);
        if (!source) throw new Error('Choose an enabled Project in Settings.');
      }
      const home = await readSheet(source.id, source.tab, cell, fetcher, source.gid);
      const value = String(home[0]?.[0] ?? '');
      if (value.trim()) return renderContent(value, request, source.path || '/projects');
      if (mode === 'content') throw new Error(`The home page cell ${cell} is empty.`);
    }
    return htmlResponse(indexHtml(title, await getProjects(), false));
  }
  const projects = await getProjects();
  if (path === '/projects.json') return new Response(JSON.stringify(projects.map(({name,path,description}) => ({name,path,description}))), {headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  if (path === '/projects') return htmlResponse(indexHtml(title, projects, false));
  // Keep the original /sheet addresses as aliases for Current.
  const project = path === '/sheet' || path.startsWith('/sheet/')
    ? projects.find(project => project.tab === 'Current' && project.id === masterId)
    : [...projects].sort((a,b) => b.path.length-a.path.length).find(project => path === project.path || path.startsWith(project.path + '/'));
  if (!project) {
    if (path === '/sheet' || path.startsWith('/sheet/')) return htmlResponse(indexHtml('Project disconnected', []), 404);
    return env.ASSETS.fetch(request);
  }
  const prefix = path === '/sheet' || path.startsWith('/sheet/') ? '/sheet' : project.path;
  const requested = path.slice(prefix.length).replace(/^\//, '').toLowerCase();
  const entries = pageEntries(await readSheet(project.id, project.tab, 'A1:B10000', fetcher, project.gid));
  if (!requested && project.path === '/drop' && project.tab === 'Drop' && entries.length) return renderContent(entries[0].value, request);
  if (!requested) return htmlResponse(indexHtml(project.name, entries.map(entry => ({name:entry.label, path:prefix + '/' + entry.slug.split('/').map(encodeURIComponent).join('/')}))));
  const entry = entries.find(entry => entry.slug === requested) || entries.find(entry => entry.cell === requested);
  if (!entry) return htmlResponse(indexHtml('Page not found', [{name:'Back to ' + project.name, path:prefix}]),404);
  return renderContent(entry.value, request, prefix);
}

export default createWorker();
