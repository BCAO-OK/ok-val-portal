// api/roles.js
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

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function getActor(client, clerkUserId) {
  const { rows: userRows } = await client.query(
    `
    select
      u.user_id,
      u.clerk_user_id,
      u.email,
      u.display_name,
      u.active_organization_id,
      u.is_active
    from public.app_user u
    where u.clerk_user_id = $1
    limit 1
    `,
    [clerkUserId]
  );

  if (userRows.length === 0) return null;

  const u = userRows[0];

  const { rows: globalRoleRows } = await client.query(
    `
    select r.role_code
    from public.user_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_id = $1
    order by r.role_rank asc, r.role_code asc
    limit 1
    `,
    [u.user_id]
  );

  const global_role_code = String(globalRoleRows[0]?.role_code || "").toLowerCase();
  const is_system_admin = global_role_code === "system_admin";

  let membership_role_code = null;

  if (u.active_organization_id) {
    const { rows: memRows } = await client.query(
      `
      select r.role_code
      from public.user_organization_membership uom
      join public.role r on r.role_id = uom.role_id
      where uom.user_id = $1
        and uom.organization_id = $2
        and uom.is_active = true
      order by r.role_rank asc, r.role_code asc
      limit 1
      `,
      [u.user_id, u.active_organization_id]
    );

    membership_role_code = String(memRows[0]?.role_code || "").toLowerCase() || null;
  }

  const can_admin_active_org =
    is_system_admin ||
    membership_role_code === "assessor" ||
    membership_role_code === "director";

  return {
    ...u,
    global_role_code,
    membership_role_code,
    is_system_admin,
    can_admin_active_org,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return json(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use GET" },
    });
  }

  const token = getBearerToken(req);
  if (!token) {
    return json(res, 401, {
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
    });

    clerkUserId = verified?.sub || null;
    if (!clerkUserId) {
      return json(res, 401, {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Invalid token" },
      });
    }
  } catch (e) {
    return json(res, 401, {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Invalid token" },
    });
  }

  const client = await pool.connect();
  try {
    const actor = await getActor(client, clerkUserId);

    if (!actor) {
      return json(res, 403, {
        ok: false,
        error: { code: "FORBIDDEN", message: "App user not found" },
      });
    }

    if (!actor.is_active) {
      return json(res, 403, {
        ok: false,
        error: { code: "FORBIDDEN", message: "User is inactive" },
      });
    }

    if (!actor.can_admin_active_org) {
      return json(res, 403, {
        ok: false,
        error: { code: "FORBIDDEN", message: "Not authorized to view roles" },
      });
    }

    // Membership-assignable roles only
    const { rows } = await client.query(
      `
      select
        role_id,
        role_code,
        role_name,
        role_rank,
        is_active
      from public.role
      where is_active = true
        and lower(role_code) in ('user', 'assessor', 'director')
      order by role_rank asc, role_code asc
      `
    );

    return json(res, 200, { ok: true, data: rows });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: { code: "SERVER_ERROR", message: String(e?.message || e) },
    });
  } finally {
    client.release();
  }
}