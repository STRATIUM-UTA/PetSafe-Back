#!/usr/bin/env bash

# Este rollback.sh revierte el backend a una versión Git anterior, reinstala y recompila esa versión, la vuelve a levantar con PM2, valida que funcione y actualiza el estado interno del sistema, pero sin deshacer migraciones de base de datos.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/deploy/petsafe-backend}"
APP_NAME="${APP_NAME:-petsafe-api}"
STATE_DIR="${STATE_DIR:-$APP_DIR/.deploy}"
CURRENT_SUCCESS_FILE="$STATE_DIR/current_successful"
PREVIOUS_SUCCESS_FILE="$STATE_DIR/previous_successful"
ROLLBACK_REF="${ROLLBACK_REF:-${1:-}}"

log() {
  printf '[rollback] %s\n' "$*"
}

fail() {
  printf '[rollback] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Falta el comando requerido: $1"
}

load_nvm() {
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  local nvm_script="$nvm_dir/nvm.sh"

  if [ -s "$nvm_script" ]; then
    # shellcheck disable=SC1090
    . "$nvm_script"
    nvm use default >/dev/null 2>&1 || nvm use >/dev/null 2>&1 || true
  fi
}

if [ "$(id -un)" = 'root' ]; then
  fail 'Ejecuta este script como el usuario deploy, no como root.'
fi

load_nvm

require_command git
require_command node
require_command npm
require_command pm2

[ -d "$APP_DIR/.git" ] || fail "No existe un checkout git en $APP_DIR"
[ -f "$APP_DIR/.env" ] || fail "Falta el archivo $APP_DIR/.env"

cd "$APP_DIR"

CURRENT_SHA="$(git rev-parse HEAD)"
LAST_SUCCESSFUL_REF=''

if [ -f "$CURRENT_SUCCESS_FILE" ]; then
  LAST_SUCCESSFUL_REF="$(tr -d '[:space:]' < "$CURRENT_SUCCESS_FILE")"
fi

if [ -z "$ROLLBACK_REF" ]; then
  if [ -n "$LAST_SUCCESSFUL_REF" ] && [ "$CURRENT_SHA" != "$LAST_SUCCESSFUL_REF" ]; then
    ROLLBACK_REF="$LAST_SUCCESSFUL_REF"
  elif [ -f "$PREVIOUS_SUCCESS_FILE" ]; then
    ROLLBACK_REF="$(tr -d '[:space:]' < "$PREVIOUS_SUCCESS_FILE")"
  else
    fail 'No hay rollback previo registrado. Pasa un commit o tag manualmente.'
  fi
fi

log "Volviendo a la ref $ROLLBACK_REF"
git fetch --prune origin
git checkout --force "$ROLLBACK_REF"

log 'Instalando dependencias'
npm ci

log 'Compilando el backend NestJS'
npm run build

log "Recargando PM2 para la app '$APP_NAME'"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

log 'Corriendo validaciones post-rollback'
APP_DIR="$APP_DIR" APP_NAME="$APP_NAME" ./scripts/healthcheck.sh

mkdir -p "$STATE_DIR"
printf '%s\n' "$CURRENT_SHA" > "$PREVIOUS_SUCCESS_FILE"
printf '%s\n' "$ROLLBACK_REF" > "$CURRENT_SUCCESS_FILE"

log "Rollback completado hacia $ROLLBACK_REF"
log 'Nota: este rollback no revierte migraciones; usa solo migraciones backward-compatible.'
