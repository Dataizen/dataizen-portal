import { listOrganizations, catalogueOrgs } from '../../lib/ckan';
import { getSettings } from '../../lib/directus';

export const dynamic = 'force-dynamic';

export default async function Organisations() {
  let orgs = await listOrganizations();
  const perimetre = catalogueOrgs(await getSettings());
  if (perimetre) orgs = orgs.filter((o) => perimetre.includes(o.name));
  return (
    <div>
      <h1>Organisations</h1>
      {orgs.map((o) => (
        <div className="carte" key={o.name}>
          <h3><a href={`/catalogue?organization=${o.name}`}>{o.display_name || o.name}</a></h3>
          {o.description && <p>{o.description}</p>}
          <p className="meta">{o.package_count} jeu(x) de données</p>
        </div>
      ))}
    </div>
  );
}
