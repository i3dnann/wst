# Production deployment: Netlify + Windows VPS

This deployment keeps the React frontend on Netlify and runs the Fastify API on a Windows VPS at `127.0.0.1:4177`. MySQL/MariaDB remains local to the VPS and HeidiSQL is the administration client. IIS (or another HTTPS reverse proxy) exposes a dedicated API hostname; database port `3306` and API port `4177` must not be public.

## 1. Required software

Install Git, Node.js 22 LTS or newer, pnpm 10.14, MySQL 8+/MariaDB, HeidiSQL, PM2, IIS URL Rewrite, and IIS Application Request Routing.

```powershell
corepack enable
corepack prepare pnpm@10.14.0 --activate
npm.cmd install --global pm2
```

## 2. Clone or update the repository

For a first installation:

```powershell
git clone --branch main https://github.com/i3dnann/wst.git C:\Sites\worldstar
Set-Location C:\Sites\worldstar
pnpm install --frozen-lockfile
```

For an existing installation:

```powershell
Set-Location C:\Sites\worldstar
git status --short
git pull --ff-only origin main
pnpm install --frozen-lockfile
```

Do not pull over uncommitted VPS edits. Save or remove those edits first.

## 3. Database setup with HeidiSQL

For a new, empty installation, load `database/DATABASE_SCHEMA.sql` in HeidiSQL and run the complete file. It creates `worldstar_wst`, all application tables, indexes, foreign keys, and matching Prisma migration-history rows.

For an existing installation, do **not** import the full snapshot again. Back up the database, then run `prisma:migrate:deploy` as shown below.

Keep MySQL/MariaDB bound to `127.0.0.1:3306`. If the local grant tables are healthy, use a dedicated account:

```sql
CREATE USER 'wst_app'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON `worldstar_wst`.* TO 'wst_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Percent-encode reserved characters in the password when it is placed in `DATABASE_URL`.

## 4. VPS environment

Copy `apps/api/.env.example` to `apps/api/.env`. Use production values and never commit this file:

```env
NODE_ENV=production
PORT=4177
DATABASE_URL=mysql://wst_app:URL_ENCODED_PASSWORD@127.0.0.1:3306/worldstar_wst
FRONTEND_URL=https://wstgang.com
CORS_ALLOWED_ORIGINS=https://wstgang.com,https://www.wstgang.com
SESSION_SECRET=REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=REPLACE_WITH_A_12_CHARACTER_OR_LONGER_PASSWORD
LOG_LEVEL=info
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
KICK_CLIENT_ID=
KICK_CLIENT_SECRET=
YOUTUBE_API_KEY=
STREAM_STATUS_TTL_SECONDS=60
YOUTUBE_STATUS_TTL_SECONDS=1800
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
```

Use an HTTPS S3-compatible public base URL. Media upload is intentionally unavailable until every S3 value is configured. Twitch and YouTube automatic detection are also unavailable until their provider credentials are present; manual stream status remains supported.

## 5. Back up before every migration

With XAMPP MySQL, run:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Path C:\Backups\worldstar -Force
& 'C:\xampp\mysql\bin\mysqldump.exe' --host=127.0.0.1 --user=wst_app --password --single-transaction --routines --triggers worldstar_wst | Out-File -FilePath "C:\Backups\worldstar\worldstar-$stamp.sql" -Encoding utf8
```

The command prompts for the password instead of placing it in PowerShell history. Confirm that the resulting SQL file is non-empty before deploying.

## 6. Generate, migrate, seed, verify, and build

```powershell
Set-Location C:\Sites\worldstar
pnpm --filter @mafia/api prisma:generate
pnpm --filter @mafia/api prisma:migrate:deploy
pnpm --filter @mafia/api prisma:seed
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm prisma:validate
```

The seed is idempotent. It synchronizes permission keys, protects the Super Administrator role, and creates or updates the administrator identified by `ADMIN_EMAIL`.

## 7. Start or restart the API with PM2

First start:

```powershell
Set-Location C:\Sites\worldstar
pm2.cmd start .\apps\api\ecosystem.config.cjs --env production
pm2.cmd save
pm2.cmd status
```

After an update:

```powershell
Set-Location C:\Sites\worldstar
pm2.cmd reload worldstar-api --update-env
pm2.cmd save
pm2.cmd status
```

Check the API locally:

```powershell
Invoke-RestMethod http://127.0.0.1:4177/health/live | ConvertTo-Json -Depth 5
Invoke-RestMethod http://127.0.0.1:4177/health/ready | ConvertTo-Json -Depth 5
pm2.cmd logs worldstar-api --lines 100 --nostream
```

If an older Windows PowerShell cannot establish TLS, the local HTTP health commands still work. Use a current browser or PowerShell 7 for public HTTPS checks.

## 8. IIS HTTPS reverse proxy

Create an IIS site for `api.your-domain.example`, add a valid HTTPS certificate, enable ARR proxying, and apply `deploy/iis/web.config`. It forwards traffic to `http://127.0.0.1:4177`.

Only `443` (and optionally `80` for certificate redirects) should be public. Keep `4177` blocked in Windows Firewall. Verify:

```powershell
Invoke-RestMethod https://api.your-domain.example/health/live | ConvertTo-Json
```

Do not configure the Netlify function with a plain public-IP HTTP URL. The proxy rejects non-HTTPS production targets.

## 9. Netlify configuration

