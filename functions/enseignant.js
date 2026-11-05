export async function onRequest(context) {
  const response = await context.next();
  const type = response.headers.get('content-type') || '';

  if (!type.includes('text/html')) return response;

  const html = await response.text();

  const target =
    'const dates=currentState.dates;\n  let nextIndex=dates.findIndex(x=>!x);';

  const replacement =
    'const dates=currentState.dates;\n  if(!dates.some(Boolean))return null;\n  let nextIndex=dates.findIndex(x=>!x);';

  const patched = html.includes(target)
    ? html.replace(target, replacement)
    : html;

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');

  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
