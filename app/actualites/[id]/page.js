import { getActualite, renderContent } from '../../../lib/directus';
import { assetUrl } from '../../../lib/themes';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Actualite({ params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const a = await getActualite(id);
  if (!a) notFound();
  const img = assetUrl(a.image);
  return (
    <article className="carte page-editoriale"
      data-edit-collection="actualites" data-edit-item={a.id}>
      <div
        className="banniere"
        style={img
          ? { backgroundImage: `linear-gradient(100deg, rgba(20, 30, 48, 0.75) 0%, transparent 75%), url(${img}?width=1400&format=webp)` }
          : { background: 'linear-gradient(115deg, var(--bleu), var(--bleu-clair))' }}
      >
        <h1>{a.title}</h1>
      </div>
      <div>
        <p className="meta">Publié le {(a.date_publication || '').slice(0, 10)}</p>
        {a.chapo && <p className="chapo">{a.chapo}</p>}
        {a.content && <div dangerouslySetInnerHTML={{ __html: renderContent(a.content) }} />}
        <p className="meta"><a href="/actualites">← Toutes les actualités</a></p>
      </div>
    </article>
  );
}
