import Script from 'next/script';

// Documentation interactive (Scalar, auto-hébergé) de la spec OpenAPI exposée
// par PostgREST pour toutes les API générées automatiquement (schéma api).
// Scalar lit le placeholder <script id="api-reference"> puis se monte en place.
export const metadata = { title: "Explorateur d'API" };
export const dynamic = 'force-dynamic';

export default function ApiExplorer() {
  const config = JSON.stringify({ hideDownloadButton: false, hideClientButton: true });
  return (
    <div>
      <h1>Explorateur d'API</h1>
      <p className="meta">
        Documentation interactive des API générées automatiquement pour les jeux de données
        publics (PostgREST, spec OpenAPI), limitée au périmètre de cette instance. Les requêtes
        sont essayables directement ici.
      </p>
      <script id="api-reference" data-url="/api/openapi" data-configuration={config} />
      <Script src="/scalar/standalone.js" strategy="afterInteractive" />
    </div>
  );
}
