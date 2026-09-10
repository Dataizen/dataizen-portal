import { getActualites } from '../../lib/directus';
import { assetUrl } from '../../lib/themes';

export const dynamic = 'force-dynamic';

export default async function Actualites() {
  const actus = await getActualites();
  return (
    <div>
      <h1>Actualités</h1>
      {actus.length === 0 && <p className="meta">Aucune actualité publiée pour le moment.</p>}
      <div className="vitrines">
        {actus.map((a) => (
          <a className="carte vitrine actu" href={`/actualites/${a.id}`} key={a.id}>
            {a.image && <img className="actu-img" src={`${assetUrl(a.image)}?width=640&format=webp`} alt="" loading="lazy" />}
            <p className="meta">{(a.date_publication || '').slice(0, 10)}</p>
            <h2>{a.title}</h2>
            {a.chapo && <p>{a.chapo}</p>}
            <p className="meta">Lire la suite →</p>
          </a>
        ))}
      </div>
    </div>
  );
}
