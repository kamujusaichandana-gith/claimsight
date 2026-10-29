# ClaimSight

ClaimSight is a full-stack insurance policy and claims portal where fictional customers can review coverage, file and track claims, and share supporting documents while administrators review claims, update statuses, and communicate with customers.

## Live demo

[Open the live ClaimSight demo](https://claimsight-vert.vercel.app)

The API runs on a free tier and sleeps when idle, so the first load can take up to a minute. Use the "Try as customer" or "Try as admin" buttons on the login page.

### Demo logins

| Role     | Email                       | Password           |
| -------- | --------------------------- | ------------------ |
| Customer | `avery.brooks@example.test` | `CustomerDemo123!` |
| Admin    | `admin@claimsight.local`    | `AdminDemo123!`    |

All records and people in the demo are fictional. These credentials are public demo accounts; do not use them for real or sensitive information.

## Features

- Customer registration and sign-in with role-based access.
- Customer dashboards for policies and claims.
- Claim submission with PDF, JPG, or PNG supporting documents.
- Claim status timeline and claim comments.
- Admin dashboard charts, claim search and filters, status updates, and comments.
- Admin Gemini claim summaries with a suggested category and urgency, Zod-validated structured output, caching, per-admin rate limiting, and a daily cap; labeled AI-generated for human review.
- Authenticated document downloads with a clear response when a file is no longer on disk.
- Customer policy assistant using RAG with pgvector, Gemini embeddings, cosine-similarity retrieval filtered by policy type, streamed answers, cited sources, a "not enough information" fallback, and conversation history.
- Responsive React interface with loading, empty, and error states.

## Tech stack

- **Client:** React 18, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, Recharts.
- **Server:** Node.js, Express, TypeScript, Prisma 7, PostgreSQL, JWT, bcrypt, Zod.
- **AI:** Google Gemini API for generation and embeddings, pgvector, and Server-Sent Events (SSE).
- **Hosting:** Vercel (client), Render (server), and Neon (managed PostgreSQL).
- **Local containers:** Docker Compose and PostgreSQL with pgvector.

## Architecture

```mermaid
flowchart LR
    Browser[Browser] -->|HTTPS| Vercel[Vercel: React SPA]
    Vercel -->|JSON API, JWT| Render[Render: Express API]
    Render -->|Prisma / PostgreSQL| Neon[Neon: PostgreSQL + pgvector]
    Render -->|Gemini generation and embeddings| Gemini[Google Gemini API]
    Render -->|Assistant response stream: SSE| Browser
    Render -->|Temporary local disk| Uploads[Claim document uploads]
```

## Run locally

Requirements: Node.js 20.19+ and npm. For Docker, also install Docker with Compose.

### With Docker

1. Copy the root environment example and set unique local values:

   ```sh
   cp .env.example .env
   ```

   Use a URL-safe `POSTGRES_PASSWORD`, because Compose includes it in the API's PostgreSQL connection string.

   AI settings are optional. To enable AI, add the LLM, embedding, RAG, and assistant variables from `server/.env.example` to the root `.env`, including `LLM_ENABLED=true` and an `LLM_API_KEY` from Google AI Studio (which offers a free tier). `docker-compose.yml` loads the root `.env` into the server container, so variables present there are passed through; the root `.env.example` does not include these AI variables by default. With `LLM_ENABLED=false`, the rest of the app still works, but AI endpoints are unavailable.

2. Start the database, API, and client:

   ```sh
   docker compose up --build
   ```

   The server container applies the existing Prisma migrations at startup. They enable the PostgreSQL `vector` extension used by pgvector.

3. To populate the policy knowledge base, run ingestion on the host against the database exposed by Compose. Copy `server/.env.example` to `server/.env` and configure its `DATABASE_URL` to reach that database, plus the required Gemini API key and embedding settings, then run:

   ```sh
   cp server/.env.example server/.env
   cd server
   npm ci
   npm run rag:ingest
   ```

   The current server image does not include the ingestion script, policy source files, or `tsx`, so this command is run on the host rather than inside the server container.

4. Open the client at `http://localhost:8080`. The API health endpoint is `http://localhost:3000/health`.

Demo data is not loaded automatically. To load it into the local database, run:

```sh
docker compose exec server npm run prisma:seed
```

Stop the services with `docker compose down`. Use `docker compose down --volumes` only when you also intend to remove the local database and upload volumes.

### Without Docker

1. Start a local PostgreSQL instance.
2. Copy the server and client environment examples, then set the database connection and local API URL:

   ```sh
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

3. Install dependencies and prepare the database:

   ```sh
   cd server
   npm ci
   npx prisma migrate deploy
   npm run prisma:seed
   npm run rag:ingest
   ```

   `prisma migrate deploy` applies the existing migrations to the fresh database; the pgvector migration enables PostgreSQL's `vector` extension. Policy ingestion uses Gemini embeddings, so configure `LLM_API_KEY` from Google AI Studio (free tier) and the embedding settings in `server/.env` first. Set `LLM_ENABLED=true` to enable the AI endpoints. The rest of the app remains usable with `LLM_ENABLED=false`.

4. In one terminal, start the API:

   ```sh
   cd server && npm run dev
   ```

5. In another terminal, start the client:

   ```sh
   cd client && npm ci && npm run dev
   ```

The client runs at `http://localhost:5173`; the API health endpoint is `http://localhost:3000/health`. The local server environment must allow the client origin with `CLIENT_ORIGIN`.

### Server API tests

The API tests use a separate PostgreSQL database and refuse to run unless
`TEST_DATABASE_URL` is set to a database whose name contains `test` and is
different from `DATABASE_URL`. The root and server environment examples use
the dedicated `claimsight_test` database on port 5433. Start it with:

```sh
docker compose up -d test-postgres
cd server
npm ci
TEST_DATABASE_URL=postgresql://claimsight_test:claimsight_test@localhost:5433/claimsight_test?schema=public npm test
```

Tests apply Prisma migrations to that database and clear its application tables
between tests. They do not call Gemini or any other external service.
`npm run test:watch` runs the same suite in watch mode.

## API overview

All application endpoints are prefixed by `/api`. Protected routes require a bearer token from login or registration.

| Method          | Endpoint                                           | Description                                                |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `POST`          | `/api/auth/register`                               | Register a customer account                                |
| `POST`          | `/api/auth/login`                                  | Sign in                                                    |
| `GET`           | `/api/auth/me`                                     | Get the signed-in user                                     |
| `GET`           | `/api/policies`                                    | List the signed-in customer's policies                     |
| `GET`           | `/api/policies/:id`                                | Get a policy owned by the signed-in customer               |
| `POST`          | `/api/assistant/ask`                               | Ask a question about an owned policy; streams the answer and citations using SSE |
| `GET`           | `/api/assistant/history?policyId=...`              | Read the signed-in customer's policy conversation          |
| `DELETE`        | `/api/assistant/history?policyId=...`              | Clear the signed-in customer's policy conversation         |
| `GET`, `POST`   | `/api/claims`                                      | List claims or submit a claim                              |
| `GET`           | `/api/claims/:id`                                  | Get a claim owned by the signed-in customer                |
| `POST`          | `/api/claims/:id/documents`                        | Upload a claim document                                    |
| `GET`           | `/api/claims/:claimId/documents/:documentId`       | Download a claim document                                  |
| `GET`           | `/api/admin/claims`                                | List and filter claims (admin)                             |
| `GET`           | `/api/admin/claims/:id`                            | Get claim details (admin)                                  |
| `GET`           | `/api/admin/claims/:id/summary`                    | Get an admin claim's AI summary, if generated (admin)      |
| `POST`          | `/api/admin/claims/:id/summary`                    | Generate or regenerate an AI claim summary (admin)         |
| `GET`           | `/api/admin/claims/:claimId/documents/:documentId` | Download a claim document (admin)                          |
| `PATCH`         | `/api/admin/claims/:id/status`                     | Update a claim status (admin)                              |
| `POST`          | `/api/admin/claims/:id/comments`                   | Add a claim comment (admin)                                |
| `GET`           | `/api/admin/stats`                                 | Get dashboard statistics (admin)                           |
| `GET`           | `/health`                                          | Check API and database availability                        |

## Environment variable reference

The names below are configured through environment files for local work and hosting-provider settings for deployment. Do not commit real credentials.

| Component      | Variable names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server         | `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`                                                                                                                                                                                                                                                                                                                                                                                                             |
| AI and RAG     | `LLM_ENABLED`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`, `LLM_DAILY_CALL_CAP`, `LLM_ADMIN_RATE_LIMIT`, `LLM_ADMIN_RATE_LIMIT_WINDOW_MS`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `RAG_TOP_K`, `RAG_MIN_SIMILARITY`, `ASSISTANT_USER_RATE_LIMIT`, `ASSISTANT_DAILY_CALL_CAP`                                                                                                                                                                                                             |
| Client         | `VITE_API_URL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Docker Compose | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `VITE_API_URL`                                                                                                                                                                                                                                                                                                                                                                                           |

## Known limitations

- Free Render services may sleep while idle. The first request after sleep can take up to a minute.
- Uploaded files are stored on the server's local disk and are not persistent on free hosting. A deployment or restart may remove files; their database records remain and downloading a missing file returns 404.
- All demo data, policies, claims, people, and credentials are fictional.
- The claim summarizer and policy assistant share one Gemini free-tier quota. Their configured per-admin/per-user rate limits and daily caps are separate.
- The demo admin account is shared, so the per-admin hourly summary limit applies collectively to all demo visitors using that account.
- Retrieval similarity finds related chunks but cannot determine whether a chunk actually answers a question. The assistant relies on the generation prompt's instructions to decline when retrieved text is insufficient; answers are based only on fictional policy documents and are not coverage decisions.

## Future improvements

- Move claim documents to durable object storage.
- Add automated deployment previews and production monitoring.
- Add automated unit, integration, and end-to-end tests, plus an evaluation set for RAG retrieval and refusal behavior.
- Expand reporting, accessibility audits, and operational dashboards.

## AI features

### Admin claim summarizer

An admin can generate a summary from a claim and its comments. Gemini returns a summary, suggested claim category, and urgency as structured JSON; the server validates the result with Zod and caches it on the claim until it is regenerated. Admin summary requests have a per-admin rate limit and a daily call cap. The interface labels the result as AI-generated and says it must be reviewed by a person.

### Policy assistant: retrieval-augmented generation

The assistant follows an ingest -> embed -> retrieve -> generate -> cite flow:

1. **Ingest:** `npm run rag:ingest` chunks the fictional policy documents and stores them in PostgreSQL.
2. **Embed:** Gemini creates document embeddings during ingestion and a query embedding for each question.
3. **Retrieve:** pgvector ranks chunks by cosine similarity, filtered to the signed-in customer's policy type.
4. **Generate:** Gemini streams an answer over Server-Sent Events using the retrieved chunks and question.
5. **Cite:** The answer includes source markers when available, and the response returns the cited document sections. If no chunks meet the configured similarity threshold, the assistant returns a fixed "not enough information" response.

Conversation history is stored per customer and policy and can be read or cleared through the assistant API.

### Safety measures

- Customer questions, claim descriptions, comments, and retrieved policy text are treated as untrusted data rather than instructions to the model.
- Assistant operations check policy ownership and return 404 when the policy is not owned by the signed-in customer.
- The assistant has a per-user hourly limit and a global daily cap; the admin summarizer has per-admin rate limiting and a global daily call cap.
- `LLM_ENABLED` disables AI endpoints when false; authentication, policy, claim, and other non-AI app features continue to work.

## Screenshots

### Customer dashboard

![Customer dashboard](docs/screenshots/customer-dashboard.png)

### Claim details

![Claim details with status timeline](docs/screenshots/claim-details.png)

### Admin dashboard

![Admin dashboard with charts](docs/screenshots/admin-dashboard.png)

### AI claim summary (admin)

![AI claim summary on the admin review page](docs/screenshots/ai-claim-summary.png)

### Policy assistant with cited sources (customer)

![Policy assistant answering a question with cited sources](docs/screenshots/policy-assistant.png)

## Deployment

For Render, use the build command `npm ci --include=dev && npm run build`; `--include=dev` installs the `@types/*` packages required by the TypeScript build when `NODE_ENV=production`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the step-by-step Neon, Render, and Vercel deployment guide, including the manual production demo-data seed procedure.
