import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../gestion-eleves-retrait.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,1,'Une seule logique JS locale attendue');
new vm.Script(scripts[0][1],{filename:'gestion-eleves-retrait.html'});
for(const name of ['search','status','list','dialog','dialogTitle','selectedName','name','check','error','cancel','submit']){
 assert.match(html,new RegExp('id="'+name+'"'),'Élément requis : '+name);
}
assert.match(html,/fetch\('\/api\/student-withdraw-list'/);
assert.match(html,/fetch\('\/api\/student-withdraw'/);
assert.match(html,/confirm_withdrawal:true/);
assert.match(html,/credentials:'same-origin'/);
assert.doesNotMatch(html,/TOPMATH_ADMIN_TOKEN|TOPMATH_ACCESS_AUD|TOPMATH_ACCESS_TEAM_DOMAIN|Cf-Access-Jwt-Assertion/);
console.log('OK : syntaxe, éléments de formulaire, routes, confirmation, aucun secret dans le HTML');
