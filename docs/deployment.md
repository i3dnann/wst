# Deployment guide

This deployment targets a Netlify frontend and a Windows VPS running the API on private port `4177`. MySQL or MariaDB is the database engine; HeidiSQL is the graphical client used to manage it.

## Compatibility note

The Prisma datasource and migration history are MySQL/MariaDB-native. Use a new empty database for the first deployment. PostgreSQL migration files from earlier revisions are intentionally not compatible with this baseline; existing PostgreSQL data must be exported and transformed before importing it into MySQL/MariaDB.

## Create the database with HeidiSQL

The easiest installation is to import `database/DATABASE_SCHEMA.sql` through **File > Load SQL file** in HeidiSQL. The file creates `worldstar_wst`, all 27 tables, indexes, and foreign keys, then returns the table count for verification. It intentionally contains no passwords or database users.

If you prefer to create the database and dedicated user manually, connect HeidiSQL to the local MySQL/MariaDB server as an administrator, open a query tab, and run:

```sql
CREATE DATABASE `worldstar_wst`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'wst_app'@'127.0.0.1'
  IDENTIFIED BY 'REPLACE_WITH_A_STRONG_PASSWORD';

GRANT ALL PRIVILEGES ON `worldstar_wst`.*
  TO 'wst_app'@'127.0.0.1';

FLUSH PRIVILEGES;
```

Keep MySQL/MariaDB on `127.0.0.1:3306`. Do not expose port `3306` through Windows Firewall.

## API environment

Copy `apps/api/.env.example` to `apps/api/.env` and set production values:

```env
NODE_ENV=production
PORT=4177
DATABASE_URL=mysql://wst_app:URL_ENCODED_PASSWORD@127.0.0.1:3306/worldstar_wst
FRONTEND_URL=https://YOUR-SITE.netlify.app
CORS_ALLOWED_ORIGINS=https://YOUR-SITE.netlify.app
SESSION_SECRET=REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS
ADMIN_EMAIL=admin@your-domain.example
ADMIN_PASSWORD=REPLACE_WITH_A_STRONG_PASSWORD
```

Percent-encode reserved characters in the database password before placing it in `DATABASE_URL`. Keep this file outside source control and restrict it to the Windows service account.

## Install and build on Windows Server

Install Git, Node.js 22 LTS, MySQL 8+ or MariaDB, HeidiSQL, and NSSM. Then run Administrator PowerShell:

```powershell
corepack enable
corepack prepare pnpm@10.14.0 --activate
git clone --branch main https://github.com/i3dnann/wst.git C:\Sites\worldstar
Set-Location C:\Sites\worldstar
pnpm install --frozen-lockfile
pnpm --filter @mafia/api prisma:generate
pnpm --filter @mafia/api prisma:migrate:deploy
pnpm --filter @mafia/api prisma:seed
pnpm --filter @mafia/api build
```

The seed is idempotent. It creates permissions, the super-administrator role, and the administrator supplied by `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

Test locally before creating the service:

```powershell
Set-Location C:\Sites\worldstar\apps\api
node dist\server.js
```

From another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:4177/health/live
Invoke-RestMethod http://127.0.0.1:4177/health/ready
```

## Windows service with NSSM

```powershell
New-Item -ItemType Directory -Path C:\Sites\worldstar\logs -Force
nssm install WorldStarApi "C:\Program Files\nodejs\node.exe"
nssm set WorldStarApi AppDirectory "C:\Sites\worldstar\apps\api"
nssm set WorldStarApi AppParameters "dist\server.js"
nssm set WorldStarApi AppStdout "C:\Sites\worldstar\logs\api-output.log"
nssm set WorldStarApi AppStderr "C:\Sites\worldstar\logs\api-error.log"
nssm set WorldStarApi Start SERVICE_AUTO_START
nssm start WorldStarApi
```

Check the service with `Get-Service WorldStarApi`. Do not create a public firewall rule for port `4177`.

## IIS reverse proxy and HTTPS

Port `80` can remain owned by IIS. Create a new IIS site with the host-name binding `api.your-domain.example` and physical path `C:\Sites\worldstar\deploy\iis`. Install IIS URL Rewrite and Application Request Routing, enable ARR proxying at the server level, and use the included `deploy/iis/web.config`. It forwards requests to `http://127.0.0.1:4177`.

Add an HTTPS binding and a valid certificate for the API hostname. Only ports `80` and `443` should be public.

## Frontend on Netlify

Connect `i3dnann/wst`, deploy branch `main`, and use the repository root.

- Build command: `pnpm --filter @mafia/web build`
- Publish directory: `apps/web/dist`
- `VITE_APP_NAME=World Star`
- `VITE_API_BASE_URL=/backend`
- `NODE_VERSION=22`

For same-origin administrator cookies, add this rule before the existing SPA fallback in `netlify.toml`, replacing the placeholder with the real HTTPS API hostname:

```toml
[[redirects]]
  from = "/backend/*"
  to = "https://api.your-domain.example/:splat"
  status = 200
  force = true
```

The existing `/*` rule must remain last. Trigger a new Netlify deployment after changing Vite environment variables or redirect rules.

## Updates

```powershell
Set-Location C:\Sites\worldstar
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter @mafia/api prisma:generate
pnpm --filter @mafia/api prisma:migrate:deploy
pnpm --filter @mafia/api build
Restart-Service WorldStarApi
```

Back up the `worldstar_wst` database in HeidiSQL before every migration. Verify `/health/live`, `/health/ready`, administrator login, events, streams, and bracket changes after each release.
