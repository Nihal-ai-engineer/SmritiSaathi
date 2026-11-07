import { buildApp } from "./app.js";
import { pool } from "./db.js";
const app = await buildApp();
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT || 4100) });
const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
