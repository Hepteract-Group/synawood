#!/usr/bin/env bash
# Deploy Postiz stack to Fly (#1136). Requires: fly CLI, logged in, infra/postiz/.env.fly
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/infra/postiz/.env.fly"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy infra/postiz/.env.fly.example and fill values." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

ORG="${FLY_ORG:-hepteract-group}"
REGION="${FLY_REGION:-lhr}"
APP="${FLY_POSTIZ_APP:-mos-postiz}"
PG="${FLY_POSTIZ_PG:-mos-postiz-pg}"
REDIS="${FLY_POSTIZ_REDIS:-mos-postiz-redis}"
TEMPORAL="${FLY_TEMPORAL_APP:-mos-postiz-temporal}"
TEMPORAL_MPG_NAME="${FLY_TEMPORAL_MPG:-mos-postiz-temporal-pg-mpg}"
PUBLIC_URL="${POSTIZ_PUBLIC_URL:-https://${APP}.fly.dev}"

ensure_app() {
  local name="$1"
  if ! fly apps list -o "$ORG" 2>/dev/null | awk '{print $1}' | grep -qx "$name"; then
    echo "Creating Fly app: $name"
    fly apps create "$name" -o "$ORG"
  else
    echo "Fly app exists: $name"
  fi
}

echo "=== 1. Fly apps ==="
ensure_app "$TEMPORAL"
ensure_app "$APP"

echo "=== 2. Redis (Postiz, Fly container) ==="
ensure_app "$REDIS"
(cd "$ROOT/infra/postiz/fly/redis" && fly deploy -a "$REDIS" --ha=false)

echo "=== 3. Managed Postgres (Postiz app data) ==="
if ! fly mpg list -o "$ORG" 2>/dev/null | grep -q "$PG"; then
  fly mpg create -n "$PG" -r "$REGION" -o "$ORG" --plan basic --pg-major-version 17 --volume-size 10
else
  echo "MPG exists: $PG"
fi
PG_ID="$(fly mpg list -o "$ORG" 2>/dev/null | awk -v n="$PG" '$2 == n {print $1; exit}')"
if [[ -z "$PG_ID" ]]; then
  echo "Could not resolve MPG id for $PG" >&2
  exit 1
fi

echo "=== 4. Managed Postgres (Temporal metadata) ==="
if ! fly mpg list -o "$ORG" 2>/dev/null | grep -q "$TEMPORAL_MPG_NAME"; then
  fly mpg create -n "$TEMPORAL_MPG_NAME" -r "$REGION" -o "$ORG" --plan basic --pg-major-version 17 --volume-size 10
else
  echo "MPG exists: $TEMPORAL_MPG_NAME"
fi
TEMPORAL_MPG_ID="$(fly mpg list -o "$ORG" 2>/dev/null | awk -v n="$TEMPORAL_MPG_NAME" '$2 == n {print $1; exit}')"
if [[ -z "$TEMPORAL_MPG_ID" ]]; then
  echo "Could not resolve MPG id for $TEMPORAL_MPG_NAME" >&2
  exit 1
fi
# Direct host, not pgbouncer.* — Temporal's Go driver uses prepared statements.
TEMPORAL_PG_DIRECT="direct.${TEMPORAL_MPG_ID}.flympg.net"

echo "=== 5. Temporal server deploy ==="
fly mpg attach "$TEMPORAL_MPG_ID" -a "$TEMPORAL" --variable-name TEMPORAL_PG_URL || true
fly secrets set -a "$TEMPORAL" \
  POSTGRES_SEEDS="$TEMPORAL_PG_DIRECT" \
  BIND_ON_IP='::0' \
  POSTGRES_TLS_ENABLED=true \
  POSTGRES_TLS_DISABLE_HOST_VERIFICATION=true \
  ENABLE_ES=false \
  SKIP_DB_CREATE=true \
  SKIP_ADD_CUSTOM_SEARCH_ATTRIBUTES=true
(cd "$ROOT/infra/postiz/fly/temporal" && fly deploy -a "$TEMPORAL" --ha=false)

echo "=== 6. Attach MPG to Postiz app ==="
fly mpg attach "$PG_ID" -a "$APP" || true

echo "=== 7. Postiz secrets ==="
fly secrets set -a "$APP" \
  MAIN_URL="$PUBLIC_URL" \
  FRONTEND_URL="$PUBLIC_URL" \
  NEXT_PUBLIC_BACKEND_URL="${PUBLIC_URL}/api" \
  JWT_SECRET="$JWT_SECRET" \
  REDIS_URL="redis://${REDIS}.internal:6379" \
  BACKEND_INTERNAL_URL="http://localhost:3000" \
  TEMPORAL_ADDRESS="${TEMPORAL}.internal:7233" \
  IS_GENERAL=true \
  DISABLE_REGISTRATION=false \
  RUN_CRON=true \
  STORAGE_PROVIDER=cloudflare \
  CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  CLOUDFLARE_ACCESS_KEY="$CLOUDFLARE_ACCESS_KEY" \
  CLOUDFLARE_SECRET_ACCESS_KEY="$CLOUDFLARE_SECRET_ACCESS_KEY" \
  CLOUDFLARE_BUCKETNAME="$CLOUDFLARE_BUCKETNAME" \
  CLOUDFLARE_BUCKET_URL="$CLOUDFLARE_BUCKET_URL" \
  CLOUDFLARE_REGION="${CLOUDFLARE_REGION:-auto}"

echo "=== 8. Postiz app deploy ==="
(cd "$ROOT/infra/postiz/fly/postiz" && fly deploy -a "$APP" --ha=false)

echo ""
echo "Done. Next steps:"
echo "  1. Open $PUBLIC_URL — create operator user + mint Public API key"
echo "  2. Set Vercel POSTIZ_BASE_URL=${PUBLIC_URL}/api/public/v1 and POSTIZ_API_KEY"
echo "  3. curl -H \"Authorization: <key>\" ${PUBLIC_URL}/api/public/v1/integrations"
