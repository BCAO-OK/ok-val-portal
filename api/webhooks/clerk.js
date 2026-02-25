import { Webhook } from "svix";
import { pool } from "../_db.js";

// Default role for new signups (your provided role_id)
const DEFAULT_ROLE_ID = "2509cdc5-e683-41dc-a5f6-1adb92d2c6c6";

// Use your seeded owner/system admin app_user.user_id here (from /api/me screenshot)
// This satisfies created_by/updated_by NOT NULL FKs in audit columns.
const OWNER_USER_ID = process.env.OWNER_USER_ID || "4df9ecff-9477-4a6c-9e72-3af75d551bb3";

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ ok: false, error: "Missing CLERK_WEBHOOK_SECRET" });

  const svix_id = req.headers["svix-id"];
  const svix_timestamp = req.headers["svix-timestamp"];
  const svix_signature = req.headers["svix-signature"];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ ok: false, error: "Missing Svix headers" });
  }

  let payload;
  try {
    const rawBody = await readRawBody(req);
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: `Invalid webhook signature: ${err?.message || err}` });
  }

  // Clerk event shape: { type, data, ... }
  const eventType = payload?.type;

  // Only handle new users
  if (eventType !== "user.created") {
    return res.status(200).json({ ok: true, ignored: true, type: eventType });
  }

  const data = payload?.data || {};
  const clerkUserId = data?.id;

  // best-effort email + display name
  const email =
    data?.email_addresses?.find((e) => e?.id === data?.primary_email_address_id)?.email_address ||
    data?.email_addresses?.[0]?.email_address ||
    null;

  const displayName =
    [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
    data?.username ||
    email ||
    "User";

  if (!clerkUserId) {
    return res.status(400).json({ ok: false, error: "Webhook missing user id" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Optional: if your RLS depends on app.clerk_user_id, set a system context
    // Comment this out if your DB owner connection bypasses RLS and you don't need it.
    await client.query("SELECT set_config('app.clerk_user_id', $1, true)", ["system"]);

    // 1) Upsert app_user
    // Assumptions:
    // - public.app_user has: user_id (uuid pk), clerk_user_id (unique), email, display_name,
    //   is_active, created_by, updated_by
    const upsertUser = await client.query(
      `
      INSERT INTO public.app_user (clerk_user_id, email, display_name, is_active, created_by, updated_by)
      VALUES ($1, $2, $3, true, $4, $4)
      ON CONFLICT (clerk_user_id)
      DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
      RETURNING user_id
      `,
      [clerkUserId, email, displayName, OWNER_USER_ID]
    );

    const userId = upsertUser.rows[0].user_id;

    // 2) Assign default role (idempotent)
    // Assumptions:
    // - public.user_role has a uniqueness constraint on (user_id, role_id)
    await client.query(
      `
      INSERT INTO public.user_role (user_id, role_id, created_by, updated_by)
      VALUES ($1, $2, $3, $3)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [userId, DEFAULT_ROLE_ID, OWNER_USER_ID]
    );

    await client.query("COMMIT");
    return res.status(200).json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  } finally {
    client.release();
  }
}