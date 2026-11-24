// Ajout non destructif d'un lien vers l'administration sécurisée des élèves.
// Ce middleware ne modifie que la page enseignant et uniquement lorsque
// Cloudflare Access est configuré côté serveur.
export async function onRequest(context) {
  const response = await context.next();
  const path = new URL(context.request.url).pathname;
  if (path !== '/enseignant.html' || !response.ok) return response;
  if (!String(response.headers.get('content-type') || '').toLowerCase().includes('text/html')) return response;

  const env = context.env || {};
  const configured = Boolean(
    String(env.TOPMATH_ACCESS_TEAM_DOMAIN || '').trim() &&
    String(env.TOPMATH_ACCESS_AUD || '').trim() &&
    String(env.TOPMATH_ACCESS_EMAILS || '').trim()
  );
  if (!configured) return response;

  const anchor = '<div id="topmath-withdraw-link" style="margin-top:14px">'
    + '<a href="/gestion-eleves-retrait.html" '
    + 'style="display:inline-block;padding:11px 15px;background:#e8f0f7;color:#173a57;border-radius:9px;font-weight:700;text-decoration:none">'
    + 'Retirer un élève (accès sécurisé)</a></div>';

  return new HTMLRewriter()
    .on('#accessList', {
      element(element) { element.after(anchor, { html: true }); }
    })
    .transform(response);
}
