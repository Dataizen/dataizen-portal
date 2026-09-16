import { getActualites } from '../../lib/directus';
import { assetUrl } from '../../lib/themes';
import { t } from '../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function Actualites() {
  const actus = await getActualites();
  return (
    <div>
      <h1>{t('news.title')}</h1>
      {actus.length === 0 && <p className="meta">{t('news.empty')}</p>}
      <div className="vitrines">
        {actus.map((a) => (
          <a className="carte vitrine actu" href={`/actualites/${a.id}`} key={a.id}>
            {a.image && <img className="actu-img" src={`${assetUrl(a.image)}?width=640&format=webp`} alt="" loading="lazy" />}
            <p className="meta">{(a.date_publication || '').slice(0, 10)}</p>
            <h2>{a.title}</h2>
            {a.chapo && <p>{a.chapo}</p>}
            <p className="meta">{t('news.readMore')}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
