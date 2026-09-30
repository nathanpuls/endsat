import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{subdomainRedirect} from '../worker.js';
import fs from 'node:fs';
import vm from 'node:vm';

test('wildcard redirects preserve project, path and query',()=>{
 assert.equal(subdomainRedirect(new URL('https://project.ends.at/demo?x=1')),'https://ends.at/project/demo?x=1');
 assert.equal(subdomainRedirect(new URL('https://sheet.ends.at/')),'https://ends.at/sheet');
 assert.equal(subdomainRedirect(new URL('https://www.ends.at/a')),'https://ends.at/a');
 assert.equal(subdomainRedirect(new URL('https://ends.at/')),'');
 assert.equal(subdomainRedirect(new URL('https://fakeends.at/')),'');
});
test('sheet deep links serve the sheet renderer',async()=>{
 let fetched;
 const res=await worker.fetch(new Request('https://ends.at/sheet/linktree'),{ASSETS:{fetch(req){fetched=new URL(req.url).pathname;return new Response('renderer')}}});
 assert.equal(fetched,'/sheet/index.html');assert.equal(await res.text(),'renderer');
});
test('separate project assets and unknown paths remain separate',async()=>{
 let fetched;
 await worker.fetch(new Request('https://ends.at/project/style.css'),{ASSETS:{fetch(req){fetched=new URL(req.url).pathname;return new Response('css')}}});
 assert.equal(fetched,'/project/style.css');
});
const html=fs.readFileSync(new URL('../public/sheet/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const context=vm.createContext({window:{},location:{pathname:'/sheet'},document:{head:{appendChild(){}},createElement(){return {}}},setTimeout(){return 1},clearTimeout(){}});
vm.runInContext(script,context);
test('index includes A1, unnamed rows, named rows, and duplicate names',()=>{
 const data={table:{rows:[{c:[{v:'<title>Homepage</title>'}]},{c:[{v:'<button>Hello</button>'},{v:'Test Page'}]},{c:[{v:'# Another'},{v:'Test Page'}]},{c:[{v:''}]},{c:[{v:'# Unnamed'}]}]}};
 context.data=data;const entries=vm.runInContext('pageEntries(data)',context);
 assert.deepEqual(Array.from(entries,e=>e.slug),['a1','test-page','test-page-a3','a5']);
 assert.equal(entries[0].label,'Homepage');assert.equal(entries[3].label,'Unnamed');
});
test('HTML and redirects retain the original custom-page behavior',()=>{
 assert.equal(vm.runInContext('getRenderableHtml("<button>Hello</button>")',context),'<button>Hello</button>');
 assert.equal(vm.runInContext('getRedirectUrl("example.com")',context),'https://example.com');
 assert.equal(vm.runInContext('getRedirectUrl("javascript:alert(1)")',context),'');
});
