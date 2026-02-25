// api/org-requests-decide.js
import pkg from "pg";
import { verifyToken } from "@clerk/backend";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function getBearerToken(req) {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"] || "";
  if (typeof authHeader !== "string") return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || null;
}

async function getActor(client, clerkUserId) {
  const { rows } = await client.query(
    `
    SELECT
      au.user_id,
      au.organization_id,
      au.is_active,
      r.role_code
    FROM public.app_user au
    LEFT JOIN public.user_role ur ON ur.user_id = au.user_id
    LEFT JOIN public.role r ON r.role_id = ur.role_id
    WHERE au.clerk_user_id = $1
    LIMIT 1
    `,
    [clerkUserId]
  );
  return rows[0] || null;
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
  const { request_id, decision, approved_role_id, decision_note } = req.body || {};
  if (!request_id || !decision) {
    return res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "request_id and decision are required" },
    });
  }
  if (decision !== "approve" && decision !== "reject") {
    return res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "decision must be 'approve' or 'reject'" },
    });
  }
  if (decision === "approve" && !approved_role_id) {
    return res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "approved_role_id is required for approval" },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Actor
    const actor = await getActor(client, clerkUserId);
    if (!actor) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "app_user not found" } });
    }
    if (!actor.is_active) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "User is inactive" } });
    }

    const roleCode = actor.role_code || "user";
    const isSystemAdmin = roleCode === "system_admin";
    const isOrgApprover = roleCode === "assessor" || roleCode === "director";

    if (!isSystemAdmin && !isOrgApprover) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "Not authorized to decide requests" } });
    }

    // Load request (lock it)
    const reqRes = await client.query(
      `
      SELECT
        request_id,
        requester_user_id,
        requested_organization_id,
        status
      FROM public.organization_membership_request
      WHERE request_id = $1
      FOR UPDATE
      `,
      [request_id]
    );
    const reqRow = reqRes.rows[0];
    if (!reqRow) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Request not found" } });
    }
    if (reqRow.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: { code: "NOT_PENDING", message: "Request is not pending" } });
    }

    // Scope check for org approver
    if (!isSystemAdmin) {
      if (!actor.organization_id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "Approver has no organization" } });
      }
      if (actor.organization_id !== reqRow.requested_organization_id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "Cannot decide requests outside your organization" } });
      }
    }

    if (decision === "reject") {
      const upd = await client.query(
        `
        UPDATE public.organization_membership_request
        SET
          status = 'rejected',
          decided_at = now(),
          decided_by_user_id = $2,
          decision_note = $3,
          updated_by = $2
        WHERE request_id = $1
        RETURNING request_id, status, decided_at, decided_by_user_id, decision_note
        `,
        [request_id, actor.user_id, decision_note || null]
      );

      await client.query("COMMIT");
      return res.status(200).json({ ok: true, data: upd.rows[0] });
    }

    // decision === "approve"
    // Validate approved_role_id exists & active
    const roleCheck = await client.query(
      `
      SELECT role_id, role_code, is_active
      FROM public.role
      WHERE role_id = $1
      LIMIT 1
      `,
      [approved_role_id]
    );
    const role = roleCheck.rows[0];
    if (!role || !role.is_active) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "approved_role_id is invalid or inactive" },
      });
    }

    // Apply org assignment to requester (lock user)
    const userRes = await client.query(
      `
      SELECT user_id, organization_id, is_active
      FROM public.app_user
      WHERE user_id = $1
      FOR UPDATE
      `,
      [reqRow.requester_user_id]
    );
    const targetUser = userRes.rows[0];
    if (!targetUser || !targetUser.is_active) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Requester user not found or inactive" },
      });
    }
    if (targetUser.organization_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        ok: false,
        error: { code: "ALREADY_ASSIGNED", message: "Requester already belongs to an organization" },
      });
    }

    await client.query(
      `
      UPDATE public.app_user
      SET
        organization_id = $2,
        updated_by = $3
      WHERE user_id = $1
      `,
      [reqRow.requester_user_id, reqRow.requested_organization_id, actor.user_id]
    );

    // Upsert the one-and-only role
    await client.query(
      `
      INSERT INTO public.user_role (user_id, role_id, created_by, updated_by)
      VALUES ($1, $2, $3, $3)
      ON CONFLICT (user_id)
      DO UPDATE SET
        role_id = EXCLUDED.role_id,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
      `,
      [reqRow.requester_user_id, approved_role_id, actor.user_id]
    );

    const updReq = await client.query(
      `
      UPDATE public.organization_membership_request
      SET
        status = 'approved',
        decided_at = now(),
        decided_by_user_id = $2,
        decision_note = $3,
        updated_by = $2
      WHERE request_id = $1
      RETURNING request_id, status, decided_at, decided_by_user_id, decision_note
      `,
      [request_id, actor.user_id, decision_note || null]
    );

    await client.query("COMMIT");
    return res.status(200).json({
      ok: true,
      data: {
        request: updReq.rows[0],
        applied: {
          requester_user_id: reqRow.requester_user_id,
          organization_id: reqRow.requested_organization_id,
          role_id: approved_role_id,
          role_code: role.role_code,
        },
      },
    });
  } catch (e) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      ok: false,
      error: { code: "SERVER_ERROR", message: e?.message || "Unknown error" },
    });
  } finally {
    client.release();
  }
}
