import test from 'node:test';
import assert from 'node:assert/strict';
import {DropQueue,dropApi} from '../drop.js';
import {createWorker} from '../worker.js';
class Storage {
  data=new Map();
  async get(key){return structuredClone(this.data.get(key));}
  async put(key,value){this.data.set(key,structuredClone(value));}
  async setAlarm(value){this.alarm=value;}
  async transaction(fn){return fn(this);}
}
const req=(path,body,headers={})=>new Request('https://ends.at/api/drop/'+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
const make=()=>{const storage=new Storage();const queue=new DropQueue({storage});return {storage,queue};};
test('Drop stores exact multiline text, leases once, completes and removes payload',async()=>{
  const {queue,storage}=make();const text='First line\nSecond line & <html> 🙂';
  const created=await queue.fetch(req('jobs',{action:'send-to-bekah',text}));assert.equal(created.status,201);const {id}=await created.json();
  const {job}=await (await queue.fetch(req('next',{}))).json();assert.equal(job.id,id);assert.equal(job.text,text);assert.equal(job.shortcut,'Send Text to Bekah Puls');
  assert.deepEqual(await (await queue.fetch(req('next',{}))).json(),{job:null});
  assert.equal((await queue.fetch(req('jobs/'+id+'/complete',{receipt:'incorrect'}))).status,409);
  assert.equal((await queue.fetch(req('jobs/'+id+'/complete',{receipt:job.receipt}))).status,200);
  assert.equal((await storage.get('jobs'))[0].text,'');
  assert.equal((await (await queue.fetch(req('jobs/'+id))).json()).status,'completed');
  assert.deepEqual(await (await queue.fetch(req('next',{}))).json(),{job:null});
});
test('Drop rejects blank text, unknown actions, oversized bodies and expired jobs',async()=>{
  const {queue,storage}=make();
  assert.equal((await queue.fetch(req('jobs',{action:'arbitrary',text:'test'}))).status,400);
  assert.equal((await queue.fetch(req('jobs',{action:'send-to-bekah',text:'  '}))).status,400);
  assert.equal((await queue.fetch(req('jobs',{action:'send-to-bekah',text:'a'.repeat(16001)}))).status,413);
  assert.equal((await queue.fetch(req('jobs',{action:'send-to-bekah',text:'a'.repeat(100001)}))).status,413);
  await storage.put('jobs',[{id:'expired',created_at:new Date(Date.now()-86400001).toISOString(),status:'pending'}]);
  assert.deepEqual(await (await queue.fetch(req('next',{}))).json(),{job:null});
});
test('Drop isolates queues by private key and refuses cross-origin calls',async()=>{
  const objects=new Map();const env={DROP_QUEUE:{idFromName:n=>n,get:n=>{if(!objects.has(n))objects.set(n,make().queue);return objects.get(n);}}};
  const auth=k=>({authorization:'Bearer '+k.repeat(64)});
  assert.equal((await dropApi(req('next',{}),env)).status,401);
  assert.equal((await dropApi(req('next',{}, {...auth('a'),origin:'https://other.example'}),env)).status,403);
  await dropApi(req('jobs',{action:'send-to-bekah',text:'private'},auth('a')),env);
  assert.deepEqual(await (await dropApi(req('next',{},auth('b')),env)).json(),{job:null});
  assert.equal((await (await dropApi(req('next',{},auth('a')),env)).json()).job.text,'private');
});
test('Drop API works without reading Google Sheets; unrelated POSTs stay rejected',async()=>{
  const worker=createWorker(()=>{throw Error('Sheets must not be needed');});
  assert.equal((await worker.fetch(req('actions'))).status,200);
  assert.equal((await worker.fetch(req('jobs',{text:'test'}))).status,401);
  assert.equal((await worker.fetch(new Request('https://ends.at/current',{method:'POST'}))).status,405);
});
