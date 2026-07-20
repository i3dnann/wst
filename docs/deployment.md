# Deployment guide

## Frontend on Netlify

1. Connect this repository and use the repository root.
2. Build command: `pnpm --filter @mafia/web build`.
3. Publish directory: `apps/web/dist`.
4. Set `VITE_API_BASE_URL=https://api.example.com` and `VITE_APP_NAME=World Star`.
5. Keep database, session, administrator and object-storage credentials off Netlify.

`netlify.toml` includes the SPA fallback, immutable asset caching and baseline response headers. API requests target the VPS URL configured by `VITE_API_BASE_URL`.

## API on a VPS

Recommended baseline: Ubuntu LTS, Node 22+, PostgreSQL 16+, Nginx, Certbot and PM2.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @mafia/api prisma:generate
pnpm --filter @mafia/api prisma:migrate:deploy
ADMIN_EMAIL=admin@your-domain.tld ADMIN_PASSWORD='a-long-random-password' pnpm --filter @mafia/api prisma:seed
pnpm --filter @mafia/api build
cd apps/api
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Place production environment values outside the Git checkout with owner-only permissions and inject them through the service manager. Required values include `DATABASE_URL`, the real `FRONTEND_URL`, strict `CORS_ALLOWED_ORIGINS`, a 32+ byte `SESSION_SECRET`, the bootstrap administrator credentials and any S3-compatible storage credentials.

## Nginx and HTTPS

Install `deploy/nginx/worldstar-api.conf`, replace `api.example.com`, run `nginx -t`, reload Nginx and issue a certificate with Certbot. Keep Fastify and PostgreSQL on private ports.

- Allow 22/tcp only from trusted administrative IPs.
- Allow 80/tcp and 443/tcp publicly.
- Deny 4000/tcp and 5432/tcp publicly.

## Operations and release checklist

- Liveness: `/health/live`; readiness: `/health/ready`.
- Rotate logs, monitor HTTP/database/object-storage failures and run encrypted off-host PostgreSQL backups.
- Run formatting, type checking, linting, tests, builds and Prisma validation before release.
- Review migrations and take a database backup before `prisma migrate deploy`.
- Verify strict CORS, secure cookies, CSRF enforcement, login rate limiting, media signing and administrator authorization.
- Smoke-test nested frontend routes, authentication, manual record creation, audit logging and unauthorized requests.
