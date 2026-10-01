import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker, subdomainRedirect, pageEntries, projectEntries, sheetTabs, automaticProjects, SHEET_ID} from '../worker.js';
import {getRenderableHtml, getRedirectUrl} from '../render.js';

const master = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const external = 'https://docs.google.com/spreadsheets/d/1234567890123456789012345/edit#gid=42';
function fixture(settings = [], projects = [['URL','Name','Tab','Path','Enabled','Description'],[master,'Current'],[master,'Old']], home = '<button>My home</button>', tabs = ['Current','Old','Home','Settings','Projects (Connected Sheets)']) {
 const calls=[];
 const fetcher=async input => {
  const url=new URL(input);calls.push(url);
  if(url.pathname.endsWith('/htmlview')) return new Response(tabs.map((name,index)=>`items.push({name: ${JSON.stringify(name)}, pageUrl: "https://docs.google.com/test?gid=${index}", gid: "${index}"});`).join(''));
  const tab=url.searchParams.get('sheet');
  let rows=tab==='Settings'?[['Setting','Value'],...settings]:tab==='Projects (Connected Sheets)'?projects:tab==='Home'?[[home]]:tab==='Current'?[[],['go.com'],['# Named page','Hello'],['<button>Custom</button>','custom']]:[['# Old page','old']];
  if(tab==='Settings' && url.searchParams.get('range')==='A6:B6') rows=[['projects_tab','Projects (Connected Sheets)']];
  const singleCell=url.searchParams.get('range').match(/^A(\d+)$/);
  if(singleCell && tab==='Current') rows=[[rows[Number(singleCell[1])-1]?.[0] || '']];
  return new Response(`google.visualization.Query.setResponse(${JSON.stringify({status:'ok',table:{rows:rows.map(row=>({c:row.map(v=>({v}))}))}})});`);
 };
 const worker=createWorker(fetcher);
 const request=async (path,method='GET')=>worker.fetch(new Request('https://ends.at'+path,{method}),{ASSETS:{fetch:async()=>new Response('asset',{status:404})}});
 return {request,calls};
}
test('wildcard redirects preserve project, path and query',()=>{
 assert.equal(subdomainRedirect(new URL('https://current.ends.at/demo?x=1')),'https://ends.at/current/demo?x=1');
 assert.equal(subdomainRedirect(new URL('https://www.ends.at/a')),'https://ends.at/a');
 assert.equal(subdomainRedirect(new URL('https://ends.at/')),'');
});
test('local tabs are automatic in tab order; external rows disconnect and reconnect',async()=>{
 const rows=[['URL','Name','Tab','Path','Enabled'],[master,'Current','','',false],[external,'Shared','My Tab','shared',false],[external,'Other','My Tab','other',true]];
 const f=fixture([],rows);
 assert.deepEqual((await (await f.request('/projects.json')).json()).map(p=>p.name),['Current','Old','Home','Other']);
 assert.equal((await f.request('/shared')).status,404);
 assert.equal((await f.request('/sheet/a2')).headers.get('location'),'https://go.com');
 rows[2][4]=true;
 assert.deepEqual((await (await f.request('/projects.json')).json()).map(p=>p.name),['Current','Old','Home','Shared','Other']);
 assert.equal((await f.request('/shared')).status,200);
});
test('custom home HTML, Markdown and redirects are rendered',async()=>{
 assert.equal(await (await fixture().request('/')).text(),'<button>My home</button>');
 assert.match(await (await fixture([],undefined,'# Welcome').request('/')).text(),/<h1>Welcome<\/h1>/);
 assert.equal((await fixture([],undefined,'example.com').request('/')).headers.get('location'),'https://example.com');
});
test('projects mode overrides saved Home; auto falls back when empty',async()=>{
 const f=fixture([['home_mode','projects'],['site_title','My projects']]);
 const html=await (await f.request('/')).text();
 assert.match(html,/<h1>My projects<\/h1>/);assert.ok(html.indexOf('Current')<html.indexOf('Old'));
 assert.ok(!f.calls.some(url=>url.searchParams.get('sheet')==='Home'));
 assert.match(await (await fixture([],undefined,'').request('/')).text(),/Current/);
 assert.equal((await fixture([['home_mode','content']],undefined,'').request('/')).status,503);
});
test('home cell and tab are configurable',async()=>{
 const f=fixture([['home_tab','Other'],['home_cell','B7']]);await f.request('/');
 assert.ok(f.calls.some(url=>url.searchParams.get('sheet')==='Other' && url.searchParams.get('range')==='B7'));
});
test('unnamed redirects show destination, skip header, keep named and cell aliases',async()=>{
 const entries=pageEntries([['Content (HTML / Markdown / Redirect)','Title'],['go.com'],['# Another','Test Page'],['# Third','Test Page']]);
 assert.equal(entries[0].label,'go.com');assert.equal(entries[0].slug,'go-com');assert.equal(entries[2].slug,'test-page-a4');
 const f=fixture();const html=await (await f.request('/current')).text();
 assert.match(html,/>go.com</);assert.doesNotMatch(html,/Cell A2/);
 for(const path of ['/current/go-com','/current/a2','/sheet/a2']) assert.equal((await f.request(path)).headers.get('location'),'https://go.com');
 assert.equal(await (await f.request('/current/custom')).text(),'<button>Custom</button>');
 assert.equal((await f.request('/current/missing')).status,404);
});
test('external connections honor gid and explicit tab and stable path',()=>{
 const external='https://docs.google.com/spreadsheets/d/1234567890123456789012345/edit#gid=42';
 assert.deepEqual(projectEntries([['URL','Name','Tab','Path'],[external,'Display','My Tab','stable']])[0],{name:'Display',path:'/stable',description:'',id:'1234567890123456789012345',tab:'My Tab',gid:'42'});
 assert.throws(()=>projectEntries([['URL','Name'],[external,'Same'],[external,'Same']]),/duplicated/);
});
test('HTML and redirect behavior, HEAD and method handling',async()=>{
 assert.equal(getRenderableHtml('<button>Hello</button>'),'<button>Hello</button>');
 assert.equal(getRedirectUrl('javascript:alert(1)'),'');
 assert.equal(await (await fixture().request('/current','HEAD')).text(),'');
 assert.equal((await fixture().request('/','POST')).status,405);
});
test('missing tabs cannot silently use the first workbook tab',async()=>{
 const worker=createWorker(async()=>new Response('callback({"table":{"rows":[{"c":[{"v":"# Some page"}]}]}})'));
 const res=await worker.fetch(new Request('https://ends.at/'));
 assert.equal(res.status,503);assert.match(await res.text(),/Settings tab is missing/);
 assert.throws(()=>projectEntries([['# Wrong tab']]),/Projects tab is missing/);
});
test('friendly labels follow name, title, heading, redirect, then uppercase cell',()=>{
 const rows=[['<title>Title</title><h1>Heading</h1>','Manual'],['<title>   </title><h1><span>Useful</span> heading</h1>'],['<div>Some unnamed text</div>'],['https://example.com/'],['plain text'],['# Markdown heading']];
 assert.deepEqual(pageEntries(rows).map(p=>p.label),['Manual','Useful heading','A3','example.com','A5','Markdown heading']);
 assert.equal(pageEntries([['<title>Document title</title><h1>Heading</h1>']])[0].label,'Document title');
});
test('Project and resolved Page render one cell as the root homepage',async()=>{
 const f=fixture([['Project','Current — /current'],['Page','Custom · A4'],['home_tab','Current'],['home_cell','A4'],['home_project_path','/current']]);
 assert.equal(await (await f.request('/')).text(),'<button>Custom</button>');
 assert.ok(f.calls.some(url=>url.searchParams.get('sheet')==='Current' && url.searchParams.get('range')==='A4'));
});
test('invalid page/project selections fail clearly; projects mode bypasses selection',async()=>{
 const base=[['Project','Current — /current'],['home_project_path','/current'],['home_cell','']];
 assert.equal((await fixture(base).request('/')).status,503);
 assert.equal((await fixture([...base,['home_mode','projects']]).request('/')).status,200);
 assert.equal((await fixture([['Project','Missing'],['home_project_path','/missing'],['home_cell','A4']]).request('/')).status,503);
});

