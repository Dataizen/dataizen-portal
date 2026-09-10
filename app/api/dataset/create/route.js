import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '../../../../lib/session';
import { valuesToExtras } from '../../../../lib/metadata';
import { notify } from '../../../../lib/notify';

// Dépôt d'un jeu de données depuis le portail (utilisateur connecté).
// Esprit workspace : privé par défaut, seul un admin peut publier directement.
const CKAN = process.env.CKAN_INTERNAL_URL || 'http://ckan:5000';
const MAX_UPLOAD = 100 * 1024 * 1024;

const slugify = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);

async function ckan(action, payload) {
  const r = await fetch(`${CKAN}/api/3/action/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: process.env.CKAN_EDIT_TOKEN },
    body: JSON.stringify(payload),
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'connexion requise' }, { status: 401 });
  const admin = isAdmin(session);

  const form = await request.formData();
  const title = String(form.get('title') || '').trim().slice(0, 200);
  if (title.length < 3) return NextResponse.json({ error: 'titre trop court' }, { status: 400 });
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));

  // organisation : celle de l'instance par défaut ; un admin peut en choisir une autre
  const instanceOrg = process.env.INSTANCE_NAME || 'dataizen';
  const org = admin && values.organization ? slugify(values.organization) : instanceOrg;
  await ckan('organization_create', { name: org, title: org });

  // nom unique dérivé du titre
  let name = slugify(title) || `depot-${Date.now()}`;
  const exists = await ckan('package_show', { id: name });
  if (exists.ok) name = `${name}-${Math.random().toString(36).slice(2, 6)}`;

  const created = await ckan('package_create', {
    name,
    title,
    notes: String(values.notes || '').slice(0, 5000),
    owner_org: org,
    license_id: values.license_id || 'notspecified',
    private: admin ? values.visibility !== 'public' : true,
    tags: String(values.tags || '').split(',').map((t) => t.trim()).filter(Boolean)
      .slice(0, 15).map((t) => ({ name: t.slice(0, 100) })),
    extras: [
      { key: 'depose_par', value: session.email },
      ...(session.name ? [{ key: 'depose_par_nom', value: session.name }] : []),
      { key: 'depose_via', value: `portail ${instanceOrg}` },
      ...valuesToExtras(values),
    ],
  });
  if (!created.ok) {
    return NextResponse.json({ error: `échec création (${JSON.stringify(created.body.error || created.status)})` }, { status: 502 });
  }

  // ressource : fichier téléversé (chaîne de dépôt xloader) ou URL distante
  const file = form.get('file');
  const url = String(values.resource_url || '').trim();
  if (file && typeof file !== 'string' && file.size > 0) {
    if (file.size > MAX_UPLOAD) return NextResponse.json({ error: 'fichier trop volumineux (100 Mo max)' }, { status: 400 });
    const fd = new FormData();
    fd.set('package_id', name);
    fd.set('name', file.name);
    fd.set('format', (file.name.split('.').pop() || '').toUpperCase());
    fd.set('upload', file, file.name);
    const r = await fetch(`${CKAN}/api/3/action/resource_create`, {
      method: 'POST',
      headers: { Authorization: process.env.CKAN_EDIT_TOKEN },
      body: fd,
    });
    if (!r.ok) return NextResponse.json({ error: 'dataset créé mais échec du téléversement', name }, { status: 502 });
  } else if (url && /^https?:\/\//.test(url)) {
    await ckan('resource_create', {
      package_id: name,
      url,
      name: values.resource_name || url.split('/').pop() || 'ressource',
      format: (url.split('.').pop() || '').slice(0, 10).toUpperCase(),
    });
  }

  // Notification : un dépôt en brouillon privé est à valider par les admins d'instance.
  const isPrivate = admin ? values.visibility !== 'public' : true;
  if (isPrivate) {
    const base = process.env.NEXT_PUBLIC_BASE_URL || '';
    // admins d'instance + admins plateforme (supervision globale), dédupliqués
    const admins = [...new Set([
      ...(process.env.PORTAL_ADMINS || '').split(','),
      ...(process.env.PLATFORM_ADMINS || '').split(','),
    ].map((s) => s.trim().toLowerCase()).filter(Boolean))];
    await notify(admins, `Nouveau dépôt à valider : ${title}`,
      `Un nouveau jeu de données a été déposé sur l'instance « ${instanceOrg} » et attend une validation.\n\n`
      + `Titre : ${title}\n`
      + `Déposé par : ${session.name || session.email} (${session.email})\n\n`
      + `Fiche : ${base}/dataset/${name}\n\n`
      + `Vous pouvez le vérifier (contrôle qualité) puis le publier via « Valider et publier ».`);
  }

  return NextResponse.json({ ok: true, name });
}
