import { NextResponse } from 'next/server';
import { catalogueOrgs } from '../../../lib/ckan';
import { getSettings } from '../../../lib/directus';

// Assistant du portail : proxifie le service RAG souverain (dtz-rag) en injectant
// le périmètre de l'instance (organisations du catalogue + contenu CMS de l'instance).
// v1 : données publiques uniquement, donc pas d'ACL par utilisateur.
const RAG = process.env.RAG_INTERNAL_URL || 'http://dtz-rag:8000';

export async function POST(request) {
  const { q, context } = await request.json().catch(() => ({}));
  if (!q || typeof q !== 'string' || q.length > 2000) {
    return NextResponse.json({ error: 'question invalide' }, { status: 400 });
  }
  let orgs = null;
  try { orgs = catalogueOrgs(await getSettings()); } catch { orgs = null; }
  const scope = { instance: process.env.INSTANCE_NAME || null, orgs };
  // contexte de la page consultée : le jeu / la page courante est priorisé
  const c = context || {};
  if (typeof c.dataset === 'string' && /^[a-z0-9_-]{2,100}$/i.test(c.dataset)) {
    scope.focus_dataset = c.dataset;
  } else if (typeof c.focus_url === 'string' && /^https:\/\/[a-z0-9.\/_-]{4,300}$/i.test(c.focus_url)) {
    scope.focus_url = c.focus_url;
  }
  if (typeof c.page_title === 'string' && c.page_title.length <= 300) {
    scope.page_title = c.page_title.slice(0, 200);
  }
  try {
    const r = await fetch(`${RAG}/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, scope, top_k: 6 }),
      signal: AbortSignal.timeout(150000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 503 || d.warming) {
      return NextResponse.json({ warming: true, message: d.message
        || "L'assistant démarre le GPU (1 à 2 min). Réessayez dans une minute.",
        sources: d.sources || [] });
    }
    if (!r.ok) return NextResponse.json({ error: 'assistant indisponible' }, { status: 502 });
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ warming: true,
      message: "L'assistant démarre (le GPU peut mettre 1 à 2 min). Réessayez dans une minute." });
  }
}
