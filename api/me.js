import { auth } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    const { userId } = auth(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const rows = await sql`
      select
        au.user_id,
        au.clerk_user_id,
        au.email,
        au.display_name,
        au.organization_id,
        au.is_active,
        au.created_at,
        au.updated_at,
        coalesce(
          json_agg(
            json_build_object('role_code', r.role_code, 'role_name', r.role_name)
          ) filter (where r.role_id is not null),
          '[]'::json
        ) as roles
      from public.app_user au
      left join public.user_role ur on ur.user_id = au.user_id
      left join public.role r on r.role_id = ur.role_id
      where au.clerk_user_id = ${userId}
      group by au.user_id
      limit 1
    `;

    if (!rows.length) {
      return res.status(403).json({ ok: false, error: "No app_user for this Clerk user" });
    }

    if (!rows[0].is_active) {
      return res.status(403).json({ ok: false, error: "User is inactive" });
    }

    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}