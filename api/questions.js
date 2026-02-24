// api/questions.js
import { createClerkClient } from "@clerk/backend";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

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

async function getAppUser(req) {
  const webReq = toWebRequest(req);

  const authResult = await clerk.authenticateRequest(webReq);
  if (!authResult?.isAuthenticated) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      reason: authResult?.reason || null,
    };
  }

  const auth = authResult.toAuth();
  const clerkUserId = auth.userId;

  if (!clerkUserId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  // Same user lookup as api/me.js
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

  const { rows } = await pool.query(sql, [clerkUserId]);

  if (!rows.length) {
    return {
      ok: false,
      status: 403,
      error: "User not provisioned",
      clerk_user_id: clerkUserId,
    };
  }

  return { ok: true, user: rows[0] };
}

function hasEditRights(appUser) {
  const roles = Array.isArray(appUser?.roles) ? appUser.roles : [];
  const codes = new Set(roles.map((r) => r?.role_code).filter(Boolean));
  return codes.has("system_admin") || codes.has("admin") || codes.has("editor");
}

function normalizeChoices(choices) {
  if (!Array.isArray(choices)) return null;

  if (choices.length !== 4) {
    throw new Error("choices must include exactly 4 items (A, B, C, D).");
  }

  const allowed = new Set(["A", "B", "C", "D"]);
  const seen = new Set();

  const normalized = choices.map((c) => {
    const label = String(c.choice_label || "").trim().toUpperCase();
    const text = String(c.choice_text || "").trim();
    const isCorrect = Boolean(c.is_correct);

    if (!allowed.has(label)) throw new Error("choice_label must be one of A, B, C, D.");
    if (seen.has(label)) throw new Error("Duplicate choice_label detected.");
    seen.add(label);

    if (!text) throw new Error("choice_text cannot be empty.");

    return { choice_label: label, choice_text: text, is_correct: isCorrect };
  });

  for (const lbl of ["A", "B", "C", "D"]) {
    if (!seen.has(lbl)) throw new Error("choices must include labels A, B, C, and D.");
  }

  const correctCount = normalized.filter((c) => c.is_correct).length;
  if (correctCount !== 1) {
    throw new Error("choices must have exactly 1 correct answer (is_correct=true).");
  }

  normalized.sort((a, b) => a.choice_label.localeCompare(b.choice_label));
  return normalized;
}

export default async function handler(req, res) {
  try {
    const me = await getAppUser(req);
    if (!me.ok) {
      return res
        .status(me.status)
        .json({ ok: false, error: me.error, reason: me.reason || null });
    }

    // =========================
    // GET - List questions (+ names + choices)
    // =========================
    if (req.method === "GET") {
      const {
        q = "",
        category_id = "",
        domain_id = "",
        difficulty = "",
        active = "true",
        page = "1",
        pageSize = "25",
      } = req.query;

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const pageSizeNum = Math.min(Math.max(parseInt(pageSize, 10) || 25, 1), 100);
      const offset = (pageNum - 1) * pageSizeNum;

      const wantsActive = active === "true";

      const sql = `
        select
          q.question_id,
          q.domain_id,
          d.domain_name,
          d.category_id,
          cat.category_name,

          q.prompt,
          q.explanation,
          q.citation_text,
          q.difficulty,
          q.is_active,
          q.created_at,
          q.updated_at,
          q.created_by,
          q.updated_by,

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

          max(case when ch.is_correct then ch.choice_label else null end) as correct_choice_label

        from public.question q
        join public.domain d on d.domain_id = q.domain_id
        join public.category cat on cat.category_id = d.category_id
        left join public.choice ch on ch.question_id = q.question_id

        where
          ($1::text = '' or q.prompt ilike ('%' || $1 || '%'))
          and ($2::uuid is null or d.category_id = $2::uuid)
          and ($3::uuid is null or q.domain_id = $3::uuid)
          and ($4::smallint is null or q.difficulty = $4::smallint)
          and (q.is_active = $5::boolean)
          and d.is_active = true
          and cat.is_active = true

        group by
          q.question_id,
          q.domain_id,
          d.domain_name,
          d.category_id,
          cat.category_name,
          q.prompt,
          q.explanation,
          q.citation_text,
          q.difficulty,
          q.is_active,
          q.created_at,
          q.updated_at,
          q.created_by,
          q.updated_by

        order by q.updated_at desc
        limit $6
        offset $7;
      `;

      const params = [
        q,
        category_id ? category_id : null,
        domain_id ? domain_id : null,
        difficulty ? difficulty : null,
        wantsActive,
        pageSizeNum,
        offset,
      ];

      const { rows } = await pool.query(sql, params);
      return res.status(200).json({ ok: true, data: rows });
    }

    // =========================
    // POST - Create question (+ 4 choices)
    // =========================
    if (req.method === "POST") {
      if (!hasEditRights(me.user)) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }

      const {
        domain_id,
        prompt,
        explanation,
        citation_text,
        difficulty,
        is_active = true,
        choices,
      } = req.body || {};

      if (!domain_id || !prompt || !explanation || !citation_text || !difficulty) {
        return res.status(400).json({
          ok: false,
          error:
            "Missing required fields: domain_id, prompt, explanation, citation_text, difficulty",
        });
      }

      const normalizedChoices = normalizeChoices(choices);
      if (!normalizedChoices) {
        return res.status(400).json({
          ok: false,
          error: "choices is required and must include exactly 4 items (A-D) with 1 correct.",
        });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const qSql = `
          insert into public.question (
            domain_id,
            prompt,
            explanation,
            citation_text,
            difficulty,
            is_active,
            created_by,
            updated_by
          )
          values ($1::uuid, $2::text, $3::text, $4::text, $5::smallint, $6::boolean, $7::uuid, $8::uuid)
          returning
            question_id,
            domain_id,
            prompt,
            explanation,
            citation_text,
            difficulty,
            is_active,
            created_at,
            updated_at,
            created_by,
            updated_by;
        `;

        const qParams = [
          domain_id,
          prompt,
          explanation,
          citation_text,
          difficulty,
          Boolean(is_active),
          me.user.user_id,
          me.user.user_id,
        ];

        const qRes = await client.query(qSql, qParams);
        const question = qRes.rows[0];

        const cSql = `
          insert into public.choice (
            question_id,
            choice_label,
            choice_text,
            is_correct,
            created_by,
            updated_by
          )
          values ($1::uuid, $2::text, $3::text, $4::boolean, $5::uuid, $6::uuid)
          returning
            choice_id,
            question_id,
            choice_label,
            choice_text,
            is_correct,
            created_at,
            updated_at,
            created_by,
            updated_by;
        `;

        const insertedChoices = [];
        for (const c of normalizedChoices) {
          const cRes = await client.query(cSql, [
            question.question_id,
            c.choice_label,
            c.choice_text,
            c.is_correct,
            me.user.user_id,
            me.user.user_id,
          ]);
          insertedChoices.push(cRes.rows[0]);
        }
        insertedChoices.sort((a, b) => a.choice_label.localeCompare(b.choice_label));

        await client.query("COMMIT");

        const correctChoiceLabel =
          insertedChoices.find((x) => x.is_correct)?.choice_label || null;

        return res.status(201).json({
          ok: true,
          data: {
            ...question,
            choices: insertedChoices,
            correct_choice_label: correctChoiceLabel,
          },
        });
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch { }
        return res.status(400).json({ ok: false, error: err.message || "Create failed" });
      } finally {
        client.release();
      }
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("api/questions error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
