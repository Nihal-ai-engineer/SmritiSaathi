import { readdir, readFile } from "node:fs/promises";
import { pool, transaction } from "./db.js";
try {
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(847201)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    for (const name of (
      await readdir(new URL("./migrations/", import.meta.url))
    ).sort()) {
      if (!name.endsWith(".sql")) continue;
      if (
        (
          await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
            name,
          ])
        ).rowCount
      )
        continue;
      await client.query(
        await readFile(
          new URL(`./migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        name,
      ]);
      console.log(`Applied ${name}`);
    }
  });
} finally {
  await pool.end();
}
