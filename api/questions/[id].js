// api/questions/[id].js
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
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const clerkUserId = authResult.toAuth().userId;

  const sql = `
    select
      u.user_id,
      coalesce(
        json_agg(
          json_build_object(
            'role_code', r.role_code
          )
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

  const { rows } = await pool.query(sql, [clerkUserId]);

  if (!rows.length) {
    return { ok: false, status: 403, error: "User not provisioned" };
  }

  return { ok: true, user: rows[0] };
}

function hasEditRights(appUser) {
  const roles = Array.isArray(appUser?.roles) ? appUser.roles : [];
  const codes = new Set(roles.map((r) => r?.role_code).filter(Boolean));
  return codes.has("db_admin") || codes.has("db_editor");
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
    if (!me.ok) return res.status(me.status).json({ ok: false, error: me.error });

    const questionId = req.query?.id;
    if (!questionId) {
      return res.status(400).json({ ok: false, error: "Missing question id" });
    }

    // -------------------------
    // PUT /api/questions/:id
    // -------------------------
    if (req.method === "PUT") {
      if (!hasEditRights(me.user)) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }

      const {
        domain_id,
        prompt,
        explanation,
        citation_text,
        difficulty,
        is_active,
        is_verified, // NEW
        choices, // optional
      } = req.body || {};

      const normalizedChoices = choices !== undefined ? normalizeChoices(choices) : null;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Verify question exists
        const exists = await client.query(
          `select question_id from public.question where question_id = $1::uuid limit 1;`,
          [questionId]
        );
        if (!exists.rows.length) {
          await client.query("ROLLBACK");
          return res.status(404).json({ ok: false, error: "Question not found" });
        }

        // ----- Partial update question -----
        const fields = [];
        const values = [];
        let idx = 1;

        if (domain_id !== undefined) {
          fields.push(`domain_id = $${idx}::uuid`);
          values.push(domain_id);
          idx++;
        }
        if (prompt !== undefined) {
          fields.push(`prompt = $${idx}::text`);
          values.push(prompt);
          idx++;
        }
        if (explanation !== undefined) {
          fields.push(`explanation = $${idx}::text`);
          values.push(explanation);
          idx++;
        }
        if (citation_text !== undefined) {
          fields.push(`citation_text = $${idx}::text`);
          values.push(citation_text);
          idx++;
        }
        if (difficulty !== undefined) {
          fields.push(`difficulty = $${idx}::smallint`);
          values.push(difficulty);
          idx++;
        }
        if (is_active !== undefined) {
          fields.push(`is_active = $${idx}::boolean`);
          values.push(Boolean(is_active));
          idx++;
        }

        // Verification stamping logic
        if (is_verified !== undefined) {
          const v = Boolean(is_verified);
          fields.push(`is_verified = $${idx}::boolean`);
          values.push(v);
          idx++;

          if (v) {
            fields.push(`verified_by = $${idx}::uuid`);
            values.push(me.user.user_id);
            idx++;
            fields.push(`verified_at = now()`);
          } else {
            fields.push(`verified_by = null`);
            fields.push(`verified_at = null`);
          }
        }

        // Always update audit fields
        fields.push(`updated_by = $${idx}::uuid`);
        values.push(me.user.user_id);
        idx++;
        fields.push(`updated_at = now()`);

        if (fields.length) {
          values.push(questionId);
          const updateSql = `
            update public.question
            set ${fields.join(", ")}
            where question_id = $${idx}::uuid
            returning *;
          `;
          await client.query(updateSql, values);
        }

        // ----- Replace choices (if provided) -----
        if (normalizedChoices) {
          await client.query(`delete from public.choice where question_id = $1::uuid;`, [
            questionId,
          ]);

          const insertSql = `
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
              is_correct;
          `;

          for (const c of normalizedChoices) {
            await client.query(insertSql, [
              questionId,
              c.choice_label,
              c.choice_text,
              c.is_correct,
              me.user.user_id,
              me.user.user_id,
            ]);
          }
        }

        await client.query("COMMIT");

        // Return updated question + choices
        const out = await pool.query(
          `
          select
            q.question_id,
            q.prompt,
            q.explanation,
            q.citation_text,
            q.difficulty,
            q.is_active,
            q.is_verified,
            q.verified_by,
            q.verified_at,
            q.domain_id,
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
            ) as choices
          from public.question q
          left join public.choice ch on ch.question_id = q.question_id
          where q.question_id = $1::uuid
          group by q.question_id
          limit 1;
          `,
          [questionId]
        );

        return res.status(200).json({ ok: true, data: out.rows[0] });
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        return res.status(400).json({ ok: false, error: err.message || "Update failed" });
      } finally {
        client.release();
      }
    }

    // -------------------------
    // DELETE /api/questions/:id (SOFT)
    // -------------------------
    if (req.method === "DELETE") {
      if (!hasEditRights(me.user)) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }

      const sql = `
        update public.question
        set
          is_active = false,
          updated_by = $1::uuid,
          updated_at = now()
        where question_id = $2::uuid
        returning question_id;
      `;

      const { rows } = await pool.query(sql, [me.user.user_id, questionId]);

      if (!rows.length) {
        return res.status(404).json({ ok: false, error: "Question not found" });
      }

      return res.status(200).json({ ok: true, data: { question_id: rows[0].question_id } });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("api/questions/[id] error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}