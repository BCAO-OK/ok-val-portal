// api/org-requests-decide.js
import { verifyToken } from "@clerk/backend";
import {
  withRls,
  getAppUserByClerkId,
  isSystemAdmin,
  canAdminOrg,
} from "./_db.js";

function getBearerToken(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"] || "";
  if (typeof authHeader !== "string") return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, error: { code: "METHOD_NOT_ALLOWED" } });
  }

  // Auth
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

  // Input
  const body = parseJsonBody(req);

  const request_id = body.request_id || body.requestId || body.requestID || null;
  const decisionRaw = body.decision || null;
  const approved_role_id = body.approved_role_id || body.approvedRoleId || null;
  const decision_note = body.decision_note || body.decisionNote || null;

  const decision =
    typeof decisionRaw === "string" ? decisionRaw.trim().toLowerCase() : null;

  if (!request_id || !decision) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "request_id and decision are required",
      },
    });
  }

  if (decision !== "approve" && decision !== "reject") {
    return res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "decision must be 'approve' or 'reject'",
      },
    });
  }

  if (decision === "approve" && !approved_role_id) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "approved_role_id is required for approval",
      },
    });
  }

  try {
    const result = await withRls(clerkUserId, async (client) => {
      // Actor
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

      // Load request (lock it)
      const reqRes = await client.query(
        `
        select
          request_id,
          requester_user_id,
          requested_organization_id,
          requested_role_id,
          approved_role_id,
          status
        from public.organization_membership_request
        where request_id = $1
        for update
        `,
        [request_id]
      );

      const reqRow = reqRes.rows[0];
      if (!reqRow) {
        return {
          status: 404,
          body: {
            ok: false,
            error: { code: "NOT_FOUND", message: "Request not found" },
          },
        };
      }

      // ✅ statuses are constrained (lowercase in your data)
      if (String(reqRow.status || "").toLowerCase() !== "pending") {
        return {
          status: 409,
          body: {
            ok: false,
            error: { code: "NOT_PENDING", message: "Request is not pending" },
          },
        };
      }

      const targetOrgId = reqRow.requested_organization_id;

      // Authorization
      const actorIsSystemAdmin = await isSystemAdmin(client, actor.user_id);
      const actorCanAdminTargetOrg = actorIsSystemAdmin
        ? true
        : await canAdminOrg(client, actor.user_id, targetOrgId);

      if (!actorCanAdminTargetOrg) {
        return {
          status: 403,
          body: {
            ok: false,
            error: {
              code: "FORBIDDEN",
              message: "Not authorized to decide requests for this organization",
            },
          },
        };
      }

      if (decision === "reject") {
        const upd = await client.query(
          `
          update public.organization_membership_request
          set
            status = 'rejected',
            decided_at = now(),
            decided_by_user_id = $2,
            decision_note = $3,
            approved_role_id = null,
            updated_at = now(),
            updated_by = $2
          where request_id = $1
          returning request_id, status, decided_at, decided_by_user_id, decision_note, approved_role_id
          `,
          [request_id, actor.user_id, decision_note || null]
        );

        return { status: 200, body: { ok: true, data: upd.rows[0] } };
      }

      // APPROVE

      // Validate approved_role_id exists & active
      const roleCheck = await client.query(
        `
        select role_id, role_code, role_name, is_active
        from public.role
        where role_id = $1
        limit 1
        `,
        [approved_role_id]
      );
      const role = roleCheck.rows[0];
      if (!role || !role.is_active) {
        return {
          status: 400,
          body: {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "approved_role_id is invalid or inactive",
            },
          },
        };
      }

      // Lock requester
      const userRes = await client.query(
        `
        select user_id, is_active, active_organization_id
        from public.app_user
        where user_id = $1
        for update
        `,
        [reqRow.requester_user_id]
      );
      const targetUser = userRes.rows[0];
      if (!targetUser || !targetUser.is_active) {
        return {
          status: 400,
          body: {
            ok: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Requester user not found or inactive",
            },
          },
        };
      }

      // Upsert membership
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
        [reqRow.requester_user_id, targetOrgId, approved_role_id, actor.user_id]
      );

      // Set active org context
      await client.query(
        `
        update public.app_user
        set
          active_organization_id = $2,
          updated_at = now(),
          updated_by = $3
        where user_id = $1
        `,
        [reqRow.requester_user_id, targetOrgId, actor.user_id]
      );

      // Mark request approved
      const updReq = await client.query(
        `
        update public.organization_membership_request
        set
          status = 'approved',
          approved_role_id = $4,
          decided_at = now(),
          decided_by_user_id = $2,
          decision_note = $3,
          updated_at = now(),
          updated_by = $2
        where request_id = $1
        returning
          request_id,
          status,
          requested_role_id,
          approved_role_id,
          decided_at,
          decided_by_user_id,
          decision_note
        `,
        [request_id, actor.user_id, decision_note || null, approved_role_id]
      );

      return {
        status: 200,
        body: {
          ok: true,
          data: {
            request: updReq.rows[0],
            applied: {
              requester_user_id: reqRow.requester_user_id,
              organization_id: targetOrgId,
              membership_role_id: approved_role_id,
              membership_role_code: role.role_code,
            },
          },
        },
      };
    });

    return res.status(result.status).json(result.body);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: { code: "SERVER_ERROR", message: e?.message || "Unknown error" },
    });
  }
}
