// Vérification cryptographique des jetons Cloudflare Access (sans bibliothèque externe).
// Refus par défaut si l'application Access n'est pas configurée.
let cachedKeys = null;
let cachedIssuer = '';
let cacheUntil = 0;
function decodeBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Jeton mal formé');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function jsonPart(part) { return JSON.parse(new TextDecoder().decode(decodeBase64Url(part))); }
function normalizeIssuer(value) {
  const issuer = String(value || '').trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(issuer)) return null;
  return issuer;
}
async function fetchKeys(issuer) {
  if (cachedKeys && cachedIssuer === issuer && cacheUntil > Date.now()) return cachedKeys;
  const response = await fetch(issuer + '/cdn-cgi/access/certs', { redirect: 'error' });
  if (!response.ok) throw new Error('Clés de validation indisponibles');
  const data = await response.json();
  if (!Array.isArray(data.keys) || data.keys.length === 0) throw new Error('Aucune clé disponible');
  cachedKeys = data.keys; cachedIssuer = issuer; cacheUntil = Date.now() + 5 * 60 * 1000;
  return cachedKeys;
}
export async function verifyTeacherAccess(request, env) {
  const issuer = normalizeIssuer(env?.TOPMATH_ACCESS_TEAM_DOMAIN);
  const audience = String(env?.TOPMATH_ACCESS_AUD || '').trim();
  const emails = String(env?.TOPMATH_ACCESS_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!issuer || !audience || emails.length === 0) return { ok:false,status:503,error:'Accès enseignant non configuré.' };
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  if (token.length > 12000) return {ok:false,status:403,error:'Accès refusé.'};
  const parts = token.split('.');
  if (parts.length !== 3) return {ok:false,status:403,error:'Accès refusé.'};
  try {
    const header = jsonPart(parts[0]);
    const payload = jsonPart(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw new Error('Algorithme non autorisé');
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== issuer || !Array.isArray(payload.aud) || !payload.aud.includes(audience)) throw new Error('Origine ou audience incorrecte');
    if (!Number.isInteger(payload.exp) || payload.exp <= now || !Number.isInteger(payload.iat) || payload.iat > now + 60) throw new Error('Jeton expiré ou non valide');
    if (payload.nbf != null && (!Number.isInteger(payload.nbf) || payload.nbf > now + 60)) throw new Error('Jeton pas encore valide');
    const email = String(payload.email || '').trim().toLowerCase();
    if (!emails.includes(email)) throw new Error('Enseignant non autorisé');
    const keys = await fetchKeys(issuer);
    const jwk = keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (k.alg == null || k.alg === 'RS256') && (k.use == null || k.use === 'sig'));
    if (!jwk) throw new Error('Clé inconnue');
    const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
    const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!verified) throw new Error('Signature invalide');
    return {ok:true,email};
  } catch (error) {
    console.warn('TopMath Access: validation refusée', String(error?.message || error));
    return {ok:false,status:403,error:'Accès refusé.'};
  }
}
