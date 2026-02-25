// api/_db.js
import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Run a function in a transaction with app.clerk_user_id set for RLS.
 * @param {string} clerkUserId
 * @param {(client: import("pg").PoolClient) => Promise<any>} fn
 */
export async function withRlsContext(clerkUserId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Use set_config so it is scoped to this transaction (3rd arg = true).
    await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [
      clerkUserId,
    ]);

    const result = await fn(client);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}