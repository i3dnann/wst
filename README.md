# Mafia

Production-oriented FiveM criminal-organization registry, tournament system, rankings platform, and administration console.

## Architecture

- `apps/web`: React 19, Vite, React Router, TanStack Query, Tailwind CSS, Motion, and shadcn/Magic UI registry components.
- `apps/api`: Fastify REST API, Prisma ORM, PostgreSQL, secure Discord OAuth boundary, RBAC, audit logging, media signing, and FiveM ingestion.
- `packages/shared`: versioned API contracts, Zod schemas, permissions, and domain types.

The frontend intentionally shows honest empty/offline states until PostgreSQL and the API are configured. Development seed data is opt-in and never runs in production.

## Local development

1. Install dependencies with `pnpm install`.
2. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`.
3. Start PostgreSQL and set `DATABASE_URL`.
4. Run `pnpm --filter @mafia/api prisma:migrate:dev`.
5. Run `pnpm dev` or `pnpm dev:web` for the frontend-only preview.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm prisma:validate
```

See `docs/deployment.md` for Netlify, VPS, Nginx, PM2, backups, HTTPS, and firewall guidance.
