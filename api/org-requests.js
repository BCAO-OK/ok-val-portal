// api/org-requests.js
import pkg from "pg";
import { createClerkClient, verifyToken } from "@clerk/backend";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Keep for future endpoints; not required for verifyToken, but harmless and consistent.
createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

async function getAppUserByClerkId(client, clerkUserId) {
  const { rows } = await client.query(
    `
    SELECT user_id, organization_id, is_active
    FROM public.app_user
    WHERE clerk_user_id = $1
    LIMIT 1
    `,
    [clerkUserId]
  );
  return rows[0] || null;
}

function getBearerToken(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"] || "";
  if (typeof authHeader !== "string") return null;

  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } });
  }

  // 1) Auth (Bearer JWT from Clerk session)
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Missing Bearer token" },
    });
  }

  let clerkUserId = null;
  try {
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      // Optional but recommended (prevents tokens from other origins being accepted)
      authorizedParties: [
        "https://ok-val-portal.vercel.app",
        "http://localhost:5173",
      ],
      // If you add CLERK_JWT_KEY in Vercel env vars, you can uncomment this for networkless verify:
      // jwtKey: process.env.CLERK_JWT_KEY,
    });

    clerkUserId = verified?.sub || null;

    if (!clerkUserId) {
      return res.status(401).json({
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Token missing sub" },
      });
    }
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid token",
        details: e?.message || String(e),
      },
    });
  }

  // 2) Input
  const { requested_organization_id } = req.body || {};
  if (!requested_organization_id) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "requested_organization_id is required",
      },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 3) Resolve app_user
    const appUser = await getAppUserByClerkId(client, clerkUserId);
    if (!appUser) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "app_user not found for this Clerk user",
        },
      });
    }
    if (!appUser.is_active) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        ok: false,
        error: { code: "FORBIDDEN", message: "User is inactive" },
      });
    }

    // 4) Enforce one org per user (no reassign via request yet)
    if (appUser.organization_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        ok: false,
        error: {
          code: "ALREADY_ASSIGNED",
          message: "User already belongs to an organization",
        },
      });
    }

    // 5) Validate org exists + active
    const orgCheck = await client.query(
      `
      SELECT organization_id, is_active
      FROM public.organization
      WHERE organization_id = $1
      LIMIT 1
      `,
      [requested_organization_id]
    );
    const org = orgCheck.rows[0];
    if (!org) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Requested organization does not exist",
        },
      });
    }
    if (!org.is_active) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Requested organization is inactive",
        },
      });
    }

    // 6) Default requested_role_id to "user" for now (approver chooses final role later)
    const roleRes = await client.query(
      `
      SELECT role_id
      FROM public.role
      WHERE role_code = 'user'
        AND is_active = true
      LIMIT 1
      `
    );
    const defaultRoleId = roleRes.rows[0]?.role_id;
    if (!defaultRoleId) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        ok: false,
        error: {
          code: "CONFIG_ERROR",
          message: "Default role 'user' not found/active",
        },
      });
    }

    // 7) Insert request
    const ins = await client.query(
      `
      INSERT INTO public.organization_membership_request (
        requester_user_id,
        requested_organization_id,
        requested_role_id,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $1, $1)
      RETURNING
        request_id,
        requester_user_id,
        requested_organization_id,
        requested_role_id,
        status,
        submitted_at
      `,
      [appUser.user_id, requested_organization_id, defaultRoleId]
    );

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, data: ins.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");

    if (e?.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: {
          code: "PENDING_EXISTS",
          message: "A pending request already exists for this user",
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: { code: "SERVER_ERROR", message: e?.message || "Unknown error" },
    });
  } finally {
    client.release();
  }
}
