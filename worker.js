export function subdomainRedirect(url) {
  const suffix = '.ends.at';
  if (!url.hostname.endsWith(suffix)) return '';
  const name = url.hostname.slice(0, -suffix.length);
  const path = name === 'www' ? '' : '/' + name.split('.').map(encodeURIComponent).join('/');
  return `https://ends.at${path}${url.pathname === '/' ? '' : url.pathname}${url.search}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const redirect = subdomainRedirect(url);
    if (redirect) return new Response(null, {status:302, headers:{location:redirect,'cache-control':'no-store'}});
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    if (url.pathname === '/sheet' || url.pathname.startsWith('/sheet/')) {
      return env.ASSETS.fetch(new Request(new URL('/sheet/', url), request));
    }
    return env.ASSETS.fetch(request);
  }
};
