// api/org-requests-pending.js
import pkg from "pg";
import { verifyToken } from "@clerk/backend";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function getBearerToken(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"] || "";
  if (typeof authHeader !== "string") return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

async function getAppUserWithRole(client, clerkUserId) {
  const { rows } = await client.query(
    `
    SELECT
      au.user_id,
      au.organization_id,
      au.is_active,
      r.role_code,
      r.role_rank
    FROM public.app_user au
    LEFT JOIN public.user_role ur ON ur.user_id = au.user_id
    LEFT JOIN public.role r ON r.role_id = ur.role_id
    WHERE au.clerk_user_id = $1
    LIMIT 1
    `,
    [clerkUserId]
  );
  return rows[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } });
  }

  // Auth
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
      authorizedParties: [
        "https://ok-val-portal.vercel.app",
        "http://localhost:5173",
      ],
      // jwtKey: process.env.CLERK_JWT_KEY,
    });
    clerkUserId = verified?.sub || null;
    if (!clerkUserId) throw new Error("Token missing sub");
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Invalid token" },
    });
  }

  const client = await pool.connect();
  try {
    // Load actor + role
    const actor = await getAppUserWithRole(client, clerkUserId);
    if (!actor) {
      return res.status(404).json({
        ok: false,
        error: { code: "NOT_FOUND", message: "app_user not found" },
      });
    }
    if (!actor.is_active) {
      return res.status(403).json({
        ok: false,
        error: { code: "FORBIDDEN", message: "User is inactive" },
      });
    }

    const roleCode = actor.role_code || "user";

    const isSystemAdmin = roleCode === "system_admin";
    const isOrgApprover = roleCode === "assessor" || roleCode === "director";

    if (!isSystemAdmin && !isOrgApprover) {
      return res.status(403).json({
        ok: false,
        error: { code: "FORBIDDEN", message: "Not authorized to view pending requests" },
      });
    }

    // Scope: sysadmin sees all; org approver sees their org only
    let query = `
      SELECT
        r.request_id,
        r.requester_user_id,
        u.email AS requester_email,
        u.display_name AS requester_display_name,
        r.requested_organization_id,
        o.organization_name,
        r.requested_role_id,
        ro.role_code AS requested_role_code,
        ro.role_name AS requested_role_name,
        r.status,
        r.submitted_at
      FROM public.organization_membership_request r
      JOIN public.app_user u ON u.user_id = r.requester_user_id
      JOIN public.organization o ON o.organization_id = r.requested_organization_id
      JOIN public.role ro ON ro.role_id = r.requested_role_id
      WHERE r.status = 'pending'
    `;
    const params = [];

    if (!isSystemAdmin) {
      if (!actor.organization_id) {
        return res.status(403).json({
          ok: false,
          error: { code: "FORBIDDEN", message: "Approver has no organization" },
        });
      }
      params.push(actor.organization_id);
      query += ` AND r.requested_organization_id = $${params.length}`;
    }

    query += ` ORDER BY r.submitted_at ASC LIMIT 200`;

    const { rows } = await client.query(query, params);
    return res.status(200).json({ ok: true, data: rows });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: { code: "SERVER_ERROR", message: e?.message || "Unknown error" },
    });
  } finally {
    client.release();
  }
}
