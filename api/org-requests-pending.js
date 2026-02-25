// api/org-requests-pending.js
import { createClerkClient } from "@clerk/backend";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

function toWebRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `${proto}://${host}${req.url}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (typeof v === "string") headers.set(k, v);
  }

  return new Request(url, { method: req.method, headers });
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function getAppUser(req) {
  const webReq = toWebRequest(req);
  const authResult = await clerk.authenticateRequest(webReq);

  if (!authResult?.isAuthenticated) {
    return {
      ok: false,
      status: 401,
      error: { code: "UNAUTHENTICATED", message: "Sign in required" },
    };
  }

  const clerkUserId = authResult.toAuth().userId;

  const { rows: userRows } = await pool.query(
    `select user_id, clerk_user_id, email, display_name, active_organization_id
     from public.app_user
     where clerk_user_id = $1
     limit 1`,
    [clerkUserId]
  );

  if (userRows.length === 0) {
    return {
      ok: false,
      status: 403,
      error: { code: "FORBIDDEN", message: "App user not found" },
    };
  }

  const u = userRows[0];

  const { rows: globalRoleRows } = await pool.query(
    `select r.role_code
     from public.user_role ur
     join public.role r on r.role_id = ur.role_id
     where ur.user_id = $1
     order by r.role_rank desc
     limit 1`,
    [u.user_id]
  );

  const global_role_code = globalRoleRows[0]?.role_code || "user";
  const is_system_admin = String(global_role_code).toLowerCase() === "system_admin";

  let membership_role_code = null;

  if (u.active_organization_id) {
    const { rows: memRows } = await pool.query(
      `select r.role_code
       from public.user_organization_membership uom
       join public.role r on r.role_id = uom.role_id
       where uom.user_id = $1 and uom.organization_id = $2
       limit 1`,
      [u.user_id, u.active_organization_id]
    );

    membership_role_code = memRows[0]?.role_code || null;
  }

  const m = (membership_role_code || "").toLowerCase();
  const can_admin_active_org = is_system_admin || m === "assessor" || m === "director";

  return {
    ok: true,
    user: {
      ...u,
      global_role_code,
      membership_role_code,
      is_system_admin,
      can_admin_active_org,
    },
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return json(res, 405, {
        ok: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Use GET" },
      });
    }

    const au = await getAppUser(req);
    if (!au.ok) return json(res, au.status, { ok: false, error: au.error });

    // ✅ THIS IS THE FIX:
    if (!au.user.can_admin_active_org) {
      return json(res, 403, {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Not authorized to view pending requests",
        },
      });
    }

    if (!au.user.active_organization_id && !au.user.is_system_admin) {
      return json(res, 400, {
        ok: false,
        error: {
          code: "NO_ACTIVE_ORG",
          message: "No active organization selected",
        },
      });
    }

    // Default: org admins only see their active org's pending requests.
    // SYSTEM_ADMIN can see all if you later want that; for now keep it org-scoped too unless you ask otherwise.
    const orgId = au.user.active_organization_id;

    const { rows } = await pool.query(
      `select
         r.request_id,
         r.organization_id,
         r.organization_name,
         r.requester_user_id,
         u.display_name as requester_display_name,
         u.email as requester_email,
         r.status,
         r.created_at
       from public.organization_membership_request r
       join public.app_user u on u.user_id = r.requester_user_id
       where r.status = 'PENDING'
         and r.organization_id = $1
       order by r.created_at asc`,
      [orgId]
    );

    return json(res, 200, { ok: true, data: rows });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: { code: "SERVER_ERROR", message: String(e?.message || e) },
    });
  }
}
