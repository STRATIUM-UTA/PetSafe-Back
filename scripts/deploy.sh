#!/usr/bin/env bash

# valida entorno y comandos,
# verifica que existe el repo y el .env,
# lee el último commit exitoso,
# hace git fetch,
# cambia al commit/rama a desplegar,
# instala dependencias con npm ci,
# compila el backend,
# ejecuta migraciones,
# recarga PM2,
# corre un healthcheck,
# guarda el commit exitoso actual y el anterior.

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/deploy/petsafe-backend}"
APP_NAME="${APP_NAME:-petsafe-api}"
BRANCH="${BRANCH:-main}"
DEPLOY_REF="${DEPLOY_REF:-}"
STATE_DIR="${STATE_DIR:-$APP_DIR/.deploy}"
CURRENT_SUCCESS_FILE="$STATE_DIR/current_successful"
PREVIOUS_SUCCESS_FILE="$STATE_DIR/previous_successful"

log() {
  printf '[deploy] %s\n' "$*"
}

fail() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
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

mkdir -p "$STATE_DIR"
cd "$APP_DIR"

CURRENT_SHA="$(git rev-parse HEAD)"
LAST_SUCCESSFUL_SHA="$CURRENT_SHA"

if [ -f "$CURRENT_SUCCESS_FILE" ]; then
  LAST_SUCCESSFUL_SHA="$(tr -d '[:space:]' < "$CURRENT_SUCCESS_FILE")"
fi

log 'Actualizando referencias del repositorio'
git fetch --prune origin

if [ -n "$DEPLOY_REF" ]; then
  log "Desplegando ref exacta: $DEPLOY_REF"
  git checkout --force "$DEPLOY_REF"
else
  log "Desplegando la rama origin/$BRANCH"
  git checkout --force -B "$BRANCH" "origin/$BRANCH"
fi

TARGET_SHA="$(git rev-parse HEAD)"

log 'Instalando dependencias'
npm ci

log 'Compilando el backend NestJS'
npm run build

log 'Ejecutando migraciones de base de datos'
npm run migration:run

log "Recargando PM2 para la app '$APP_NAME'"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

log 'Corriendo validaciones post-deploy'
APP_DIR="$APP_DIR" APP_NAME="$APP_NAME" ./scripts/healthcheck.sh

printf '%s\n' "$LAST_SUCCESSFUL_SHA" > "$PREVIOUS_SUCCESS_FILE"
printf '%s\n' "$TARGET_SHA" > "$CURRENT_SUCCESS_FILE"

log "Deploy finalizado correctamente en $TARGET_SHA"
