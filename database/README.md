# HeidiSQL database import

`DATABASE_SCHEMA.sql` is the complete MySQL/MariaDB schema for World Star. It creates the `worldstar_wst` database, all 27 application tables, current administration and stream-monitoring fields, indexes, foreign keys, and Prisma's migration-history table using `utf8mb4`.

## Import

1. Open HeidiSQL and connect to the existing XAMPP MySQL server as the same administrator used for A2.
2. Select **File > Load SQL file**.
3. Open `C:\Sites\worldstar\database\DATABASE_SCHEMA.sql`.
4. Press **Run**.
5. The last result must show `worldstar_application_table_count = 27`.

Import this file only for the first installation into a new database. Its migration-history checksums match migrations `0001` through `0003`, which makes later `prisma migrate deploy` updates safe. Existing installations must use `prisma migrate deploy` rather than importing this snapshot again.

The file does not create a MySQL user or store any password. If the XAMPP `mysql.db` permission table is still corrupt, import the schema with the existing MySQL administrator and temporarily configure the API with that account. Repair the permission table before creating a dedicated `wst_app` database user.

## Configure the API

Set the database name in `apps/api/.env`:

```env
DATABASE_URL=mysql://YOUR_USER:URL_ENCODED_PASSWORD@127.0.0.1:3306/worldstar_wst
```

After importing the tables, create the World Star permissions and first administrator:

```powershell
Set-Location C:\Sites\worldstar
pnpm --filter @mafia/api prisma:generate
pnpm --filter @mafia/api prisma:migrate:deploy
pnpm --filter @mafia/api prisma:seed
```

`ADMIN_EMAIL` and `ADMIN_PASSWORD` must be configured in `apps/api/.env` before running the seed command.
