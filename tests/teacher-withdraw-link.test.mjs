import assert from 'node:assert/strict';
import {onRequest} from '../functions/_middleware.js';

const html = '<html><body><section id="access"><div id="accessList" class="list"></div></section></body></html>';
const env = {
  TOPMATH_ACCESS_TEAM_DOMAIN:'https://topmath.cloudflareaccess.com',
  TOPMATH_ACCESS_AUD:'aud-1',
  TOPMATH_ACCESS_EMAILS:'teacher@example.test'
};
let transformed = 0;
globalThis.HTMLRewriter = class {
  on(selector, handler) {
    assert.equal(selector, '#accessList');
    this.handler = handler;
    return this;
  }
  transform(response) {
    transformed++;
    return response.text().then(original=>{
      let snippet='';
      this.handler.element({after(s,opts){assert.equal(opts.html,true);snippet=s;}});
      assert.match(snippet,/gestion-eleves-retrait\.html/);
      return new Response(original.replace('<div id="accessList" class="list"></div>',
        '<div id="accessList" class="list"></div>'+snippet), response);
    });
  }
};
function ctx(path, variables=env, type='text/html') {
  return {
    request:new Request('https://topmath.example.test'+path),
    env:variables,
    next:async()=>new Response(html,{headers:{'content-type':type}})
  };
}
const linked = await onRequest(ctx('/enseignant.html'));
assert.match(await linked.text(),/Retirer un élève \(accès sécurisé\)/);
assert.equal(transformed,1);
const notConfigured = await onRequest(ctx('/enseignant.html',{}));
assert.equal(await notConfigured.text(),html);
assert.equal(transformed,1);
const apiResponse = await onRequest(ctx('/api/roster'));
assert.equal(await apiResponse.text(),html);
assert.equal(transformed,1);
const otherPage = await onRequest(ctx('/eleve.html'));
assert.equal(await otherPage.text(),html);
const notHtml = await onRequest(ctx('/enseignant.html',env,'application/json'));
assert.equal(await notHtml.text(),html);
assert.equal(transformed,1);
console.log('OK : lien injecté uniquement sur la page enseignant et après configuration Access');
