import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';
import { notify } from '../../../../lib/notify';

// Validation en un clic (admin d'instance) : publie le jeu (privé -> public) et
// pose les extras de validation (validé par / le). Fusion préservant les extras.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';

async function ckan(action, payload) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.CKAN_EDIT_TOKEN },
    body: JSON.stringify(payload),
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

export async function POST(request) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: 'réservé à un administrateur' }, { status: 403 });
  }
  const { name } = await request.json().catch(() => ({}));
  if (!/^[a-z0-9_-]{2,100}$/.test(name || '')) {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  const shown = await fetch(`${CKAN}/api/3/action/package_show?id=${name}`,
    { headers: { Authorization: process.env.CKAN_EDIT_TOKEN }, cache: 'no-store' });
  if (!shown.ok) return NextResponse.json({ error: 'dataset introuvable' }, { status: 404 });
  const pkg = (await shown.json()).result;
  const extras = {};
  for (const e of (pkg.extras || [])) extras[e.key] = e.value;
  extras.valide = 'oui';
  extras.valide_par = session.email;
  extras.valide_le = new Date().toISOString().slice(0, 10);
  const patch = await ckan('package_patch', {
    id: pkg.id, private: false,
    extras: Object.entries(extras).map(([key, value]) => ({ key, value })),
  });
  if (!patch.ok) return NextResponse.json({ error: 'échec de la validation' }, { status: 502 });

  // Notifications : le déposant (message de confirmation) et les admins plateforme
  // (supervision globale : ils sont notifiés de tous les événements de toutes les instances).
  const base = process.env.NEXT_PUBLIC_BASE_URL || '';
  const titre = pkg.title || name;
  const instance = process.env.INSTANCE_NAME || '';
  await notify(extras.depose_par, 'Votre jeu de données a été validé et publié',
    `Bonjour,\n\nVotre jeu de données « ${titre} » a été validé et publié au catalogue.\n\n`
    + `Fiche : ${base}/dataset/${name}\n\nMerci pour votre contribution.`);
  const platform = (process.env.PLATFORM_ADMINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  await notify(platform, `Jeu validé et publié (${instance}) : ${titre}`,
    `Un jeu a été validé et publié sur l'instance « ${instance} ».\n\n`
    + `Titre : ${titre}\nValidé par : ${session.email}\nDéposé par : ${extras.depose_par || '—'}\n\n`
    + `Fiche : ${base}/dataset/${name}`);

  return NextResponse.json({ ok: true });
}