test('new tabs, renames and tab reordering take effect without connection rows',async()=>{
 const tabs=['Ideas','Recipes','Settings','Projects (Connected Sheets)','_Homepage'];
 const f=fixture([], [['URL','Name']], undefined, tabs);
 assert.deepEqual((await (await f.request('/projects.json')).json()).map(p=>p.path),['/ideas','/recipes']);
 assert.equal((await f.request('/ideas/a1')).status,200);
 tabs.splice(0,2,'Recipes','New Ideas','Travel');
 assert.deepEqual((await (await f.request('/projects.json')).json()).map(p=>p.path),['/recipes','/new-ideas','/travel']);
 assert.equal((await f.request('/ideas')).status,404);
 assert.equal((await f.request('/new-ideas/a1')).status,200);
 assert.equal((await f.request('/settings')).status,404);
});

test('tab discovery decodes Google string escapes without evaluating code',()=>{
 const html=String.raw`items.push({name: "Mom\x27s \x26 \"Ideas\"", pageUrl: "https:\/\/docs.google.com\/test?headers\x3dtrue", gid: "7"});`;
 assert.deepEqual(sheetTabs(html),[{name:'Mom\'s & "Ideas"',gid:'7'}]);
 assert.throws(()=>sheetTabs('<h1>Sign in</h1>'),/Could not discover/);
 assert.throws(()=>automaticProjects([{name:'Ideas',gid:'1'},{name:'IDEAS',gid:'2'}]),/unique/);
 assert.throws(()=>automaticProjects([{name:'api',gid:'1'}]),/reserved/);
});

test('external paths cannot shadow automatic tabs; homepage choices include both sources',async()=>{
 assert.equal((await fixture([], [['URL','Name','Tab','Path'],[external,'Shared','Tab','current']]).request('/projects')).status,503);
 const f=fixture([], [['URL','Name','Tab','Path'],[external,'Shared, notes','Tab','shared']]);
 const csv=await (await f.request('/projects.csv')).text();
 assert.match(csv,/"Current — \/current"/);assert.match(csv,/"Home",/);assert.match(csv,/"Shared, notes — \/shared"/);
 assert.ok(f.calls.some(url=>url.searchParams.get('sheet')==='Settings' && url.searchParams.get('range')==='A6:B6'));
 assert.ok(!f.calls.some(url=>url.searchParams.get('range')==='A1:B100'));
 const home=fixture([['Project','Ideas — /ideas'],['home_cell','A1'],['home_project_path','/ideas']], [['URL','Name']], undefined, ['Ideas']);
 assert.match(await (await home.request('/')).text(),/<h1>Old page<\/h1>/);
});
