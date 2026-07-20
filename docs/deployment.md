# Deployment guide

## Frontend on Netlify

1. Connect this repository and use the root directory.
2. Build command: `pnpm --filter @mafia/web build`.
3. Publish directory: `apps/web/dist`.
4. Set `VITE_API_BASE_URL=https://api.example.com` and `VITE_APP_NAME=Mafia`.
5. Do not add Discord, database, session, FiveM, or object-storage secrets to Netlify.

`netlify.toml` includes the SPA fallback so nested routes refresh to `index.html`, plus immutable asset caching and baseline response headers. API requests always target the VPS URL from `VITE_API_BASE_URL`.

## API on a VPS

Recommended baseline: Ubuntu LTS, Node 22+, PostgreSQL 16+, Nginx, Certbot, and PM2.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @mafia/api prisma:generate
pnpm --filter @mafia/api prisma:migrate:deploy
pnpm --filter @mafia/api build
cd apps/api
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Place the production environment file outside the Git checkout (for example `/etc/mafia/api.env`) with owner-only permissions, then inject it through the service manager. Never commit it.

Required production values include `DATABASE_URL`, the actual `FRONTEND_URL` and strict comma-separated `CORS_ALLOWED_ORIGINS`, a 32+ byte `SESSION_SECRET`, Discord OAuth credentials, S3-compatible storage credentials, and a separate 32+ byte `FIVEM_INTEGRATION_SECRET`.

## Nginx and HTTPS

Copy `deploy/nginx/mafia-api.conf` to `/etc/nginx/sites-available/mafia-api`, replace `api.example.com`, enable it, run `nginx -t`, reload Nginx, and issue a certificate with Certbot. Keep Fastify bound to the private loopback or firewall-protected application port. Never expose PostgreSQL or object-storage administrative ports publicly.

Firewall allowlist:

- 22/tcp only from trusted administrative IPs.
- 80/tcp and 443/tcp publicly.
- Deny 4000/tcp and 5432/tcp publicly.

## Health, restarts, logs, and backups

- Liveness: `/health/live`.
- Readiness: `/health/ready` (checks the database without leaking details).
- PM2 uses two cluster workers, exponential restart delay, and a 512 MB memory ceiling.
- Configure `pm2-logrotate`; forward structured logs to a durable collector and redact secrets.
- Run encrypted daily PostgreSQL backups, retain a tested off-host copy, and perform quarterly restore drills.
- Monitor HTTP error rate, readiness, database saturation, object-storage failures, Discord OAuth failures, sync-event failures, and queue age.

## Release checklist

1. Run `pnpm install --frozen-lockfile`.
2. Run type checking, linting, tests, builds, and `prisma validate`.
3. Review migrations and take a database backup.
4. Run `prisma migrate deploy` before switching traffic.
5. Verify strict CORS against the exact Netlify origin.
6. Verify Discord redirect URI, secure cookies, CSRF enforcement, media upload signing, and FiveM HMAC timestamps.
7. Smoke-test nested frontend routes, `/health/live`, `/health/ready`, authentication, an authorized gang-scoped request, and an unauthorized cross-gang request.
8. Roll back application code with the previous immutable artifact; use forward database migrations rather than destructive down migrations.
