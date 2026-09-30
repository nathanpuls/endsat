import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker, subdomainRedirect, pageEntries, projectEntries, SHEET_ID} from '../worker.js';
import {getRenderableHtml, getRedirectUrl} from '../render.js';

const master = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
function fixture(settings = [], projects = [['URL','Name','Tab','Path','Enabled','Description'],[master,'Current'],[master,'Old']], home = '<button>My home</button>') {
 const calls=[];
 const fetcher=async input => {
  const url=new URL(input);calls.push(url);
  const tab=url.searchParams.get('sheet');
  const rows=tab==='Settings'?[['Setting','Value'],...settings]:tab==='Projects (Connected Sheets)'?projects:tab==='Home'?[[home]]:tab==='Current'?[[],['go.com'],['# Named page','Hello'],['<button>Custom</button>','custom']]:[['# Old page','old']];
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
test('project order follows rows; disabled projects disconnect and reconnect',async()=>{
 const rows=[['URL','Name','Tab','Path','Enabled'],[master,'Old'],[master,'Current','','',false]];
 const f=fixture([],rows);
 assert.deepEqual((await (await f.request('/projects.json')).json()).map(p=>p.name),['Old']);
 assert.equal((await f.request('/current')).status,404);
 assert.equal((await f.request('/sheet/a2')).status,404);
 rows[2][4]=true;
 assert.deepEqual((await (await f.request('/projects.json')).json()).map(p=>p.name),['Old','Current']);
 assert.equal((await f.request('/sheet/a2')).headers.get('location'),'https://go.com');
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
 assert.throws(()=>projectEntries([['URL','Name'],[master,'Same'],[master,'Same']]),/duplicated/);
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
