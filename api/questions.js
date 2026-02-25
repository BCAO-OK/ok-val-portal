// api/questions.js
import { createClerkClient } from "@clerk/backend";
import { pool } from "./_db.js";

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
  const codes = new Set(roles.map((r) => r.role_code));
  return codes.has("system_admin") || codes.has("director") || codes.has("assessor");
}

function normalizeChoices(choices) {
  if (!Array.isArray(choices) || choices.length !== 4) {
    throw new Error("Exactly 4 choices (A-D) required.");
  }

  const allowed = new Set(["A", "B", "C", "D"]);
  const seen = new Set();

  const normalized = choices.map((c) => {
    const label = String(c.choice_label).toUpperCase();
    if (!allowed.has(label) || seen.has(label)) {
      throw new Error("Invalid or duplicate choice_label.");
    }
    seen.add(label);

    return {
      choice_label: label,
      choice_text: String(c.choice_text),
      is_correct: Boolean(c.is_correct),
    };
  });

  if (normalized.filter((c) => c.is_correct).length !== 1) {
    throw new Error("Exactly one correct answer required.");
  }

  return normalized.sort((a, b) => a.choice_label.localeCompare(b.choice_label));
}

async function loadAppUser(client, clerkUserId) {
  const sql = `
    select
      u.user_id,
      coalesce(
        json_agg(
          json_build_object('role_code', r.role_code)
        ) filter (where r.role_code is not null),
        '[]'::json
      ) as roles
    from public.app_user u
    left join public.user_role ur on ur.user_id = u.user_id
    left join public.role r on r.role_id = ur.role_id
    where u.clerk_user_id = $1
      and u.is_active = true
    group by u.user_id
    limit 1;
  `;
  const { rows } = await client.query(sql, [clerkUserId]);
  return rows[0] || null;
}

export default async function handler(req, res) {
  const client = await pool.connect();
  try {
    // 1) Authenticate once
    const webReq = toWebRequest(req);
    const authResult = await clerk.authenticateRequest(webReq);

    if (!authResult?.isAuthenticated) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const clerkUserId = authResult.toAuth().userId;
    if (!clerkUserId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // 2) Transaction + RLS session context
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [clerkUserId]);

    // 3) Load provisioned app user + roles (now also inside the same context)
    const appUser = await loadAppUser(client, clerkUserId);
    if (!appUser) {
      await client.query("ROLLBACK");
      return res.status(403).json({ ok: false, error: "User not provisioned" });
    }

    // =========================
    // GET QUESTIONS
    // =========================
    if (req.method === "GET") {
      const {
        q = "",
        category_id = "",
        domain_id = "",
        difficulty = "",
        active = "true",
        verified = "",
        page = "1",
        pageSize = "25",
      } = req.query;

      const pageNum = Math.max(parseInt(page) || 1, 1);
      const pageSizeNum = Math.min(Math.max(parseInt(pageSize) || 25, 1), 100);
      const offset = (pageNum - 1) * pageSizeNum;

      const wantsActive = active === "true";
      const verifiedFilter =
        verified === "" ? null : verified === "true" ? true : verified === "false" ? false : null;

      const sql = `
        select
          q.question_id,
          q.prompt,
          q.explanation,
          q.citation_text,
          q.difficulty,
          q.is_active,
          q.is_verified,
          q.domain_id,
          d.domain_name,
          d.category_id,
          cat.category_name,

          coalesce(
            json_agg(
              json_build_object(
                'choice_id', ch.choice_id,
                'choice_label', ch.choice_label,
                'choice_text', ch.choice_text,
                'is_correct', ch.is_correct
              )
              order by ch.choice_label
            ) filter (where ch.choice_id is not null),
            '[]'::json
          ) as choices,

          max(case when ch.is_correct then ch.choice_label end) as correct_choice_label

        from public.question q
        join public.domain d on d.domain_id = q.domain_id
        join public.category cat on cat.category_id = d.category_id
        left join public.choice ch on ch.question_id = q.question_id

        where
          ($1 = '' or q.prompt ilike ('%'||$1||'%'))
          and ($2::uuid is null or d.category_id = $2)
          and ($3::uuid is null or q.domain_id = $3)
          and ($4::int is null or q.difficulty = $4)
          and q.is_active = $5
          and ($6::boolean is null or q.is_verified = $6)
          and d.is_active = true
          and cat.is_active = true

        group by
          q.question_id, d.domain_name, d.category_id, cat.category_name

        order by q.updated_at desc
        limit $7
        offset $8;
      `;

      const params = [
        q,
        category_id || null,
        domain_id || null,
        difficulty || null,
        wantsActive,
        verifiedFilter,
        pageSizeNum,
        offset,
      ];

      const { rows } = await client.query(sql, params);
      await client.query("COMMIT");
      return res.status(200).json({ ok: true, data: rows });
    }

    // =========================
    // CREATE QUESTION
    // =========================
    if (req.method === "POST") {
      if (!hasEditRights(appUser)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }

      const { domain_id, prompt, explanation, citation_text, difficulty, choices } = req.body;
      const normalized = normalizeChoices(choices);

      const qRes = await client.query(
        `
        insert into public.question (
          domain_id, prompt, explanation, citation_text,
          difficulty, is_active, is_verified,
          created_by, updated_by
        )
        values ($1,$2,$3,$4,$5,true,false,$6,$6)
        returning *;
        `,
        [domain_id, prompt, explanation, citation_text, difficulty, appUser.user_id]
      );

      const question = qRes.rows[0];

      for (const c of normalized) {
        await client.query(
          `
          insert into public.choice (
            question_id, choice_label, choice_text,
            is_correct, created_by, updated_by
          )
          values ($1,$2,$3,$4,$5,$5);
          `,
          [question.question_id, c.choice_label, c.choice_text, c.is_correct, appUser.user_id]
        );
      }

      await client.query("COMMIT");
      return res.status(201).json({ ok: true, data: question });
    }

    await client.query("ROLLBACK");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    try {
      // if BEGIN failed, this might throw; ignore
      await pool.query("ROLLBACK");
    } catch {}
    console.error(err);
    return res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    client.release();
  }
}