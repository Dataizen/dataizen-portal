'use client';
// « Lier au territoire » : détecte le niveau territorial du jeu et le contour de
// référence (suggestion), puis crée une carte choroplèthe sur validation.
import { useState } from 'react';
import { useT } from './I18nProvider';

const LABEL_KEYS = { commune: 'territory.levelCommune', epci: 'territory.levelEpci',
  departement: 'territory.levelDepartement', region: 'territory.levelRegion' };

export default function TerritoryLink({ name, adminUrl }) {
  const t = useT();
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
      if (!r.ok) setMsg(d.error || t('territory.detectionUnavailable')); else setDet(d);
    } catch { setMsg(t('territory.detectionUnavailable')); }
    setBusy(false);
  }

  async function creerCarte() {
    setBusy(true); setMsg(t('territory.creatingMap'));
    try {
      const r = await fetch('/api/dataset/generate-map', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (d.warming) { setMsg(d.message); setBusy(false); return; }
      if (d.error) { setMsg(d.error); setBusy(false); return; }
      setCreated(d); setMsg(t('territory.mapCreated'));
    } catch { setMsg(t('territory.creationUnavailable')); }
    setBusy(false);
  }

  if (!open) {
    return <button className="bouton-admin secondaire" onClick={detect}>🗺 {t('territory.linkButton')}</button>;
  }
  return (
    <div className="carte edition">
      <h3>{t('territory.linkTitle')}</h3>
      {busy && !det && <p className="meta">{t('territory.analyzing')}</p>}
      {msg && <p className="meta">{msg}</p>}
      {det && !det.level && <p className="meta">{t('territory.noLevel')}</p>}
      {det && det.level && (
        <>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li>{t('territory.detectedLevel')} <strong>{LABEL_KEYS[det.level] ? t(LABEL_KEYS[det.level]) : det.level}</strong></li>
            <li>{t('territory.joinColumn')} <code>{det.code_col}</code> {t('territory.geoProperty')} <code>{det.geo_code_col}</code></li>
            <li>{t('territory.refContour')} {det.contour_titre
              ? <strong>{det.contour_titre}</strong>
              : <span className="meta">{t('territory.noContourAvailable')}</span>}</li>
          </ul>
          {det.linkable && det.contour_rid ? (
            created ? (
              <p className="meta">{t('territory.cardPrefix')} {created.titre} {t('territory.cardValue')} <code>{created.valeur_col}</code>).{' '}
                {adminUrl && <a href={`${adminUrl}/admin/content/cartes/${created.id}`} target="_blank" rel="noopener">{t('territory.openInDirectus')}</a>}</p>
            ) : (
              <p><button className="bouton-admin" onClick={creerCarte} disabled={busy}>
                {busy ? '⏳ …' : t('territory.validateCreate')}</button></p>
            )
          ) : (
            <p className="meta">{t('territory.linkImpossible')}</p>
          )}
        </>
      )}
      <p><button className="bouton-admin secondaire" onClick={() => setOpen(false)}>{t('territory.close')}</button></p>
    </div>
  );
}
