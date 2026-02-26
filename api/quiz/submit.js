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

async function getAppUserIdFromClerk(req, client) {
  const webReq = toWebRequest(req);
  const authResult = await clerk.authenticateRequest(webReq);

  if (!authResult?.isAuthenticated) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const clerkUserId = authResult?.toAuth?.().userId || authResult?.userId;
  if (!clerkUserId) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const r = await client.query(
    `select user_id from public.app_user where clerk_user_id = $1 limit 1`,
    [clerkUserId]
  );

  if (!r.rows.length) {
    return { ok: false, status: 403, error: "NO_APP_USER" };
  }

  return { ok: true, user_id: r.rows[0].user_id };
}

function isUuid(x) {
  return typeof x === "string" && /^[0-9a-fA-F-]{36}$/.test(x);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "POST only." },
    });
  }

  const body = req.body || {};
  const domain_id = body.domain_id ?? null; // uuid or null
  const answers = Array.isArray(body.answers) ? body.answers : [];

  // Validate
  if (domain_id !== null && !isUuid(domain_id)) {
    return res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "domain_id must be a UUID or null." },
    });
  }

  if (answers.length !== 25) {
    return res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "answers must contain exactly 25 items." },
    });
  }

  for (const a of answers) {
    if (!a || !isUuid(a.question_id) || !isUuid(a.choice_id)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Each answer must include question_id and choice_id UUIDs.",
        },
      });
    }
  }

  // Ensure unique question_ids
  const questionIds = answers.map((a) => a.question_id);
  const choiceIds = answers.map((a) => a.choice_id);

  const uniqueQ = new Set(questionIds);
  if (uniqueQ.size !== 25) {
    return res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "question_id values must be unique." },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Auth -> app_user.user_id
    const auth = await getAppUserIdFromClerk(req, client);
    if (!auth.ok) {
      await client.query("rollback");
      return res.status(auth.status).json({
        ok: false,
        error: {
          code: auth.error,
          message:
            auth.error === "NO_APP_USER"
              ? "No matching app_user for signed-in Clerk user."
              : "Not authenticated.",
        },
      });
    }
    const appUserId = auth.user_id;

    // Fetch authoritative questions (exact columns you gave)
    const qRes = await client.query(
      `
      select
        question_id,
        domain_id,
        prompt,
        explanation,
        citation_text,
        difficulty
      from public.question
      where question_id = any($1::uuid[])
        and is_active = true
      `,
      [questionIds]
    );

    if (qRes.rows.length !== 25) {
      throw new Error("One or more questions not found or not active.");
    }

    const questionById = new Map(qRes.rows.map((r) => [r.question_id, r]));

    // Fetch authoritative choices (exact columns you gave)
    const cRes = await client.query(
      `
      select
        choice_id,
        question_id,
        choice_label,
        choice_text,
        is_correct
      from public.choice
      where choice_id = any($1::uuid[])
      `,
      [choiceIds]
    );

    if (cRes.rows.length !== 25) {
      throw new Error("One or more choices not found.");
    }

    const choiceById = new Map(cRes.rows.map((r) => [r.choice_id, r]));

    // Build computed rows + validate choice belongs to question
    const computed = answers.map((a, idx) => {
      const q = questionById.get(a.question_id);
      const c = choiceById.get(a.choice_id);

      if (!q) throw new Error("Question lookup failed.");
      if (!c) throw new Error("Choice lookup failed.");
      if (c.question_id !== a.question_id) {
        throw new Error("A choice_id does not belong to its question_id.");
      }

      return {
        ordinal: idx + 1,
        question_id: a.question_id,

        prompt_snapshot: q.prompt,
        explanation_snapshot: q.explanation,
        citation_text_snapshot: q.citation_text,
        domain_id_snapshot: q.domain_id,
        difficulty_snapshot: q.difficulty, // smallint NOT NULL

        chosen_choice_label: c.choice_label,
        chosen_choice_text: c.choice_text,
        is_correct: c.is_correct === true,
      };
    });

    const correctCount = computed.reduce((sum, r) => sum + (r.is_correct ? 1 : 0), 0);
    const percentScore = (correctCount * 100) / 25; // numeric 0..100

    // Insert quiz_session (status must match CHECK -> lowercase 'submitted')
    const sessIns = await client.query(
      `
      insert into public.quiz_session (
        user_id,
        domain_id,
        question_count,
        status,
        submitted_at,
        correct_count,
        percent_score,
        created_by,
        updated_by
      )
      values ($1, $2, 25, 'submitted', now(), $3, $4, $5, $5)
      returning quiz_session_id
      `,
      [appUserId, domain_id, correctCount, percentScore, appUserId]
    );

    const quizSessionId = sessIns.rows[0].quiz_session_id;

    // Insert quiz_session_question rows and capture ids for answers
    const qsRes = await client.query(
      `
      insert into public.quiz_session_question (
        quiz_session_id,
        question_id,
        prompt_snapshot,
        explanation_snapshot,
        citation_text_snapshot,
        domain_id_snapshot,
        difficulty_snapshot,
        ordinal,
        created_by,
        updated_by
      )
      select
        $1::uuid,
        qid::uuid,
        p::text,
        e::text,
        c::text,
        d::uuid,
        dif::smallint,
        o::int,
        $2::uuid,
        $2::uuid
      from unnest(
        $3::uuid[],
        $4::text[],
        $5::text[],
        $6::text[],
        $7::uuid[],
        $8::smallint[],
        $9::int[]
      ) as t(qid, p, e, c, d, dif, o)
      returning quiz_session_question_id, question_id
      `,
      [
        quizSessionId,
        appUserId,
        computed.map((r) => r.question_id),
        computed.map((r) => r.prompt_snapshot),
        computed.map((r) => r.explanation_snapshot),
        computed.map((r) => r.citation_text_snapshot),
        computed.map((r) => r.domain_id_snapshot),
        computed.map((r) => r.difficulty_snapshot),
        computed.map((r) => r.ordinal),
      ]
    );

    const sessionQuestionIdByQuestionId = new Map(
      qsRes.rows.map((r) => [r.question_id, r.quiz_session_question_id])
    );

    // Insert quiz_answer rows (table stores chosen label/text + correctness)
    for (const r of computed) {
      const qsId = sessionQuestionIdByQuestionId.get(r.question_id);
      if (!qsId) throw new Error("quiz_session_question_id mapping failed.");

      await client.query(
        `
        insert into public.quiz_answer (
          quiz_session_question_id,
          chosen_choice_label,
          chosen_choice_text,
          is_correct,
          created_by,
          updated_by
        )
        values ($1, $2, $3, $4, $5, $5)
        `,
        [qsId, r.chosen_choice_label, r.chosen_choice_text, r.is_correct, appUserId]
      );
    }

    // Insert domain scores (domain_id_snapshot is NOT NULL)
    const domainAgg = new Map(); // domain_id -> {q, c}
    for (const r of computed) {
      const key = r.domain_id_snapshot;
      const cur = domainAgg.get(key) || { question_count: 0, correct_count: 0 };
      cur.question_count += 1;
      if (r.is_correct) cur.correct_count += 1;
      domainAgg.set(key, cur);
    }

    for (const [domId, agg] of domainAgg.entries()) {
      const pct = (agg.correct_count * 100) / agg.question_count;
      await client.query(
        `
        insert into public.quiz_session_domain_score (
          quiz_session_id,
          domain_id,
          question_count,
          correct_count,
          percent_score,
          created_by,
          updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $6)
        `,
        [quizSessionId, domId, agg.question_count, agg.correct_count, pct, appUserId]
      );
    }

    // We do NOT insert quiz_session_category_score because there is no category key in public.question.
    await client.query("commit");

    return res.status(200).json({
      ok: true,
      quiz_session_id: quizSessionId,
      correct_count: correctCount,
      percent_score: percentScore,
    });
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {}
    console.error("quiz/submit error:", err);
    return res.status(500).json({
      ok: false,
      error: { code: "SERVER_ERROR", message: err?.message || "Failed to submit quiz." },
    });
  } finally {
    client.release();
  }
}