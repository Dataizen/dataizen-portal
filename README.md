# dataizen-portal

Portail d'instance de la plateforme **Dataizen** (Next.js). Chaque instance Dataizen
expose son portail public : catalogue de données, fiches de jeux, cartes et graphiques,
espace connecté (SSO Keycloak), dépôt de fichiers.

Le portail est autonome : il dialogue avec CKAN et le CMS uniquement par leurs API HTTP.
Il ne contient aucun code CKAN.

## Développement

```bash
npm install
npm run dev
```

Configuration par variables d'environnement (voir le code des routes `app/api/*` et
`lib/*`) : URL et jetons de CKAN, du CMS, du service RAG, de Keycloak. Aucune valeur
sensible n'est versionnée.

## Build et déploiement

L'image est construite et taguée par version (`build.sh <version>`), poussée vers le
registre de la plateforme, puis déployée par instance via l'infra Ansible. Les versions
sont figées (jamais `latest`).

## Licence

MIT (voir [LICENSE](LICENSE)). Le portail est une œuvre originale Dataizen, non dérivée
de CKAN.
