// api/org-users-update.js
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

  // global role (system-wide)
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
      where uom.user_id = $1 and uom.organization_id = $2 and uom.is_active = true
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

async function getRoleById(client, roleId) {
  const { rows } = await client.query(
    `
    select role_id, role_code, role_name, is_active
    from public.role
    where role_id = $1
    limit 1
    `,
    [roleId]
  );
  return rows[0] || null;
}

async function getDefaultUserRoleId(client) {
  const { rows } = await client.query(
    `
    select role_id
    from public.role
    where role_code = 'user' and is_active = true
    limit 1
    `
  );
  return rows[0]?.role_id || null;
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

async function ensureNoOtherAdminSeatTaken(client, orgId, targetUserId) {
  // Enforces: only ONE active assessor/director in org.
  const { rows } = await client.query(
    `
    select uom.user_id
    from public.user_organization_membership uom
    join public.role r on r.role_id = uom.role_id
    where uom.organization_id = $1
      and uom.is_active = true
      and lower(r.role_code) in ('assessor','director')
      and uom.user_id <> $2
    limit 1
    `,
    [orgId, targetUserId]
  );

  if (rows.length > 0) {
    return {
      ok: false,
      error: {
        code: "ADMIN_SEAT_TAKEN",
        message:
          "This organization already has an active Assessor/Director. Only one is allowed.",
      },
    };
  }

  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return json(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use PATCH" },
    });
  }

  const au = await getActorContext(req);
  if (!au.ok) return json(res, au.status, { ok: false, error: au.error });

  const actor = au.user;
  const body = parseJsonBody(req);

  const target_user_id = body.user_id || body.userId || null;
  const display_name = typeof body.display_name === "string" ? body.display_name.trim() : null;
  const role_id = body.role_id || body.roleId || null;

  // current org context for update (for org admins required; for system_admin optional)
  const organization_id = body.organization_id || body.organizationId || null;

  // system_admin-only transfer
  const transfer_to_organization_id =
    body.transfer_to_organization_id || body.transferToOrganizationId || null;

  if (!target_user_id) {
    return json(res, 400, {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "user_id is required" },
    });
  }

  // Basic permission: either system admin, or assessor/director in active org
  if (!actor.is_system_admin && !actor.can_admin_active_org) {
    return json(res, 403, {
      ok: false,
      error: { code: "FORBIDDEN", message: "Not authorized to edit users" },
    });
  }

  // Org admins must have an active org
  if (!actor.is_system_admin && !actor.active_organization_id) {
    return json(res, 400, {
      ok: false,
      error: { code: "NO_ACTIVE_ORG", message: "No active organization selected" },
    });
  }

  // Transfer only for system_admin
  if (transfer_to_organization_id && !actor.is_system_admin) {
    return json(res, 403, {
      ok: false,
      error: { code: "FORBIDDEN", message: "Only system_admin can transfer organizations" },
    });
  }

  // Determine effective org for non-admins
  const actorOrgId = actor.active_organization_id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Confirm target user exists (lock)
    const { rows: targetRows } = await client.query(
      `
      select user_id, is_active, display_name, email, clerk_user_id, active_organization_id
      from public.app_user
      where user_id = $1
      for update
      `,
      [target_user_id]
    );

    const target = targetRows[0];
    if (!target) {
      await client.query("ROLLBACK");
      return json(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Target user not found" },
      });
    }
    if (!target.is_active) {
      await client.query("ROLLBACK");
      return json(res, 400, {
        ok: false,
        error: { code: "TARGET_INACTIVE", message: "Target user is inactive" },
      });
    }

    // Decide which org membership row we are editing
    let effectiveOrgId = null;

    if (actor.is_system_admin) {
      // If transferring, the "effective org" becomes the destination (and we’ll deactivate others).
      if (transfer_to_organization_id) {
        effectiveOrgId = transfer_to_organization_id;
      } else {
        // system_admin can pass org explicitly; if not, infer the user's current active membership org
        if (organization_id) {
          effectiveOrgId = organization_id;
        } else {
          const { rows: memOrgRows } = await client.query(
            `
            select organization_id
            from public.user_organization_membership
            where user_id = $1 and is_active = true
            order by approved_at desc nulls last, updated_at desc
            limit 1
            `,
            [target_user_id]
          );
          effectiveOrgId = memOrgRows[0]?.organization_id || null;
        }
      }
    } else {
      // assessor/director: must act within their active org only
      effectiveOrgId = actorOrgId;
    }

    if (!effectiveOrgId) {
      await client.query("ROLLBACK");
      return json(res, 400, {
        ok: false,
        error: {
          code: "NO_TARGET_ORG",
          message:
            "Could not determine organization for this update. Provide organization_id (system_admin) or select an active organization.",
        },
      });
    }

    // Org admins can only edit users who have a membership row in their org
    if (!actor.is_system_admin) {
      const mem = await getMembershipForUserInOrg(client, target_user_id, effectiveOrgId, false);
      if (!mem) {
        await client.query("ROLLBACK");
        return json(res, 403, {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "You can only edit users within your organization",
          },
        });
      }
    }

    // If role change requested, validate role_id
    let newRole = null;
    if (role_id) {
      newRole = await getRoleById(client, role_id);
      if (!newRole || !newRole.is_active) {
        await client.query("ROLLBACK");
        return json(res, 400, {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "role_id is invalid or inactive" },
        });
      }
    }

    // --- Transfer handling (system_admin only) ---
    if (actor.is_system_admin && transfer_to_organization_id) {
      // Determine role to apply at destination
      let roleToApplyId = role_id;

      if (!roleToApplyId) {
        // try to carry forward existing active membership role, else default to 'user'
        const { rows: curMemRows } = await client.query(
          `
          select role_id
          from public.user_organization_membership
          where user_id = $1 and is_active = true
          order by approved_at desc nulls last, updated_at desc
          limit 1
          `,
          [target_user_id]
        );
        roleToApplyId = curMemRows[0]?.role_id || (await getDefaultUserRoleId(client));
      }

      if (!roleToApplyId) {
        await client.query("ROLLBACK");
        return json(res, 500, {
          ok: false,
          error: { code: "CONFIG_ERROR", message: "Default role 'user' not found" },
        });
      }

      // Validate roleToApplyId, and enforce single assessor/director if needed
      const roleToApply = await getRoleById(client, roleToApplyId);
      if (!roleToApply || !roleToApply.is_active) {
        await client.query("ROLLBACK");
        return json(res, 400, {
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "Role for transfer is invalid/inactive" },
        });
      }

      const roleCodeLower = String(roleToApply.role_code || "").toLowerCase();
      if (roleCodeLower === "assessor" || roleCodeLower === "director") {
        const seatCheck = await ensureNoOtherAdminSeatTaken(
          client,
          transfer_to_organization_id,
          target_user_id
        );
        if (!seatCheck.ok) {
          await client.query("ROLLBACK");
          return json(res, 409, { ok: false, error: seatCheck.error });
        }
      }

      // Deactivate all other active memberships for this user (one-org rule enforced in app layer)
      await client.query(
        `
        update public.user_organization_membership
        set
          is_active = false,
          deactivated_at = now(),
          deactivated_by = $2,
          deactivation_reason = coalesce(deactivation_reason, 'Transferred by system_admin'),
          updated_at = now(),
          updated_by = $2
        where user_id = $1
          and is_active = true
          and organization_id <> $3
        `,
        [target_user_id, actor.user_id, transfer_to_organization_id]
      );

      // Upsert destination membership (reactivate if existed)
      await client.query(
        `
        insert into public.user_organization_membership (
          user_id,
          organization_id,
          role_id,
          is_active,
          approved_at,
          approved_by,
          created_by,
          updated_by
        )
        values ($1, $2, $3, true, now(), $4, $4, $4)
        on conflict (user_id, organization_id)
        do update set
          role_id = excluded.role_id,
          is_active = true,
          approved_at = now(),
          approved_by = excluded.approved_by,
          deactivated_at = null,
          deactivated_by = null,
          deactivation_reason = null,
          updated_at = now(),
          updated_by = excluded.updated_by
        `,
        [target_user_id, transfer_to_organization_id, roleToApplyId, actor.user_id]
      );

      // Set active org context to destination
      await client.query(
        `
        update public.app_user
        set
          active_organization_id = $2,
          updated_at = now(),
          updated_by = $3
        where user_id = $1
        `,
        [target_user_id, transfer_to_organization_id, actor.user_id]
      );
    }

    // --- Non-transfer updates (display_name / membership role in an org) ---

    // Update display_name (DB-only label; Clerk remains authority for login/email)
    if (display_name && display_name.length > 0) {
      await client.query(
        `
        update public.app_user
        set
          display_name = $2,
          updated_at = now(),
          updated_by = $3
        where user_id = $1
        `,
        [target_user_id, display_name, actor.user_id]
      );
    }

    // Update membership role (if requested)
    if (newRole && !(actor.is_system_admin && transfer_to_organization_id)) {
      // lock membership row
      const currentMem = await getMembershipForUserInOrg(
        client,
        target_user_id,
        effectiveOrgId,
        true
      );

      if (!currentMem) {
        await client.query("ROLLBACK");
        return json(res, 400, {
          ok: false,
          error: {
            code: "NO_MEMBERSHIP",
            message: "Target user does not have a membership row for this organization",
          },
        });
      }

      const newRoleCodeLower = String(newRole.role_code || "").toLowerCase();
      const currentRoleCodeLower = String(currentMem.role_code || "").toLowerCase();

      // Enforce single assessor/director seat per org
      if (newRoleCodeLower === "assessor" || newRoleCodeLower === "director") {
        const seatCheck = await ensureNoOtherAdminSeatTaken(client, effectiveOrgId, target_user_id);
        if (!seatCheck.ok) {
          await client.query("ROLLBACK");
          return json(res, 409, { ok: false, error: seatCheck.error });
        }
      }

      // Self-demotion guard (only for non-system_admin)
      if (!actor.is_system_admin && actor.user_id === target_user_id) {
        const wasAdmin = currentRoleCodeLower === "assessor" || currentRoleCodeLower === "director";
        const willBeAdmin = newRoleCodeLower === "assessor" || newRoleCodeLower === "director";

        if (wasAdmin && !willBeAdmin) {
          const others = await countActiveOrgAdminsExcludingUser(client, effectiveOrgId, target_user_id);
          if (others === 0) {
            await client.query("ROLLBACK");
            return json(res, 409, {
              ok: false,
              error: {
                code: "CANNOT_SELF_DEMOTE",
                message:
                  "You cannot demote yourself because you are the only active Assessor/Director for this organization.",
              },
            });
          }
        }
      }

      await client.query(
        `
        update public.user_organization_membership
        set
          role_id = $3,
          updated_at = now(),
          updated_by = $4
        where user_id = $1 and organization_id = $2
        `,
        [target_user_id, effectiveOrgId, newRole.role_id, actor.user_id]
      );
    }

    await client.query("COMMIT");

    return json(res, 200, {
      ok: true,
      data: {
        user_id: target_user_id,
        organization_id: effectiveOrgId,
        updated: {
          display_name: display_name || undefined,
          role_id: role_id || undefined,
          transfer_to_organization_id: transfer_to_organization_id || undefined,
        },
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
