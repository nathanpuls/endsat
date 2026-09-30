// The sole action registry. Integrations and recipients remain inside Shortcuts.
export const DROP_ACTIONS = [{id:'send-to-bekah', name:'Send to Bekah', shortcut:'Send Text to Bekah Puls', enabled:true}];
export const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json', 'cache-control':'no-store', 'x-content-type-options':'nosniff'}});
const DAY = 86400000;
const MAX_TEXT = 16000;

export async function dropApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/api/drop/actions' && request.method === 'GET') return json({actions:DROP_ACTIONS.filter(a => a.enabled)});
  if (!['GET','POST'].includes(request.method)) return json({error:'Method not allowed.'},405);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({error:'Use Drop on ends.at.'},403);
  const key = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!key) return json({error:'Pair this device with your Drop key.'},401);
  if (!env.DROP_QUEUE) return json({error:'Drop storage is not connected yet.'},503);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  try {
    return await env.DROP_QUEUE.get(env.DROP_QUEUE.idFromName(hash)).fetch(request);
  } catch {
    return json({error:'Drop could not save or retrieve the job. Try again.'},503);
  }
}

// SQLite-backed Durable Object; transactional KV keeps the prototype small.
export class DropQueue {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    let body = {};
    if (request.method === 'POST') {
      // Bound the body while reading, including requests without Content-Length.
      const reader = request.body?.getReader(); let size = 0; const parts = [];
      if (!reader) return json({error:'Use a JSON request body.'},400);
      for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length;
        if (size > 100000) { await reader.cancel(); return json({error:'The request is too large.'},413); } parts.push(value); }
      try { const bytes = new Uint8Array(size); let offset=0; for (const part of parts) { bytes.set(part,offset); offset+=part.length; }
        body = JSON.parse(new TextDecoder().decode(bytes)); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
      } catch { return json({error:'Use a JSON request body.'},400); }
    }
    const now = Date.now();
    const response = await this.state.storage.transaction(async storage => {
      const jobs = (await storage.get('jobs') || []).filter(j => now - Date.parse(j.created_at) < DAY);
      let response;
      if (path === '/api/drop/jobs' && request.method === 'POST') {
        const action = DROP_ACTIONS.find(a => a.enabled && a.id === body.action);
        if (!action) return json({error:'Choose an enabled action.'},400);
        if (typeof body.text !== 'string' || !body.text.trim()) return json({error:'Enter some text first.'},400);
        if (body.text.length > MAX_TEXT) return json({error:'Keep the text under 16,000 characters.'},413);
        if (jobs.filter(j=>j.status==='pending').length >= 100) return json({error:'Receive pending jobs before adding more.'},429);
        const job = {id:crypto.randomUUID(), action:action.id, shortcut:action.shortcut, text:body.text, created_at:new Date(now).toISOString(),status:'pending'};
        jobs.push(job); response=json({id:job.id,created_at:job.created_at,status:job.status},201);
      } else if (path === '/api/drop/next' && request.method === 'POST') {
        // A short lease prevents simultaneous receivers taking the same job.
        const job=jobs.find(j=>j.status==='pending');
        if (!job || (job.lease_until || 0) > now) response=json({job:null});
        else { job.lease_until=now+300000; job.receipt=crypto.randomUUID();
          const {lease_until,...publicJob}=job; response=json({job:publicJob}); }
      } else if (/^\/api\/drop\/jobs\/[\w-]+\/complete$/.test(path) && request.method === 'POST') {
        const id=path.split('/')[4], job=jobs.find(j=>j.id===id);
        if (!job) return json({error:'Job not found or expired.'},404);
        if (!body.receipt || body.receipt!==job.receipt) return json({error:'Receive this job before completing it.'},409);
        job.status='completed'; job.text=''; response=json({id:job.id,status:job.status});
      } else if (/^\/api\/drop\/jobs\/[\w-]+$/.test(path) && request.method === 'GET') {
        const job=jobs.find(j=>j.id===path.split('/')[4]);
        response=job ? json({id:job.id,status:job.status,created_at:job.created_at}) : json({error:'Job not found or expired.'},404);
      } else return json({error:'Not found.'},404);
      await storage.put('jobs',jobs);
      if (jobs.length) await storage.setAlarm(Math.min(...jobs.map(j=>Date.parse(j.created_at)+DAY)));
      return response;
    });
    return response;
  }
  async alarm() {
    await this.state.storage.transaction(async storage => {
      const jobs=(await storage.get('jobs') || []).filter(j=>Date.now()-Date.parse(j.created_at)<DAY);
      await storage.put('jobs',jobs);
      if (jobs.length) await storage.setAlarm(Math.min(...jobs.map(j=>Date.parse(j.created_at)+DAY)));
    });
  }
}
