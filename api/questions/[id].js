// api/questions/[id].js
import { createClerkClient } from "@clerk/backend";
import { pool } from "../_db.js";

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

function hasEditRights(appUser) {
  const roles = Array.isArray(appUser?.roles) ? appUser.roles : [];
  const codes = new Set(roles.map(r => r.role_code));
  return codes.has("system_admin") || codes.has("director") || codes.has("assessor");
}

async function loadAppUser(client, clerkUserId) {
  const { rows } = await client.query(
    `
    select
      u.user_id,
      coalesce(
        json_agg(json_build_object('role_code', r.role_code))
        filter (where r.role_code is not null),
        '[]'::json
      ) as roles
    from public.app_user u
    left join public.user_role ur on ur.user_id = u.user_id
    left join public.role r on r.role_id = ur.role_id
    where u.clerk_user_id = $1
      and u.is_active = true
    group by u.user_id
    limit 1;
    `,
    [clerkUserId]
  );

  return rows[0] || null;
}

export default async function handler(req, res) {
  const client = await pool.connect();

  try {
    const webReq = toWebRequest(req);
    const authResult = await clerk.authenticateRequest(webReq);

    if (!authResult?.isAuthenticated) {
      return res.status(401).json({ ok:false, error:"Unauthorized" });
    }

    const clerkUserId = authResult.toAuth().userId;
    if (!clerkUserId) {
      return res.status(401).json({ ok:false, error:"Unauthorized" });
    }

    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.clerk_user_id', $1, true)",
      [clerkUserId]
    );

    const appUser = await loadAppUser(client, clerkUserId);
    if (!appUser) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok:false, error:"User not provisioned" });
    }

    const { id } = req.query;

    // =========================
    // UPDATE QUESTION
    // =========================
    if (req.method === "PUT") {
      if (!hasEditRights(appUser)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ ok:false, error:"Forbidden" });
      }

      const {
        prompt,
        explanation,
        citation_text,
        difficulty,
        is_active,
        is_verified
      } = req.body;

      const { rows } = await client.query(
        `
        update public.question
        set
          prompt = $1,
          explanation = $2,
          citation_text = $3,
          difficulty = $4,
          is_active = $5,
          is_verified = $6,
          updated_at = now(),
          updated_by = $7
        where question_id = $8
        returning *;
        `,
        [
          prompt,
          explanation,
          citation_text,
          difficulty,
          is_active,
          is_verified,
          appUser.user_id,
          id
        ]
      );

      await client.query("COMMIT");
      return res.status(200).json({ ok:true, data:rows[0] });
    }

    // =========================
    // DELETE QUESTION
    // =========================
    if (req.method === "DELETE") {
      if (!hasEditRights(appUser)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ ok:false, error:"Forbidden" });
      }

      await client.query(
        `delete from public.question where question_id = $1;`,
        [id]
      );

      await client.query("COMMIT");
      return res.status(204).end();
    }

    await client.query("ROLLBACK");
    return res.status(405).json({ ok:false, error:"Method not allowed" });

  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error(err);
    return res.status(500).json({ ok:false, error:"Server error" });
  } finally {
    client.release();
  }
}