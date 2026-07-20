# World Star Registry

Production-oriented community registry, flexible tournament system, event calendar, approved live-stream hub, rankings platform, and private administrator command center.

The command center provides complete gang, player, tournament, match, event, stream, and administrator management. It includes profile imagery, searchable record tables, edit drawers, safe archive/delete confirmations, automatic Twitch/YouTube/Kick stream checks, working embedded previews, database audit history, and optional Discord webhook logs.

The visual system uses the supplied World Star imagery and main PNG mark in a cinematic black, walnut, antique-gold, and warm-amber design. Tournament brackets support administrator-managed entrant capacities from small custom fields through 16- and 32-gang competitions, including automatic byes and winner progression.

## Architecture

- `apps/web`: React 19, Vite, React Router, TanStack Query, Tailwind CSS, Motion, shadcn and Magic UI components.
- `apps/api`: Fastify REST API, Prisma ORM, MySQL/MariaDB, private email/password authentication, RBAC, audit logging and signed media uploads.
- `packages/shared`: API contracts, Zod schemas, permissions and domain types.

Only authenticated administrators can create or update published information. The public frontend shows honest empty/offline states until MySQL/MariaDB and the API are configured. HeidiSQL can be used to create, inspect, and back up the database.

For a one-file database setup, import `database/DATABASE_SCHEMA.sql` in HeidiSQL. It creates the `worldstar_wst` database and all 27 required tables.

## Local development

1. Install dependencies with `pnpm install`.
2. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`.
3. Start MySQL 8+ or MariaDB, import `database/DATABASE_SCHEMA.sql` in HeidiSQL, and set `DATABASE_URL` using the `mysql://` format.
4. Set a strong `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run `pnpm --filter @mafia/api prisma:migrate:dev` and `pnpm --filter @mafia/api prisma:seed`.
5. Run `pnpm dev`, or `pnpm dev:web` for the frontend-only preview.

The administrator login is `/admin/login`. Passwords are stored as salted scrypt hashes; access sessions are short-lived, refresh tokens rotate, and every privileged change is permission-checked and audited.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm prisma:validate
```

See `docs/deployment.md` for Netlify, a Windows VPS, HeidiSQL, IIS, NSSM, backups, HTTPS and firewall guidance.
