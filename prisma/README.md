# Database

FloodGuard ships with **two** storage targets that share one logical model.

## Development / demo / tests — SQLite

`prisma/schema.prisma` uses `provider = "sqlite"` and `DATABASE_URL="file:./dev.db"`.
This is persistent **file** storage (not in-memory), so the app and the test
suite run with zero database setup.

```bash
cp .env.example .env      # DATABASE_URL is already set for SQLite
npm run db:push           # create the schema in prisma/dev.db
npm run db:seed           # load clearly-labelled SIMULATED demo data
```

## Production — PostgreSQL

The full production DDL lives at [`../db/postgres/0001_init.sql`](../db/postgres/0001_init.sql)
(primary/foreign keys, unique device ids, timestamps, indexes, CHECK validation,
duplicate-packet unique constraint).

To make Prisma manage a Postgres database directly:

1. Change the datasource provider:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Set a Postgres connection string in `.env`:

   ```
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/floodguard?schema=public"
   ```

3. Either apply the hand-written migration (`psql "$DATABASE_URL" -f db/postgres/0001_init.sql`)
   or generate/apply a Prisma migration (`prisma migrate dev --name init`).

## Data-quality rules encoded in the model

- `raw_sensor_value` is the raw sensor reading and is **never** presented as centimetres.
- `calibrated_water_level_cm` is `NULL` until an admin configures calibration
  (`calibration_slope` / `calibration_intercept` on the device).
- `water_flow_lpm` is `NULL` unless a real flow sensor or validated model exists;
  `flow_source` marks it `MEASURED` vs `ESTIMATED`. **Flow is never invented.**
- Device credentials are stored as `token_hash` (SHA-256) + `token_prefix` only.
- `simulated = true` rows are demo data and are clearly separated from real readings.
