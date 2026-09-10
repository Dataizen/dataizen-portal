'use client';
// « Lier au territoire » : détecte le niveau territorial du jeu et le contour de
// référence (suggestion), puis crée une carte choroplèthe sur validation.
import { useState } from 'react';

const LABELS = { commune: 'Communes', epci: 'EPCI', departement: 'Départements', region: 'Régions' };

export default function TerritoryLink({ name, adminUrl }) {
  const [open, setOpen] = useState(false);
  const [det, setDet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [created, setCreated] = useState(null);

  async function detect() {
    setOpen(true); setBusy(true); setMsg(''); setDet(null); setCreated(null);
    try {
      const r = await fetch('/api/dataset/territory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || 'détection indisponible'); else setDet(d);
    } catch { setMsg('détection indisponible'); }
    setBusy(false);
  }

  async function creerCarte() {
    setBusy(true); setMsg('création de la carte…');
    try {
      const r = await fetch('/api/dataset/generate-map', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (d.warming) { setMsg(d.message); setBusy(false); return; }
      if (d.error) { setMsg(d.error); setBusy(false); return; }
      setCreated(d); setMsg('✔ carte créée (brouillon).');
    } catch { setMsg('création indisponible'); }
    setBusy(false);
  }

  if (!open) {
    return <button className="bouton-admin secondaire" onClick={detect}>🗺 Lier au territoire</button>;
  }
  return (
    <div className="carte edition">
      <h3>Lier au territoire</h3>
      {busy && !det && <p className="meta">analyse…</p>}
      {msg && <p className="meta">{msg}</p>}
      {det && !det.level && <p className="meta">Aucun niveau territorial détecté (pas de colonne de code commune / EPCI / département / région).</p>}
      {det && det.level && (
        <>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li>Niveau détecté : <strong>{LABELS[det.level] || det.level}</strong></li>
            <li>Colonne de jointure (données) : <code>{det.code_col}</code> → propriété GeoJSON <code>{det.geo_code_col}</code></li>
            <li>Contour de référence : {det.contour_titre
              ? <strong>{det.contour_titre}</strong>
              : <span className="meta">aucun contour disponible pour ce niveau/région</span>}</li>
          </ul>
          {det.linkable && det.contour_rid ? (
            created ? (
              <p className="meta">Carte « {created.titre} » créée (valeur : <code>{created.valeur_col}</code>).{' '}
                {adminUrl && <a href={`${adminUrl}/admin/content/cartes/${created.id}`} target="_blank" rel="noopener">Ouvrir dans Directus</a>}</p>
            ) : (
              <p><button className="bouton-admin" onClick={creerCarte} disabled={busy}>
                {busy ? '⏳ …' : 'Valider et créer la carte choroplèthe'}</button></p>
            )
          ) : (
            <p className="meta">Liaison impossible : aucun contour de référence pour ce niveau (ex. EPCI hors métropole).</p>
          )}
        </>
      )}
      <p><button className="bouton-admin secondaire" onClick={() => setOpen(false)}>Fermer</button></p>
    </div>
  );
}
