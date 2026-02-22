import { createClerkClient } from "@clerk/backend";
import { Pool } from "pg";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export default async function handler(req, res) {
  try {
    // 1. Get Bearer token from header
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1] : null;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing auth token" });
    }

    // 2. Verify session with Clerk
    const session = await clerk.sessions.verifySession(token).catch(() => null);

    if (!session?.userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const clerkUserId = session.userId;

    // 3. Fetch user + roles from Neon
    const result = await pool.query(
      `
      SELECT
        u.user_id,
        u.email,
        u.display_name,
        r.role_code,
        r.role_name
      FROM public.app_user u
      LEFT JOIN public.user_role ur ON ur.user_id = u.user_id
      LEFT JOIN public.role r ON r.role_id = ur.role_id
      WHERE u.clerk_user_id = $1
      `,
      [clerkUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const user = {
      user_id: result.rows[0].user_id,
      email: result.rows[0].email,
      display_name: result.rows[0].display_name,
      roles: result.rows
        .filter(r => r.role_code)
        .map(r => ({
          role_code: r.role_code,
          role_name: r.role_name,
        })),
    };

    return res.status(200).json({ ok: true, data: user });
  } catch (err) {
    console.error("API /me error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}