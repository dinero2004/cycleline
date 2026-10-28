#!/usr/bin/env bash
# Build the API and web images on the k3s node, import them into containerd, apply
# k8s/ and route API_HOSTNAME and WEB_HOSTNAME through Apache. Run on the server:
#   scripts/k8s-deploy.sh [env-file]   (default: .env.vm)
set -euo pipefail

cd "$(dirname "$0")/.."

env_file="${1:-.env.vm}"
set -a
# shellcheck source=/dev/null
. "$env_file"
set +a
: "${APP_KEY:?set APP_KEY in $env_file}"
: "${APP_URL:?set APP_URL in $env_file}"
: "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in $env_file}"
: "${API_HOSTNAME:?set API_HOSTNAME in $env_file}"
: "${WEB_HOSTNAME:?set WEB_HOSTNAME in $env_file}"
: "${AUTH_SECRET:?set AUTH_SECRET in $env_file}"

k() { sudo k3s kubectl "$@"; }

docker build -f backend/Dockerfile -t cycleline-backend:local .
docker save cycleline-backend:local | sudo k3s ctr images import -
docker build -f frontend/Dockerfile -t cycleline-frontend:local .
docker save cycleline-frontend:local | sudo k3s ctr images import -

k apply -f k8s/00-namespace.yaml
k -n cycleline create secret generic cycleline-private \
  --from-literal=APP_KEY="$APP_KEY" \
  --from-literal=APP_URL="$APP_URL" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --from-literal=AUTH_SECRET="$AUTH_SECRET" \
  --from-literal=AUTH_URL="https://$WEB_HOSTNAME" \
  --dry-run=client -o yaml | k apply -f -
k apply -k k8s
k -n cycleline rollout status statefulset/postgres --timeout=300s
k -n cycleline rollout restart deployment/backend deployment/frontend
k -n cycleline rollout status deployment/backend --timeout=300s
k -n cycleline rollout status deployment/frontend --timeout=300s

cluster_ip="$(k -n cycleline get service backend -o jsonpath='{.spec.clusterIP}')"
sed -e "s/__API_HOSTNAME__/$API_HOSTNAME/g" -e "s/__CLUSTER_IP__/$cluster_ip/g" \
  deploy/apache/cycleline-api.conf.template \
  | sudo tee /etc/apache2/sites-available/cycleline-api.conf > /dev/null
web_ip="$(k -n cycleline get service frontend -o jsonpath='{.spec.clusterIP}')"
sed -e "s/__WEB_HOSTNAME__/$WEB_HOSTNAME/g" -e "s/__CLUSTER_IP__/$web_ip/g" \
  deploy/apache/cycleline-web.conf.template \
  | sudo tee /etc/apache2/sites-available/cycleline-web.conf > /dev/null
sudo a2enmod -q proxy proxy_http headers
sudo a2ensite -q cycleline-api cycleline-web
sudo apache2ctl configtest
sudo systemctl reload apache2

curl -fsS -H "Host: $API_HOSTNAME" http://127.0.0.1:8081/api/health
echo
curl -fsS -o /dev/null -w "web: %{http_code}\n" -H "Host: $WEB_HOSTNAME" http://127.0.0.1:8081/
