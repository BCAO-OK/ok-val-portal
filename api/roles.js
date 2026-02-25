// api/roles.js
import { verifyToken } from "@clerk/backend";
import {
  withRls,
  getAppUserByClerkId,
  isSystemAdmin,
} from "./_db.js";

function getBearerToken(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"] || "";
  if (typeof authHeader !== "string") return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } });
  }

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

  try {
    const result = await withRls(clerkUserId, async (client) => {
      const actor = await getAppUserByClerkId(client, clerkUserId);
      if (!actor) {
        return {
          status: 404,
          body: {
            ok: false,
            error: { code: "NOT_FOUND", message: "app_user not found" },
          },
        };
      }
      if (!actor.is_active) {
        return {
          status: 403,
          body: {
            ok: false,
            error: { code: "FORBIDDEN", message: "User is inactive" },
          },
        };
      }

      const actorIsSystemAdmin = await isSystemAdmin(client, actor.user_id);

      // If not system admin, must be an org approver in at least one org
      if (!actorIsSystemAdmin) {
        const { rows } = await client.query(
          `
          select 1
          from public.user_organization_membership m
          join public.role r on r.role_id = m.role_id
          where m.user_id = $1
            and m.is_active = true
            and r.role_code in ('ASSESSOR', 'DIRECTOR')
          limit 1
          `,
          [actor.user_id]
        );

        if (!rows.length) {
          return {
            status: 403,
            body: {
              ok: false,
              error: {
                code: "FORBIDDEN",
                message: "Not authorized to view roles",
              },
            },
          };
        }
      }

      // Return roles that can be assigned to org memberships.
      // Exclude SYSTEM_ADMIN from assignment via org approval flow.
      const { rows: roleRows } = await client.query(
        `
        select
          role_id,
          role_code,
          role_name,
          role_rank
        from public.role
        where is_active = true
          and role_code <> 'SYSTEM_ADMIN'
        order by role_rank desc, role_name asc
        `
      );

      return { status: 200, body: { ok: true, data: roleRows } };
    });

    return res.status(result.status).json(result.body);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: { code: "SERVER_ERROR", message: e?.message || "Unknown error" },
    });
  }
}
