# Portail Dataizen : build multi-stage, images de base depuis le registre privé
FROM registry.core.dataizen.eu/node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
# Visibilité sécurité : signale les vulnérabilités connues des dépendances à chaque
# build (non bloquant). À traiter par une montée de version (voir docs/SECURITY.md).
RUN npm audit --omit=dev --audit-level=high || true
COPY . .
# DSFR auto-hébergé (aucun CDN) : servi sur /dsfr par le portail
RUN mkdir -p public/dsfr && cp -r node_modules/@gouvfr/dsfr/dist/* public/dsfr/
# Bibliothèques front auto-hébergées (aucun CDN au runtime) : Scalar (doc d'API,
# servi sur /scalar) et ECharts (studio de visualisation, servi sur /echarts).
# curl avec retries : le wget busybox échoue parfois sur le CDN (TLS/redirect).
RUN apk add --no-cache curl \
 && mkdir -p public/scalar public/echarts \
 && curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors -o public/scalar/standalone.js \
    https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.28/dist/browser/standalone.js \
 && curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors -o public/echarts/echarts.min.js \
    https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js
RUN npm run build

FROM registry.core.dataizen.eu/node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p .next/cache && chown -R node:node .next
# le runtime lance « node server.js » : npm n'est pas nécessaire et embarque des
# dépendances vulnérables (scan Trivy). On le retire de l'image finale (surface réduite).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER node
EXPOSE 3000
CMD ["node", "server.js"]
