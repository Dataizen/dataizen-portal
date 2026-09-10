#!/usr/bin/env bash
# Build + push de l'image portal, exécuté sur dtz-core (amd64 natif).
# Usage : ./build.sh 0.1.0
set -euo pipefail
cd "$(dirname "$0")"
VERSION="${1:?usage: ./build.sh <version>}"
IMG="registry.core.dataizen.eu/portal:$VERSION"

ssh dtz-core 'mkdir -p /opt/dtz/build/portal'
rsync -a --delete --exclude node_modules --exclude .next ./ dtz-core:/opt/dtz/build/portal/
ssh dtz-core "cd /opt/dtz/build/portal && sudo docker build -t $IMG . && sudo docker push $IMG"
echo "OK : $IMG (penser à bumper portal_version dans group_vars puis rejouer svc-portal.yml)"
