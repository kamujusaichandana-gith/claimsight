# ClaimSight

ClaimSight is a full-stack insurance policy and claims portal. This repository contains a React client, an Express API, and a PostgreSQL database with the pgvector extension image.

## Requirements

- Node.js 20.19+ and npm
- Docker with Docker Compose

## Setup

Install both app dependencies:

```sh
cd client && npm install
cd ../server && npm install
```

Copy `client/.env.example` to `client/.env` and `server/.env.example` to `server/.env` if you need to customize local settings. The defaults work for local development. Start PostgreSQL:

```sh
docker compose up -d
```

Create the database tables and load fictional demo data from the repository root:

```sh
cd server && npm run prisma:migrate -- --name init
npm run prisma:seed
```

Demo logins (local development only):

- Admin: `admin@claimsight.local` / `AdminDemo123!`
- Customers: `avery.brooks@example.test`, `jordan.patel@example.test`, or `riley.thompson@example.test` / `CustomerDemo123!`

The seed can be rerun safely; it upserts its demo users, policies, and claims. Do not use these credentials outside local development.

Start the API and frontend in separate terminals from the repository root:

```sh
cd server && npm run dev
```

```sh
cd client && npm run dev
```

The frontend is available at http://localhost:5173 and the API health check at http://localhost:3000/health. Stop PostgreSQL with `docker compose down`; its data remains in the named `postgres_data` volume.

## Checks

Run `npm run build`, `npm run lint`, or `npm test` from either `client` or `server`. Tests are placeholders until test suites are added.
