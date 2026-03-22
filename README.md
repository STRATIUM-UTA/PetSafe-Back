# PetSafe — Backend (Veterinaria)

Backend para el sistema PetSafe (veterinaria), desarrollado con **NestJS**, **TypeORM** y **PostgreSQL**.

## Requisitos

- Node.js (recomendado: LTS)
- npm
- PostgreSQL (local) o Docker

## Configuración rápida (PostgreSQL con Docker)

1) Levanta la base de datos:

`docker compose up -d`

El compose está en [docker-compose.yml](docker-compose.yml).

2) Configura variables de entorno:

Revisa [\.example.env](.example.env) y crea/ajusta [\.env](.env).

Variables usadas:

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

3) Instala dependencias:

`npm install`

4) Corre migraciones (incluye seed de usuarios):

`npm run migration:run`

5) Inicia el API:

`npm run start:dev`

Por defecto:

- API: `http://localhost:3000/api`

## Usuarios seed (migraciones)

La migración [src/migrations/1742518800011-SeedUsers.ts](src/migrations/1742518800011-SeedUsers.ts) crea:

- **ADMIN**: `admin@safepet.com` / `Admin123!`
- **CLIENTE_APP**: `cliente@safepet.com` / `Cliente123!`

## Endpoints principales

### Auth

- `POST /api/auth/register` (crea un cliente + usuario + rol CLIENTE_APP)
- `POST /api/auth/login`
- `GET /api/auth/profile` (JWT)

### Autogestión (CLIENTE_APP)

- `GET /api/me/profile` (JWT + role CLIENTE_APP)
- `PATCH /api/me/update` (JWT + role CLIENTE_APP)

### Clientes

- `GET /api/clientes?page=1&limit=10&nombres=&cedula=&correo=&mascotaNombre=`
	- Soporta paginación + filtros (búsqueda parcial con `ILIKE`)
	- **Ownership**: si el token no es de rol administrativo, solo devuelve “mi cliente”
- `POST /api/clientes` (ADMIN/RECEPCIONISTA)
- `GET /api/clientes/:id` (ADMIN/MVZ/RECEPCIONISTA/CLIENTE_APP; CLIENTE_APP solo su propio `id`)
- `PATCH /api/clientes/:id` (ADMIN/RECEPCIONISTA)
- `DELETE /api/clientes/:id` (ADMIN/RECEPCIONISTA)

### Pacientes

- `POST /api/pacientes` (CLIENTE_APP/ADMIN/RECEPCIONISTA)
- `GET /api/pacientes` (CLIENTE_APP/ADMIN/MVZ/RECEPCIONISTA)
- `GET /api/pacientes/:id` (CLIENTE_APP/ADMIN/MVZ/RECEPCIONISTA)

## Colección Postman

Se incluye una colección lista para importar en Postman:

- [test/petsafe.postman_collection.json](test/petsafe.postman_collection.json)

Incluye login seed (admin/cliente), endpoints protegidos por JWT y ejemplos de paginación/filtros/ownership.

## Tests (e2e)

Ejecuta:

`npm run test:e2e`

Nota: el proyecto usa ESM y los tests e2e corren con `node --experimental-vm-modules`.
