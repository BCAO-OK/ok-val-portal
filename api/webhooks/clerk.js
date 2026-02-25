// api/webhooks/clerk.js
import { Webhook } from "svix";
import { pool } from "../_db.js";

// Default role for new signups ("user")
const DEFAULT_ROLE_ID = "2509cdc5-e683-41dc-a5f6-1adb92d2c6c6";

// Seeded owner/system admin app_user.user_id (satisfies created_by/updated_by NOT NULL FKs)
const OWNER_USER_ID = process.env.OWNER_USER_ID || "4df9ecff-9477-4a6c-9e72-3af75d551bb3";

async function readRawBody(req) {
  // Vercel Node runtime: read the raw stream for Svix verification
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function extractEmailAndName(data) {
  const emails = Array.isArray(data?.email_addresses) ? data.email_addresses : [];

  const email =
    emails.find((e) => e?.id === data?.primary_email_address_id)?.email_address ||
    emails[0]?.email_address ||
    null;

  const displayName =
    [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
    data?.username ||
    email ||
    "User";

  return { email, displayName };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, error: "Missing CLERK_WEBHOOK_SECRET" });
  }

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
    return res
      .status(400)
      .json({ ok: false, error: `Invalid webhook signature: ${err?.message || err}` });
  }

  const eventType = payload?.type;
  const data = payload?.data || {};
  const clerkUserId = data?.id;

  // We handle both:
  // - user.created: provision new app_user + assign default role
  // - user.updated: fill in email/display_name later if created payload didn't include email
  if (eventType !== "user.created" && eventType !== "user.updated") {
    return res.status(200).json({ ok: true, ignored: true, type: eventType });
  }

  if (!clerkUserId) {
    return res.status(400).json({ ok: false, error: "Webhook missing user id" });
  }

  const { email, displayName } = extractEmailAndName(data);

  // RECOMMENDED: your DB requires app_user.email NOT NULL.
  // Clerk "test events" (and some auth methods) may omit email on user.created.
  // So: if no email, DO NOT INSERT; just acknowledge the webhook and wait for user.updated.
  if (!email) {
    return res.status(200).json({
      ok: true,
      ignored: true,
      type: eventType,
      reason:
        'No email in Clerk payload; app_user.email is NOT NULL. Waiting for a later user.updated with email.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If you have RLS policies that depend on this setting, keep it; otherwise harmless.
    await client.query("SELECT set_config('app.clerk_user_id', $1, true)", ["system"]);

    // Check if user already exists
    const existing = await client.query(
      `SELECT user_id FROM public.app_user WHERE clerk_user_id = $1`,
      [clerkUserId]
    );

    let userId;

    if (existing.rows.length === 0) {
      // Create user
      const ins = await client.query(
        `
        INSERT INTO public.app_user
          (clerk_user_id, email, display_name, is_active, created_by, updated_by)
        VALUES
          ($1, $2, $3, true, $4, $4)
        RETURNING user_id
        `,
        [clerkUserId, email, displayName, OWNER_USER_ID]
      );

      userId = ins.rows[0].user_id;

      // Assign default role (idempotent)
      await client.query(
        `
        INSERT INTO public.user_role (user_id, role_id, created_by, updated_by)
        VALUES ($1, $2, $3, $3)
        ON CONFLICT (user_id, role_id) DO NOTHING
        `,
        [userId, DEFAULT_ROLE_ID, OWNER_USER_ID]
      );
    } else {
      // Update user info (email/name can change or be added later)
      userId = existing.rows[0].user_id;

      await client.query(
        `
        UPDATE public.app_user
        SET email = $2,
            display_name = $3,
            updated_by = $4,
            updated_at = now()
        WHERE clerk_user_id = $1
        `,
        [clerkUserId, email, displayName, OWNER_USER_ID]
      );

      // Optional: ensure default role exists even if user was manually created earlier
      await client.query(
        `
        INSERT INTO public.user_role (user_id, role_id, created_by, updated_by)
        VALUES ($1, $2, $3, $3)
        ON CONFLICT (user_id, role_id) DO NOTHING
        `,
        [userId, DEFAULT_ROLE_ID, OWNER_USER_ID]
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ ok: true, type: eventType });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  } finally {
    client.release();
  }
}