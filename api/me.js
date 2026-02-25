// api/me.js
import { verifyToken } from "@clerk/backend";
import { withRls } from "./_db.js";

function getBearerToken(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"] || "";
  if (typeof authHeader !== "string") return null;

  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // --- Auth via Bearer token (matches the pattern we used on org endpoints) ---
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
        reason: "Missing Bearer token",
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
        // If you add this env var, you can uncomment for networkless verify:
        // jwtKey: process.env.CLERK_JWT_KEY,
      });

      clerkUserId = verified?.sub || null;
    } catch (e) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
        reason: e?.message || "Invalid token",
      });
    }

    if (!clerkUserId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // --- Data ---
    const sql = `
      select
        u.user_id,
        u.clerk_user_id,
        u.email,
        u.display_name,

        u.organization_id,
        case
          when u.organization_id is null then null
          else json_build_object(
            'organization_id', o.organization_id,
            'organization_name', o.organization_name
          )
        end as organization,

        coalesce(
          json_agg(
            json_build_object(
              'role_code', r.role_code,
              'role_name', r.role_name
            )
          ) filter (where r.role_code is not null),
          '[]'::json
        ) as roles,

        (
          select json_build_object(
            'request_id', mr.request_id,
            'requested_organization_id', mr.requested_organization_id,
            'status', mr.status,
            'submitted_at', mr.submitted_at
          )
          from public.organization_membership_request mr
          where mr.requester_user_id = u.user_id
            and mr.status = 'pending'
          order by mr.submitted_at desc
          limit 1
        ) as pending_request

      from public.app_user u
      left join public.user_role ur on ur.user_id = u.user_id
      left join public.role r on r.role_id = ur.role_id
      left join public.organization o on o.organization_id = u.organization_id
      where u.clerk_user_id = $1
        and u.is_active = true
      group by
        u.user_id,
        u.clerk_user_id,
        u.email,
        u.display_name,
        u.organization_id,
        o.organization_id,
        o.organization_name
      limit 1;
    `;

    const result = await withRls(clerkUserId, (client) =>
      client.query(sql, [clerkUserId])
    );

    const rows = result?.rows ?? [];

    if (!rows.length) {
      return res.status(403).json({
        ok: false,
        error: "User not provisioned",
        clerk_user_id: clerkUserId,
      });
    }

    return res.status(200).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("api/me error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
