// api/_db.js
import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Runs a callback inside a transaction with
 * app.clerk_user_id set for RLS.
 */
export async function withRls(clerkUserId, callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // This replaces SET LOCAL
    await client.query(
      "SELECT set_config('app.clerk_user_id', $1, true)",
      [clerkUserId]
    );

    const result = await callback(client);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}