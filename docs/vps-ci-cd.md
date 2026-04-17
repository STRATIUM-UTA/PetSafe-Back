# CI/CD recomendado para tu VPS Ubuntu

Esta propuesta esta pensada para tu estado actual real:

- `Nginx` sigue como reverse proxy publico.
- `PostgreSQL` sigue local en el VPS y queda fuera del pipeline salvo chequeos.
- La app NestJS vive en `/home/deploy/petsafe-backend`.
- El usuario operativo del backend es `deploy`.
- `PM2` corre bajo `deploy`, no bajo `root`.
- `root` queda solo para tareas criticas del sistema.

## Recomendacion principal

Para tu caso **si conviene seguir con PM2**, pero corrigiendo la operacion:

- ya lo estas usando hoy
- te simplifica `reload`, logs y restauracion tras reinicio
- encaja bien en un VPS pequeno
- no necesitas meter Docker, Kubernetes ni un systemd puro todavia

Mi recomendacion es:

1. dejar `PM2` como supervisor del proceso Node
2. ejecutar `PM2` solo bajo el usuario `deploy`
3. registrar `PM2` en `systemd` para que sobreviva reinicios
4. usar GitHub Actions para validar y luego disparar deploy por `SSH`

## Estructura recomendada

```text
/home/deploy/petsafe-backend
|-- .env
|-- ecosystem.config.cjs
|-- scripts/
|-- src/
|-- dist/
|-- package.json
`-- .deploy/
    |-- current_successful
    `-- previous_successful
```

## Flujo recomendado de CI/CD

### CI

El workflow [ci.yml](../.github/workflows/ci.yml) hace esto:

1. instala dependencias con cache de npm
2. levanta PostgreSQL 16 como servicio de GitHub Actions
3. compila el backend
4. corre migraciones
5. ejecuta `test:e2e`

No agregue lint como gate porque **hoy el repo ya tiene muchos errores previos de lint** y eso te dejaria el pipeline rojo por deuda existente, no por el deploy.

### CD

El workflow [deploy-production.yml](../.github/workflows/deploy-production.yml) hace esto:

1. vuelve a validar build + migraciones + e2e
2. abre una sesion SSH al VPS
3. ejecuta [scripts/deploy.sh](../scripts/deploy.sh) como `deploy`
4. corre validaciones post-deploy

## One-time setup del servidor

### 1. Propiedad correcta del codigo

Ejecuta esto una sola vez como `adminops`:

```bash
sudo mkdir -p /home/deploy/petsafe-backend
sudo chown -R deploy:deploy /home/deploy/petsafe-backend
sudo chmod 750 /home/deploy
sudo chmod -R u+rwX,go-rwx /home/deploy/petsafe-backend
```

### 2. Instalar Node y PM2 para `deploy`

Hazlo como `deploy`, no como `root`:

```bash
su - deploy
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 22.22.0
nvm alias default 22.22.0
npm install -g pm2
```

### 3. Clonar repo y crear `.env`

```bash
git clone git@github.com:DavidJosueP2/PetSafe-Back.git /home/deploy/petsafe-backend
cp /home/deploy/petsafe-backend/.example.env /home/deploy/petsafe-backend/.env
```

Para este VPS, deja al menos:

```dotenv
PORT=3000
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=pet_app
DB_PASSWORD=tu_password_app
DB_PROD_USERNAME=pet_migrations
DB_PROD_PASSWORD=tu_password_migrations
```

Eso ataca justo el problema real que ya viste: el backend no debe intentar salir a un puerto raro como `55423` si PostgreSQL esta local y escuchando en `5432`.

Si defines `DB_PROD_USERNAME` y `DB_PROD_PASSWORD`, `npm run migration:run` usara esas credenciales dedicadas. La app NestJS seguira usando `DB_USERNAME` y `DB_PASSWORD`, lo que te permite separar permisos entre runtime y migraciones.

### 4. Desactivar PM2 levantado por `root`

Hazlo como `adminops` o con sudo:

```bash
sudo systemctl disable --now pm2-root || true
sudo rm -f /etc/systemd/system/pm2-root.service
sudo systemctl daemon-reload
```

No necesitas borrar inmediatamente `/root/.pm2/dump.pm2`; basta con dejar de usarlo. Puedes limpiarlo despues de validar que `deploy` ya restaura bien la app.

### 5. Registrar PM2 en systemd bajo `deploy`

Como `deploy`:

```bash
su - deploy
cd /home/deploy/petsafe-backend
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 startup systemd -u deploy --hp /home/deploy
```

Ese comando te devolvera una linea parecida a esta:

```bash
sudo env PATH=$PATH:/home/deploy/.nvm/versions/node/v22.22.2/bin \
/home/deploy/.nvm/versions/node/v22.22.2/lib/node_modules/pm2/bin/pm2 \
startup systemd -u deploy --hp /home/deploy
```

