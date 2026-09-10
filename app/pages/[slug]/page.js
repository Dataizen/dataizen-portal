import { getPage, getPagePreview, renderContent, renderBlocs, getThematiques } from '../../../lib/directus';
import { getSession, isAdmin } from '../../../lib/session';
import { assetUrl } from '../../../lib/themes';
import { notFound } from 'next/navigation';
import RapportLayout from '../../../components/RapportLayout';

export const dynamic = 'force-dynamic';

export default async function PageEditoriale({ params }) {
  const { slug } = await params;
  let page = await getPage(slug);
  const session = await getSession();
  const estAdmin = !!(session && isAdmin(session));
  // Page publiée mais « réservée aux admins » : 404 pour tout non-admin.
  if (page && page.admin_seulement && !estAdmin) notFound();
  // Aperçu Directus (oeil) d'un brouillon : si la page publiée n'existe pas mais
  // qu'un admin est connecté (aperçu depuis l'iframe même domaine), on rend le
  // brouillon avec un bandeau. Un visiteur non connecté garde un 404.
  let apercu = false;
  if (!page && estAdmin) {
    page = await getPagePreview(slug);
    apercu = !!page;
  }
  if (!page) notFound();

  // Modèle « rapport » : si le contenu est un JSON à sections, on rend la mise
  // en page dédiée (fil d'Ariane, pagination, 2 colonnes texte / visualisation).
  let rapport = null;
  try {
    const j = JSON.parse(page.content);
    if (j && Array.isArray(j.sections)) rapport = j;
  } catch { /* contenu HTML classique */ }
  const bandeauApercu = apercu ? (
    <div className="dtz-apercu" role="status">Aperçu, page en brouillon non publiée.</div>
  ) : null;
  if (rapport) {
    return (
      <article className="carte page-editoriale page-rapport">
        {bandeauApercu}
        <RapportLayout title={page.title} intro={rapport.intro || []} sections={rapport.sections}
                       parent={{ title: "Rapports d'analyse", slug: 'rapports-analyse' }} />
      </article>
    );
  }
  // bannière : image de la page, sinon dégradé aux couleurs de la thématique
  const thematiques = await getThematiques();
  const th = thematiques.find((t) => t.slug === slug);
  const img = assetUrl(page.image);
  const hex = th?.couleur && /^#[0-9a-fA-F]{6}$/.test(th.couleur) ? th.couleur : null;
  const fond = img
    ? { backgroundImage: `linear-gradient(100deg, ${hex ? hex + 'e6' : 'rgba(29,58,95,0.85)'} 0%, transparent 72%), url(${img})` }
    : hex
      ? { background: `linear-gradient(115deg, ${hex} 0%, ${hex}b3 55%, ${hex}66 100%)` }
      : { background: 'linear-gradient(115deg, var(--bleu), var(--bleu-clair))' };
  return (
    <article className="carte page-editoriale">
      {bandeauApercu}
      <div className="banniere" style={fond}>
        <h1>{th?.icone && <span aria-hidden="true">{th.icone} </span>}{page.title}</h1>
      </div>
      {/* constructeur par blocs si la page en a ; sinon contenu classique (compat).
          En mode blocs, renderBlocs insère les points « ＋ Ajouter un bloc ici »
          (visibles seulement dans l'éditeur) entre les blocs. */}
      <div dangerouslySetInnerHTML={{
        __html: page.blocs?.length ? await renderBlocs(page.blocs, page.id) : renderContent(page.content),
      }} />
      {page.custom_js && (
        // JS de la page, écrit par l'admin dans Directus (champ custom_js) :
        // permet une mini-appli ou une interaction sans toucher au portail
        <script dangerouslySetInnerHTML={{ __html: page.custom_js }} />
      )}
    </article>
  );
}
