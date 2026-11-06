import { client } from "./db-client.mjs";
const pg = client();
await pg.connect();
try {
  const info = await pg.query(
    "SELECT current_database() AS database, current_setting('server_version') AS version, current_setting('server_encoding') AS encoding",
  );
  const tables = await pg.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  console.log(
    JSON.stringify(
      { database: info.rows[0], tables: tables.rows.map((x) => x.tablename) },
      null,
      2,
    ),
  );
  if (tables.rows.some((x) => x.tablename === "_prisma_migrations")) {
    const migrations = await pg.query(
      "SELECT migration_name,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY started_at",
    );
    console.log(JSON.stringify({ migrations: migrations.rows }, null, 2));
  }
} finally {
  await pg.end();
}
