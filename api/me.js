// api/me.js
import { verifyToken } from "@clerk/backend";
import {
  withRls,
  getAppUserByClerkId,
  getGlobalRoleCode,
  getMembershipRoleCode,
  canAdminOrg,
} from "./_db.js";

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

    // --- Auth via Bearer token ---
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

    // --- Data (membership-first) ---
    const result = await withRls(clerkUserId, async (client) => {
      const appUser = await getAppUserByClerkId(client, clerkUserId);

      if (!appUser || appUser.is_active !== true) {
        return { appUser: null };
      }

      const activeOrgId =
        appUser.active_organization_id || appUser.organization_id || null;

      // SYSTEM_ADMIN only (global role)
      const globalRoleCode = await getGlobalRoleCode(client, appUser.user_id);
      const isSystemAdmin = globalRoleCode === "SYSTEM_ADMIN";

      // Membership role for the active org
      const membershipRoleCode = activeOrgId
        ? await getMembershipRoleCode(client, appUser.user_id, activeOrgId)
        : null;

      const canAdminActiveOrg = activeOrgId
        ? await canAdminOrg(client, appUser.user_id, activeOrgId)
        : false;

      // Fetch active org details (if any)
      let activeOrg = null;
      if (activeOrgId) {
        const { rows: orgRows } = await client.query(
          `
          select
            organization_id,
            organization_name
          from public.organization
          where organization_id = $1
          limit 1
          `,
          [activeOrgId]
        );
        activeOrg = orgRows[0] || null;
      }

      // Keep your pending request behavior
      const { rows: pendingRows } = await client.query(
        `
        select json_build_object(
          'request_id', mr.request_id,
          'requested_organization_id', mr.requested_organization_id,
          'status', mr.status,
          'submitted_at', mr.submitted_at
        ) as pending_request
        from public.organization_membership_request mr
        where mr.requester_user_id = $1
          and mr.status = 'pending'
        order by mr.submitted_at desc
        limit 1
        `,
        [appUser.user_id]
      );

      const pendingRequest = pendingRows[0]?.pending_request || null;

      // Preserve old fields for UI compatibility, but introduce new ones:
      const data = {
        user_id: appUser.user_id,
        clerk_user_id: appUser.clerk_user_id,
        email: appUser.email,
        display_name: appUser.display_name,

        // Legacy single-org field (kept for backward compatibility)
        organization_id: appUser.organization_id,

        // New: active org context
        active_organization_id: activeOrgId,
        active_organization: activeOrg
          ? {
            organization_id: activeOrg.organization_id,
            organization_name: activeOrg.organization_name,
          }
          : null,

        // New: explicit role outputs
        global_role_code: globalRoleCode, // only meaningful for SYSTEM_ADMIN
        membership_role_code: membershipRoleCode, // role within active org

        // New: flags the UI can use
        is_system_admin: isSystemAdmin,
        can_admin_active_org: canAdminActiveOrg,

        // Keep existing behavior
        pending_request: pendingRequest,
      };

      return { appUser, data };
    });

    if (!result?.appUser) {
      return res.status(403).json({
        ok: false,
        error: "User not provisioned",
        clerk_user_id: clerkUserId,
      });
    }

    return res.status(200).json({ ok: true, data: result.data });
  } catch (err) {
    console.error("api/me error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
