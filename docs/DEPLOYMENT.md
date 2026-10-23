# Deploy ClaimSight

This guide deploys PostgreSQL to Neon, the API to Render, and the React single-page app to Vercel. Deployments do not seed demo accounts automatically.

## 1. Create the Neon database

1. Create a Neon account and a project in the region closest to your Render service.
2. Create or select the project's PostgreSQL database.
3. In Neon, open **Connect** and choose the database and branch for this environment.
4. Copy the **Direct connection** string and keep it private. Use the direct (non-pooled) connection for this deployment because `prisma migrate deploy` runs at server startup and relies on database session behavior.
5. Keep this connection string available for the Render `DATABASE_URL` setting and for the manual seed step below.

## 2. Deploy the API to Render

1. Create a Render **Web Service** connected to this Git repository.
2. Set **Root Directory** to `server`.
3. Choose the Node runtime and configure:

   | Setting | Value |
   | --- | --- |
   | Build Command | `npm ci --include=dev && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/health` |

   `--include=dev` installs the `@types/*` devDependencies needed by the TypeScript build even when `NODE_ENV=production`. The build command runs `prisma generate` before the TypeScript compilation. Set `DATABASE_URL` in Render before the first build because Prisma 7 reads it from `prisma.config.ts` during generation. The start command runs `prisma migrate deploy` before starting the compiled `dist/index.js` server. Migrations run automatically; demo seeding does not.

4. Add these environment variables in Render. Set `CLIENT_ORIGIN` to the exact Vercel origin (scheme and host only). Multiple allowed origins can be separated by commas.

   | Variable | Configuration |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | The Neon direct connection string |
   | `JWT_SECRET` | A strong, unique, randomly generated secret |
   | `JWT_EXPIRES_IN` | Optional token lifetime; defaults to `1h` |
   | `CLIENT_ORIGIN` | The Vercel site origin; comma-separated if needed |
   | `PORT` | Render supplies this automatically |

   Production startup fails with a clear error if `DATABASE_URL`, `JWT_SECRET`, or `CLIENT_ORIGIN` is missing.

5. Create the service and wait for the first deploy. Check the Render logs for a successful migration and the `/health` check. A healthy response includes `"status":"ok"` and `"database":"connected"`.

## 3. Add fictional demo data manually

Run the seed from your laptop after the Render service has applied migrations. The seed is a manual action and must never be added to the production start or build commands.

1. In `server/.env` on your laptop, set `DATABASE_URL` to the Neon connection string for the target database. This file is ignored by Git; do not paste the URL into tracked files.
2. From the repository root, run:

   ```sh
   cd server
   npm ci
   npm run prisma:seed
   ```

3. Confirm the seed command completes before using the demo accounts. Repeat only when intentionally resetting/repopulating demo data.

The seeded login accounts are listed in the root [README](../README.md). Never seed production databases that contain real customer data.

## 4. Deploy the client to Vercel

1. Import this Git repository as a Vercel project.
2. Set **Root Directory** to `client`.
3. Use the Vite build defaults (`npm run build` and output directory `dist`).
4. Add the client environment variable:

   | Variable | Value |
   | --- | --- |
   | `VITE_API_URL` | The base URL of the Render service, without an `/api` suffix |

5. Deploy the project. The checked-in `client/vercel.json` rewrites frontend routes to `index.html` so direct links and page refreshes work with React Router.
6. If the Vercel URL differs from the origin configured on Render, update Render's `CLIENT_ORIGIN` to the deployed origin and redeploy/restart the Render service.
7. If you change `VITE_API_URL`, trigger a new Vercel deployment; Vite embeds this value during the build.

## 5. Post-deploy checklist

- [ ] Render deployment finishes and its health check passes at `/health`.
- [ ] `/health` reports both the API and database as available.
- [ ] Render `CLIENT_ORIGIN` exactly matches the deployed Vercel origin.
- [ ] Vercel routes such as `/login` and `/claims` load directly and survive refresh.
- [ ] Customer and admin demo logins work after manually seeding Neon.
- [ ] Customer views are limited to the signed-in customer's records.
- [ ] Admin claims, status updates, comments, and dashboard charts load.
- [ ] Document downloads work while their files remain on the Render instance.
- [ ] No production credentials or database URLs are present in the repository.
- [ ] Remember that Render free-tier services may sleep and local-disk uploads are not persistent.
