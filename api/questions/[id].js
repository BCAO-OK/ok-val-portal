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

  // Must be exactly 4
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

  // Must include all 4 labels
  for (const lbl of ["A", "B", "C", "D"]) {
    if (!seen.has(lbl)) throw new Error("choices must include labels A, B, C, and D.");
  }

  const correctCount = normalized.filter((c) => c.is_correct).length;
  if (correctCount !== 1) {
    throw new Error("choices must have exactly 1 correct answer (is_correct=true).");
  }

  // Sort consistent order
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

    const questionId = req.query?.id;
    if (!questionId) {
      return res.status(400).json({ ok: false, error: "Missing question id" });
    }

    // -------------------------
    // PUT /api/questions/:id
    // Supports updating question fields AND (optionally) replacing choices
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
        choices, // optional: [{choice_label, choice_text, is_correct}, ...]
      } = req.body || {};

      const normalizedChoices = choices !== undefined ? normalizeChoices(choices) : null;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

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

        // Always update audit fields
        fields.push(`updated_by = $${idx}::uuid`);
        values.push(me.user.user_id);
        idx++;

        fields.push(`updated_at = now()`);

        let updatedQuestion = null;

        // If they provided question fields, run UPDATE.
        // If they only provided choices, we still want to ensure the question exists.
        if (fields.length > 2 /* updated_by + updated_at */) {
          values.push(questionId);
          const updateSql = `
            update public.question
            set ${fields.join(", ")}
            where question_id = $${idx}::uuid
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
          const qRes = await client.query(updateSql, values);
          if (!qRes.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ ok: false, error: "Question not found" });
          }
          updatedQuestion = qRes.rows[0];
        } else {
          // No question fields provided; just verify it exists
          const existsRes = await client.query(
            `select question_id from public.question where question_id = $1::uuid limit 1;`,
            [questionId]
          );
          if (!existsRes.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ ok: false, error: "Question not found" });
          }
        }

        // ----- Replace choices (if provided) -----
        let updatedChoices = null;
        if (normalizedChoices) {
          // Hard replace the set of choices for audit clarity
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
              is_correct,
              created_at,
              updated_at,
              created_by,
              updated_by;
          `;

          const inserted = [];
          for (const c of normalizedChoices) {
            const r = await client.query(insertSql, [
              questionId,
              c.choice_label,
              c.choice_text,
              c.is_correct,
              me.user.user_id,
              me.user.user_id,
            ]);
            inserted.push(r.rows[0]);
          }

          // Return in A-D order
          inserted.sort((a, b) => a.choice_label.localeCompare(b.choice_label));
          updatedChoices = inserted;
        }

        await client.query("COMMIT");

        // If we didn't update question fields, fetch full row for response consistency
        if (!updatedQuestion) {
          const { rows } = await pool.query(
            `
            select
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
              updated_by
            from public.question
            where question_id = $1::uuid
            limit 1;
            `,
            [questionId]
          );
          updatedQuestion = rows[0] || null;
        }

        return res.status(200).json({
          ok: true,
          data: {
            question: updatedQuestion,
            choices: updatedChoices, // null if not provided in request
          },
        });
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch { }
        // Common: unique constraint for "one correct" or (question_id, choice_label)
        return res.status(400).json({ ok: false, error: err.message || "Update failed" });
      } finally {
        client.release();
      }
    }

    // -------------------------
    // DELETE /api/questions/:id
    // soft delete -> question.is_active=false
    // -------------------------
    if (req.method === "DELETE") {
      if (!hasEditRights(me.user)) {
        return res.status(403).json({ ok: false, error: "Forbidden" });
      }

      const deleteSql = `
        update public.question
        set
          is_active = false,
          updated_by = $1::uuid,
          updated_at = now()
        where question_id = $2::uuid
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

      const { rows } = await pool.query(deleteSql, [me.user.user_id, questionId]);

      if (!rows.length) {
        return res.status(404).json({ ok: false, error: "Question not found" });
      }

      return res.status(200).json({ ok: true, data: rows[0] });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("api/questions/[id] error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
