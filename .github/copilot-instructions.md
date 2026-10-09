# ClaimSight – Project Instructions

ClaimSight is a full stack insurance policy and claims portal with an AI policy assistant. All data is fictional.

## Stack

- Frontend: React 18, TypeScript, Vite, React Router, TanStack Query, React Hook Form + Zod, Tailwind CSS, Recharts
- Backend: Node.js, Express, TypeScript, PostgreSQL, Prisma, JWT, bcrypt, Zod
- AI: LLM API (provider configured by env vars), pgvector, FastAPI (Python) service
- Quality: Vitest, React Testing Library, Supertest, ESLint, Prettier
- DevOps: Docker, docker-compose, GitHub Actions

## Structure

- /client: React app
- /server: Express API (routes, controllers, services, middleware, validators)
- /ai-service: FastAPI RAG service (added later)
- Root: docker-compose.yml, README.md, .github/workflows

## Rules

- Use TypeScript strict mode. No `any` unless justified in a comment.
- Roles: CUSTOMER and ADMIN. Customers may only access their own data. Always filter queries by the authenticated user.
- Validate all request bodies with Zod. Use a central error handler with consistent JSON errors.
- Never commit secrets. Use .env files and provide .env.example.
- Never expose LLM API keys to the frontend.
- Keep components small, typed, and reusable. Handle loading, empty, and error states.
- Make the UI responsive and accessible (labels, keyboard navigation, focus states).
- Write clear commit-sized changes. Add short comments only where logic is non-obvious.
- Do not add libraries that are not in this list without telling me why.
- After each task, summarize what you changed and how to run/test it.
