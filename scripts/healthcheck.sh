#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/deploy/petsafe-backend}"
APP_NAME="${APP_NAME:-petsafe-api}"
HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-15}"
HEALTHCHECK_SLEEP_SECONDS="${HEALTHCHECK_SLEEP_SECONDS:-2}"

log() {
  printf '[healthcheck] %s\n' "$*"
}

fail() {
  printf '[healthcheck] ERROR: %s\n' "$*" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail 'curl no esta instalado.'
command -v pm2 >/dev/null 2>&1 || fail 'pm2 no esta instalado o no esta en PATH.'

cd "$APP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

LOCAL_HEALTH_URL="${LOCAL_HEALTH_URL:-http://127.0.0.1:${PORT:-3000}/api/health}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

for attempt in $(seq 1 "$HEALTHCHECK_ATTEMPTS"); do
  if response="$(curl --fail --silent --show-error "$LOCAL_HEALTH_URL")"; then
    log "Health local OK: $response"
    break
  fi

  if [ "$attempt" -eq "$HEALTHCHECK_ATTEMPTS" ]; then
    fail "La app no respondio correctamente en $LOCAL_HEALTH_URL."
  fi

  sleep "$HEALTHCHECK_SLEEP_SECONDS"
done

pm2 describe "$APP_NAME" >/dev/null 2>&1 || fail "El proceso PM2 '$APP_NAME' no existe."
log "PM2 reporta el proceso '$APP_NAME'."

if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1 \
    || fail "PostgreSQL no responde en ${DB_HOST}:${DB_PORT}."
  log "PostgreSQL responde en ${DB_HOST}:${DB_PORT}."
fi

if [ -n "$PUBLIC_HEALTH_URL" ]; then
  curl --fail --silent --show-error "$PUBLIC_HEALTH_URL" >/dev/null \
    || fail "El health publico fallo en $PUBLIC_HEALTH_URL."
  log "Health publico OK en $PUBLIC_HEALTH_URL."
fi
