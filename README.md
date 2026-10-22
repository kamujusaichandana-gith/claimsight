# ClaimSight

ClaimSight is a full-stack insurance policy and claims portal. This repository contains a React client, an Express API, and a PostgreSQL database with the pgvector extension image.

## Requirements

- Node.js 20.19+ and npm
- Docker with Docker Compose (for the containerized setup)

## Run with Docker

Create the Compose environment file and set unique local secrets:

```sh
cp .env.example .env
```

Edit `.env` and replace `POSTGRES_PASSWORD` and `JWT_SECRET` with locally generated values. Use a URL-safe value for `POSTGRES_PASSWORD` (for example, generate one with `openssl rand -hex 32`) because it is part of the API's PostgreSQL connection URL. Then build and start the database, API, and client:

```sh
docker compose up --build
```

If you already have a `postgres_data` volume from an earlier setup, `POSTGRES_PASSWORD` must match the password used when that database was first initialized; changing the Compose environment does not rotate the stored database password.

Compose waits for PostgreSQL to become healthy and runs `prisma migrate deploy` before starting the API. The app is available at http://localhost:8080 and the API health check at http://localhost:3000/health. PostgreSQL data and uploaded claim documents persist in the named `postgres_data` and `uploads_data` volumes.

Demo data is **not** loaded automatically. After the services are running, seed the fictional demo accounts and data separately:

```sh
docker compose exec server npm run prisma:seed
```

Stop the services with `docker compose down`. To also remove persisted database and upload data, run `docker compose down --volumes`.

## Run locally without Docker

Install Node.js 20.19+ and a local PostgreSQL instance with the `pgvector` extension. From the repository root, install dependencies in each app:

```sh
cd server && npm ci
cd ../client && npm ci
```

Configure `server/.env` (see `server/.env.example`) with the local PostgreSQL connection string and a strong `JWT_SECRET`. Configure `client/.env` as needed (see `client/.env.example`); its default API URL is `http://localhost:3000`. Create the schema and optionally load the fictional demo data:

```sh
cd server
npm run prisma:migrate -- --name init
npm run prisma:seed
```

Run the API and client in separate terminals:

```sh
cd server && npm run dev
```

```sh
cd client && npm run dev
```

The local client is available at http://localhost:5173 and the API health check at http://localhost:3000/health.

## Demo logins

These fictional accounts are available after seeding:

- Admin: `admin@claimsight.local` / `AdminDemo123!`
- Customers: `avery.brooks@example.test`, `jordan.patel@example.test`, or `riley.thompson@example.test` / `CustomerDemo123!`

Do not use these credentials outside local development.
