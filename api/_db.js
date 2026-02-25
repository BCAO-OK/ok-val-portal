// api/_db.js
import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Runs a callback inside a transaction with
 * app.clerk_user_id set for RLS.
 */
export async function withRls(clerkUserId, callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // This replaces SET LOCAL
    await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [
      clerkUserId,
    ]);

    const result = await callback(client);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetch app_user by Clerk user id.
 * Returns null if not found.
 */
export async function getAppUserByClerkId(client, clerkUserId) {
  const { rows } = await client.query(
    `
    select
      user_id,
      clerk_user_id,
      email,
      display_name,
      organization_id,
      active_organization_id,
      is_active
    from public.app_user
    where clerk_user_id = $1
    limit 1
    `,
    [clerkUserId]
  );
  return rows[0] || null;
}

/**
 * Global role (system-scoped). Used ONLY for SYSTEM_ADMIN.
 * Returns role_code string or null.
 */
export async function getGlobalRoleCode(client, userId) {
  const { rows } = await client.query(
    `
    select r.role_code
    from public.user_role ur
    join public.role r on r.role_id = ur.role_id
    where ur.user_id = $1
    limit 1
    `,
    [userId]
  );
  return rows[0]?.role_code || null;
}

/**
 * Membership-scoped role (org-scoped).
 * Returns role_code string or null.
 */
export async function getMembershipRoleCode(client, userId, organizationId) {
  const { rows } = await client.query(
    `
    select r.role_code
    from public.user_organization_membership m
    join public.role r on r.role_id = m.role_id
    where m.user_id = $1
      and m.organization_id = $2
      and m.is_active = true
    limit 1
    `,
    [userId, organizationId]
  );
  return rows[0]?.role_code || null;
}

export async function isSystemAdmin(client, userId) {
  const code = await getGlobalRoleCode(client, userId);
  return code === "SYSTEM_ADMIN";
}

/**
 * Actor can administer the target org if:
 * - SYSTEM_ADMIN globally, OR
 * - Active membership in org with ASSESSOR or DIRECTOR
 */
export async function canAdminOrg(client, userId, organizationId) {
  if (!organizationId) return false;
  if (await isSystemAdmin(client, userId)) return true;

  const roleCode = await getMembershipRoleCode(client, userId, organizationId);
  return roleCode === "ASSESSOR" || roleCode === "DIRECTOR";
}