Ejecuta **exactamente esa linea** con sudo. Luego vuelve como `deploy` y guarda el estado:

```bash
pm2 save
```

Con eso, al reiniciar el VPS, `pm2-deploy.service` restaurara `petsafe-api` usando el Node instalado en `/home/deploy/.nvm`.

## Scripts incluidos

### Deploy

[scripts/deploy.sh](../scripts/deploy.sh)

Hace, en este orden:

1. valida que lo corre `deploy` y no `root`
2. hace `git fetch --prune origin`
3. hace checkout de la ref a desplegar
4. ejecuta `npm ci`
5. compila con `npm run build`
6. corre `npm run migration:run`
7. hace `pm2 startOrReload ecosystem.config.cjs --update-env`
8. ejecuta health checks
9. guarda la ultima release exitosa para rollback

### Health checks

[scripts/healthcheck.sh](../scripts/healthcheck.sh)

Valida:

- `GET http://127.0.0.1:3000/api/health`
- que el proceso `petsafe-api` exista en `PM2`
- `pg_isready` contra `DB_HOST` y `DB_PORT`
- opcionalmente un `PUBLIC_HEALTH_URL` si luego quieres validar el endpoint publico via Nginx

El endpoint `/api/health` se agrego al backend y comprueba tambien la base de datos con `SELECT 1`. Eso ayuda a detectar el mismo tipo de fallo que ya te genero el `502`.

### Rollback

[scripts/rollback.sh](../scripts/rollback.sh)

Rollback basico y realista:

- si el deploy actual fallo, vuelve por defecto a la ultima release exitosa registrada
- si ya estabas en una release sana, vuelve a la release exitosa anterior
- reinstala dependencias
- recompila
- recarga PM2
- vuelve a validar health

Importante: **no revierte migraciones automaticamente**. En un backend NestJS + PostgreSQL sobre VPS, eso es lo mas seguro. La regla practica es que las migraciones de produccion deben ser backward-compatible para que un rollback de codigo siga siendo viable.

## Secrets de GitHub Actions

Configura estos secrets:

- `VPS_HOST`: IP o hostname del VPS
- `VPS_PORT`: normalmente `22`
- `VPS_USER`: `deploy`
- `VPS_SSH_KEY`: clave privada del usuario que entra por SSH al VPS
- `VPS_KNOWN_HOSTS`: salida exacta de `ssh-keyscan -H tu-servidor`

Recomendacion de seguridad:

- usa el environment `production` en GitHub
- protege ese environment con aprobacion manual
- no guardes `.env` en GitHub Actions si el servidor ya lo tiene localmente

## Pull del repo en el servidor

Tu deploy por SSH usa el checkout existente dentro de `/home/deploy/petsafe-backend`.

Eso implica que el usuario `deploy` debe tener acceso de solo lectura al repo:

- via deploy key en GitHub
- o via una clave SSH dedicada de maquina

No uses la cuenta `root` para hacer `git pull`, ni para ejecutar `npm`, ni para manejar `PM2`.

## Validaciones post-deploy

Despues de cada deploy valida como minimo:

```bash
sudo -iu deploy
cd /home/deploy/petsafe-backend
./scripts/healthcheck.sh
pm2 status
pm2 logs petsafe-api --lines 100
```

Y para revisar el origen de un `502`, recuerda este orden:

1. `curl http://127.0.0.1:3000/api/health`
2. `pm2 logs petsafe-api --lines 100`
3. `systemctl status postgresql`
4. `journalctl -u postgresql -n 100 --no-pager`
5. luego `systemctl status nginx`

## PostgreSQL y el problema real que ya tuviste

Como ya detectaste:

- la linea `host all all 100.64.0.0/10 scram-sha-256` va en `pg_hba.conf`
- no en `postgresql.conf`

Antes de culpar a Nginx por un `502`, valida primero que:

- PostgreSQL levante bien
- el `.env` apunte a `127.0.0.1:5432`
- la app responda localmente en `127.0.0.1:3000`

## Si algun dia quieres systemd puro

No lo recomiendo como primer cambio aqui, pero es valido si despues quieres menos capas.

Ventajas de systemd puro:

- una sola capa de supervision
- menos dependencia de tooling Node global

Desventajas para tu caso actual:

- pierdes el flujo que ya conoces con `pm2 reload`, `pm2 save`, `pm2 logs`
- el cambio operacional hoy no te aporta una mejora tan grande como arreglar ownership, nvm y startup bajo `deploy`

Por eso, en tu situacion actual, el orden correcto es:

1. sacar `PM2` de `root`
2. dejarlo sano bajo `deploy`
3. automatizar deploy por SSH
4. reevaluar systemd puro mas adelante si quieres simplificar aun mas

Dejo un ejemplo en [ops/systemd/petsafe-api.service.example](../ops/systemd/petsafe-api.service.example) solo como alternativa futura.
