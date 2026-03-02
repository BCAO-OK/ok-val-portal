// api/org-users-deactivate.js
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

function parseJsonBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== "object") body = {};
  return body;
}

async function getActorContext(req) {
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
    `
    select user_id, clerk_user_id, email, display_name, active_organization_id, is_active
    from public.app_user
    where clerk_user_id = $1
    limit 1
    `,
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
  if (!u.is_active) {
    return {
      ok: false,
      status: 403,
      error: { code: "FORBIDDEN", message: "User is inactive" },
    };
  }

  const { rows: globalRoleRows } = await pool.query(
    `
    select r.role_code
    from public.user_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_id = $1
    order by r.role_rank desc
    limit 1
    `,
    [u.user_id]
  );

  const global_role_code = globalRoleRows[0]?.role_code || "user";
  const is_system_admin =
    String(global_role_code).toLowerCase() === "system_admin";

  // membership role (active org)
  let membership_role_code = null;
  if (u.active_organization_id) {
    const { rows: memRows } = await pool.query(
      `
      select r.role_code
      from public.user_organization_membership uom
      join public.role r on r.role_id = uom.role_id
      where uom.user_id = $1
        and uom.organization_id = $2
        and uom.is_active = true
      limit 1
      `,
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

async function getMembershipForUserInOrg(client, userId, orgId, lock = false) {
  const { rows } = await client.query(
    `
    select
      uom.membership_id,
      uom.user_id,
      uom.organization_id,
      uom.role_id,
      uom.is_active,
      r.role_code
    from public.user_organization_membership uom
    join public.role r on r.role_id = uom.role_id
    where uom.user_id = $1 and uom.organization_id = $2
    ${lock ? "for update" : ""}
    `,
    [userId, orgId]
  );
  return rows[0] || null;
}

async function countActiveOrgAdminsExcludingUser(client, orgId, excludeUserId) {
  const { rows } = await client.query(
    `
    select count(*)::int as ct
    from public.user_organization_membership uom
    join public.role r on r.role_id = uom.role_id
    where uom.organization_id = $1
      and uom.is_active = true
      and lower(r.role_code) in ('assessor','director')
      and uom.user_id <> $2
    `,
    [orgId, excludeUserId]
  );
  return rows[0]?.ct ?? 0;
}

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return json(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use DELETE" },
    });
  }

  const au = await getActorContext(req);
  if (!au.ok) return json(res, au.status, { ok: false, error: au.error });

  const actor = au.user;
  const body = parseJsonBody(req);

  const target_user_id = body.user_id || body.userId || null;
  const organization_id = body.organization_id || body.organizationId || null;
  const reason =
    typeof body.deactivation_reason === "string"
      ? body.deactivation_reason.trim()
      : typeof body.reason === "string"
        ? body.reason.trim()
        : null;

  if (!target_user_id) {
    return json(res, 400, {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "user_id is required" },
    });
  }

  if (!actor.is_system_admin && !actor.can_admin_active_org) {
    return json(res, 403, {
      ok: false,
      error: { code: "FORBIDDEN", message: "Not authorized to remove users" },
    });
  }

  if (!actor.is_system_admin && !actor.active_organization_id) {
    return json(res, 400, {
      ok: false,
      error: { code: "NO_ACTIVE_ORG", message: "No active organization selected" },
    });
  }

  const effectiveOrgId = actor.is_system_admin
    ? (organization_id || actor.active_organization_id)
    : actor.active_organization_id;

  if (!effectiveOrgId) {
    return json(res, 400, {
      ok: false,
      error: {
        code: "NO_TARGET_ORG",
        message: "Provide organization_id (system_admin) or select an active organization",
      },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock membership row
    const mem = await getMembershipForUserInOrg(
      client,
      target_user_id,
      effectiveOrgId,
      true
    );

    if (!mem) {
      await client.query("ROLLBACK");
      return json(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Membership not found for that user/org" },
      });
    }

    if (!mem.is_active) {
      await client.query("ROLLBACK");
      return json(res, 409, {
        ok: false,
        error: { code: "ALREADY_INACTIVE", message: "User is already inactive in this organization" },
      });
    }

    // Org admins can only remove users in their org (membership must exist already; mem exists ensures that)
    if (!actor.is_system_admin) {
      // extra guard: prevent removing the only org admin seat
      const targetRole = String(mem.role_code || "").toLowerCase();
      const isTargetAdmin = targetRole === "assessor" || targetRole === "director";

      if (isTargetAdmin) {
        const others = await countActiveOrgAdminsExcludingUser(
          client,
          effectiveOrgId,
          target_user_id
        );
        if (others === 0) {
          await client.query("ROLLBACK");
          return json(res, 409, {
            ok: false,
            error: {
              code: "CANNOT_REMOVE_LAST_ADMIN",
              message:
                "You cannot remove the only active Assessor/Director for this organization.",
            },
          });
        }
      }

      // self-removal guard (also covered by last-admin check, but explicit is clearer)
      if (actor.user_id === target_user_id) {
        const targetRole = String(mem.role_code || "").toLowerCase();
        const isTargetAdmin = targetRole === "assessor" || targetRole === "director";
        if (isTargetAdmin) {
          const others = await countActiveOrgAdminsExcludingUser(
            client,
            effectiveOrgId,
            target_user_id
          );
          if (others === 0) {
            await client.query("ROLLBACK");
            return json(res, 409, {
              ok: false,
              error: {
                code: "CANNOT_SELF_REMOVE",
                message:
                  "You cannot remove yourself because you are the only active Assessor/Director for this organization.",
              },
            });
          }
        }
      }
    }

    // Deactivate membership
    await client.query(
      `
      update public.user_organization_membership
      set
        is_active = false,
        deactivated_at = now(),
        deactivated_by = $3,
        deactivation_reason = $4,
        updated_at = now(),
        updated_by = $3
      where user_id = $1 and organization_id = $2
      `,
      [target_user_id, effectiveOrgId, actor.user_id, reason || "Deactivated"]
    );

    await client.query("COMMIT");

    return json(res, 200, {
      ok: true,
      data: {
        user_id: target_user_id,
        organization_id: effectiveOrgId,
        deactivated_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    await client.query("ROLLBACK");
    return json(res, 500, {
      ok: false,
      error: { code: "SERVER_ERROR", message: String(e?.message || e) },
    });
  } finally {
    client.release();
  }
}
