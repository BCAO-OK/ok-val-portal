// api/me.js
import { createClerkClient } from "@clerk/backend";
import { withRls } from "./_db.js";

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

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const webReq = toWebRequest(req);
    const authResult = await clerk.authenticateRequest(webReq);

    if (!authResult?.isAuthenticated) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
        reason: authResult?.reason || null,
      });
    }

    const auth = authResult.toAuth();
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const sql = `
      select
        u.user_id,
        u.clerk_user_id,
        u.email,
        u.display_name,
        coalesce(
          json_agg(
            json_build_object(
              'role_code', r.role_code,
              'role_name', r.role_name
            )
          ) filter (where r.role_code is not null),
          '[]'::json
        ) as roles
      from public.app_user u
      left join public.user_role ur on ur.user_id = u.user_id
      left join public.role r on r.role_id = ur.role_id
      where u.clerk_user_id = $1
        and u.is_active = true
      group by u.user_id, u.clerk_user_id, u.email, u.display_name
      limit 1;
    `;

    const { rows } = await withRlsContext(clerkUserId, (client) =>
      client.query(sql, [clerkUserId])
    );

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