Connect `i3dnann/wst`, choose branch `main`, and keep the repository root as the base directory. `netlify.toml` already defines:

- Build command: `pnpm --filter @mafia/web build`
- Publish directory: `apps/web/dist`
- Functions directory: `netlify/functions`
- SPA fallback and immutable asset caching

Set these Netlify environment variables in the UI:

| Variable               | Scope     | Value                             |
| ---------------------- | --------- | --------------------------------- |
| `NODE_VERSION`         | Builds    | `22`                              |
| `VITE_APP_NAME`        | Builds    | `World Star`                      |
| `VITE_PUBLIC_SITE_URL` | Builds    | `https://wstgang.com`             |
| `VITE_API_BASE_URL`    | Builds    | `/backend`                        |
| `API_PROXY_TARGET`     | Functions | `https://api.your-domain.example` |

`API_PROXY_TARGET` is read at function runtime. After changing it, trigger a new production deploy. The browser calls the same-origin `/backend` path, so secure HttpOnly session cookies stay on the Netlify site and are never stored in local storage.

Verify through the deployed frontend:

```text
https://wstgang.com/backend/health/live
https://wstgang.com/backend/health/ready
```

## 10. Move production to `wstgang.com`

In Netlify, open **Domain management > Production domains** and make `wstgang.com` the primary domain. Keep `www.wstgang.com` as the domain alias. In **Site configuration > Environment variables**, set:

```env
VITE_PUBLIC_SITE_URL=https://wstgang.com
VITE_API_BASE_URL=/backend
```

Keep `API_PROXY_TARGET` set to the existing HTTPS address of the VPS API. Trigger a new production deploy after changing a build variable. The redirect in `netlify.toml` sends old `wstgang.netlify.app` links to the matching path on `wstgang.com`.

The VPS environment is not stored in Git. Update `C:\Sites\worldstar\apps\api\.env` and restart the API:

```powershell
Set-Location C:\Sites\worldstar
$apiEnvPath = 'C:\Sites\worldstar\apps\api\.env'
$apiEnvText = [System.IO.File]::ReadAllText($apiEnvPath)
$apiEnvText = [regex]::Replace(
  $apiEnvText,
  '(?m)^FRONTEND_URL=.*$',
  'FRONTEND_URL=https://wstgang.com'
)
$apiEnvText = [regex]::Replace(
  $apiEnvText,
  '(?m)^CORS_ALLOWED_ORIGINS=.*$',
  'CORS_ALLOWED_ORIGINS=https://wstgang.com,https://www.wstgang.com'
)
[System.IO.File]::WriteAllText(
  $apiEnvPath,
  $apiEnvText,
  [System.Text.UTF8Encoding]::new($false)
)
Select-String -Path $apiEnvPath -Pattern '^(FRONTEND_URL|CORS_ALLOWED_ORIGINS)='
pm2.cmd reload worldstar-api --update-env
pm2.cmd save
pm2.cmd status
```

Verify both the local API and the Netlify proxy:

```powershell
Invoke-RestMethod http://127.0.0.1:4177/health/live
Invoke-RestMethod https://wstgang.com/backend/health/live
Invoke-RestMethod https://wstgang.com/backend/health/ready
```

Check that the new browser origin is accepted without using a real password:

```powershell
$headers = @{
  Origin = 'https://wstgang.com'
  'Content-Type' = 'application/json'
}
try {
  Invoke-WebRequest `
    -UseBasicParsing `
    -Uri 'https://wstgang.com/backend/api/v1/auth/login' `
    -Method Post `
    -Headers $headers `
    -Body '{"email":"nobody@example.com","password":"not-a-real-password"}'
} catch {
  [int]$_.Exception.Response.StatusCode
}
```

The expected result is `401` for invalid credentials. A `500` response means the VPS still has the old CORS origin or PM2 was not reloaded with `--update-env`.

## 11. Stream and Discord integrations

- Twitch needs an application client ID and secret.
- YouTube needs a Google Cloud API key with YouTube Data API v3 enabled and a channel ID beginning with `UC`.
- Kick uses an app access token. Set `KICK_CLIENT_ID` and `KICK_CLIENT_SECRET` from the Kick Developer Portal only in `apps/api/.env`; never put the secret in Netlify or a `VITE_` variable.
- The API refreshes approved Kick channels at the configured stream TTL, stores their live title, category, start time, and viewer count, and exposes only that public metadata to the Live page.
- Configure the Discord audit webhook in **Admin > Discord**. Normal API responses only return a masked state. Failed deliveries are written to the database audit log.

## 12. Rollback

Application rollback and database rollback are separate operations. Record the deployed commit before updating:

```powershell
Set-Location C:\Sites\worldstar
git rev-parse HEAD
```

If the release must be rolled back and no new migration was applied, check out the previous known-good commit, reinstall, rebuild, and reload PM2:

```powershell
git checkout PREVIOUS_COMMIT_SHA
pnpm install --frozen-lockfile
pnpm --filter @mafia/api prisma:generate
pnpm --filter @mafia/api build
pm2.cmd reload worldstar-api --update-env
```

If a migration was applied, stop the API and restore the pre-deployment HeidiSQL/mysqldump backup before starting the old application. Prisma migrations are forward-only; do not manually delete a migration-history row or partially reverse columns in production.

After recovery, return the VPS checkout to `main` before the next normal update:

```powershell
git switch main
git pull --ff-only origin main
```
