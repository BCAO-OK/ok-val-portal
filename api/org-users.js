// api/org-users.js
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
    select
      user_id,
      clerk_user_id,
      email,
      display_name,
      active_organization_id,
      is_active
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

  // Global role (system-wide)
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
  const is_system_admin = String(global_role_code).toLowerCase() === "system_admin";

  // Membership role for active org (org-scoped)
  let membership_role_code = null;

  if (u.active_organization_id) {
    const { rows: memRows } = await pool.query(
      `
      select r.role_code
      from public.user_organization_membership uom
      join public.role r on r.role_id = uom.role_id
      where uom.user_id = $1
        and uom.organization_id = $2
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

function groupByOrganization(rows) {
  // rows expected to include organization_id + organization_name
  const byOrg = new Map();
  const unassigned = [];

  for (const r of rows) {
    const hasOrg = !!r.organization_id;

    const user = {
      user_id: r.user_id,
      clerk_user_id: r.clerk_user_id,
      email: r.email,
      display_name: r.display_name,
      app_user_is_active: r.app_user_is_active,

      membership_id: r.membership_id || null,
      membership_is_active: r.membership_is_active ?? null,
      approved_at: r.approved_at || null,
      approved_by: r.approved_by || null,
      deactivated_at: r.deactivated_at || null,
      deactivated_by: r.deactivated_by || null,
      deactivation_reason: r.deactivation_reason || null,

      membership_role_id: r.membership_role_id || null,
      membership_role_code: r.membership_role_code || null,
      membership_role_name: r.membership_role_name || null,

      global_role_code: r.global_role_code || "user",
    };

    if (!hasOrg) {
      unassigned.push(user);
      continue;
    }

    if (!byOrg.has(r.organization_id)) {
      byOrg.set(r.organization_id, {
        organization_id: r.organization_id,
        organization_name: r.organization_name,
        users: [],
      });
    }
    byOrg.get(r.organization_id).users.push(user);
  }

  // stable ordering
  const organizations = Array.from(byOrg.values()).sort((a, b) =>
    String(a.organization_name).localeCompare(String(b.organization_name))
  );

  for (const o of organizations) {
    o.users.sort((a, b) =>
      String(a.display_name).localeCompare(String(b.display_name))
    );
  }

  unassigned.sort((a, b) =>
    String(a.display_name).localeCompare(String(b.display_name))
  );

  return { organizations, unassigned };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return json(res, 405, {
        ok: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Use GET" },
      });
    }

    const au = await getActorContext(req);
    if (!au.ok) return json(res, au.status, { ok: false, error: au.error });

    const actor = au.user;

    // System admin: can see everything; no active org required
    if (actor.is_system_admin) {
      // Membership-based listing (grouped by org)
      const { rows } = await pool.query(
        `
        select
          u.user_id,
          u.clerk_user_id,
          u.email,
          u.display_name,
          u.is_active as app_user_is_active,

          uom.membership_id,
          uom.organization_id,
          o.organization_name,
          uom.role_id as membership_role_id,
          mr.role_code as membership_role_code,
          mr.role_name as membership_role_name,
          uom.is_active as membership_is_active,
          uom.approved_at,
          uom.approved_by,
          uom.deactivated_at,
          uom.deactivated_by,
          uom.deactivation_reason,

          gr.role_code as global_role_code

        from public.app_user u
        left join public.user_organization_membership uom
          on uom.user_id = u.user_id
        left join public.organization o
          on o.organization_id = uom.organization_id
        left join public.role mr
          on mr.role_id = uom.role_id
        left join public.user_role ur
          on ur.user_id = u.user_id
        left join public.role gr
          on gr.role_id = ur.role_id

        where u.is_active = true
        order by
          o.organization_name nulls last,
          u.display_name asc
        `
      );

      const grouped = groupByOrganization(rows);
      return json(res, 200, { ok: true, data: grouped });
    }

    // Org admin: must be assessor/director in ACTIVE org
    if (!actor.can_admin_active_org) {
      return json(res, 403, {
        ok: false,
        error: { code: "FORBIDDEN", message: "Not authorized to view users" },
      });
    }

    if (!actor.active_organization_id) {
      return json(res, 400, {
        ok: false,
        error: { code: "NO_ACTIVE_ORG", message: "No active organization selected" },
      });
    }

    const orgId = actor.active_organization_id;

    const { rows } = await pool.query(
      `
      select
        u.user_id,
        u.clerk_user_id,
        u.email,
        u.display_name,
        u.is_active as app_user_is_active,

        uom.membership_id,
        uom.organization_id,
        o.organization_name,
        uom.role_id as membership_role_id,
        mr.role_code as membership_role_code,
        mr.role_name as membership_role_name,
        uom.is_active as membership_is_active,
        uom.approved_at,
        uom.approved_by,
        uom.deactivated_at,
        uom.deactivated_by,
        uom.deactivation_reason,

        gr.role_code as global_role_code

      from public.user_organization_membership uom
      join public.app_user u
        on u.user_id = uom.user_id
      join public.organization o
        on o.organization_id = uom.organization_id
      left join public.role mr
        on mr.role_id = uom.role_id
      left join public.user_role ur
        on ur.user_id = u.user_id
      left join public.role gr
        on gr.role_id = ur.role_id

      where uom.organization_id = $1
        and u.is_active = true
      order by u.display_name asc
      `,
      [orgId]
    );

    // For org admins we return a single-org structure (keeps UI simple later)
    const data = {
      organizations: [
        {
          organization_id: orgId,
          organization_name: rows[0]?.organization_name || null,
          users: rows.map((r) => ({
            user_id: r.user_id,
            clerk_user_id: r.clerk_user_id,
            email: r.email,
            display_name: r.display_name,
            app_user_is_active: r.app_user_is_active,

            membership_id: r.membership_id,
            membership_is_active: r.membership_is_active,
            approved_at: r.approved_at,
            approved_by: r.approved_by,
            deactivated_at: r.deactivated_at,
            deactivated_by: r.deactivated_by,
            deactivation_reason: r.deactivation_reason,

            membership_role_id: r.membership_role_id,
            membership_role_code: r.membership_role_code,
            membership_role_name: r.membership_role_name,

            global_role_code: r.global_role_code || "user",
          })),
        },
      ],
      unassigned: [],
    };

    return json(res, 200, { ok: true, data });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: { code: "SERVER_ERROR", message: String(e?.message || e) },
    });
  }
}