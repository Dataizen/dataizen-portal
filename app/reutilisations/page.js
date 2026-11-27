import { t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

// La collection « réutilisations » n'a pas été reprise dans le CMS Payload
// (fonctionnalité dormante depuis le décommissionnement de Directus). La page
// reste disponible mais vide tant qu'un équivalent Payload n'est pas construit.
export default function Reutilisations() {
  return (
    <div>
      <h1>{t('reuses.title')}</h1>
      <p className="meta">{t('reuses.empty')}</p>
    </div>
  );
}
