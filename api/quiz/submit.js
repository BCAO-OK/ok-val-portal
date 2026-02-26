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

async function requireClerkUserId(req) {
  const webReq = toWebRequest(req);
  const authResult = await clerk.authenticateRequest(webReq);

  if (!authResult?.isAuthenticated) {
    return { ok: false, status: 401, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const clerkUserId = authResult?.toAuth?.().userId || authResult?.userId;
  if (!clerkUserId) {
    return { ok: false, status: 401, error: { code: "UNAUTHORIZED", message: "Invalid session." } };
  }

  return { ok: true, clerkUserId };
}

/**
 * We don’t know your exact app_user column name for Clerk ID,
 * so we discover it at runtime from a safe whitelist.
 */
async function resolveAppUserId(client, clerkUserId) {
  const candidates = [
    "clerk_user_id",
    "clerk_id",
    "auth_user_id",
    "external_user_id",
    "provider_user_id",
  ];

  const { rows } = await client.query(
    `
    select column_name
    from information_schema.columns
    where table_schema='public'
      and table_name='app_user'
      and column_name = any($1::text[])
    `,
    [candidates]
  );

  const existing = rows.map((r) => r.column_name);
  if (existing.length === 0) {
    throw new Error("app_user does not have a recognized Clerk user id column.");
  }

  // Build a simple OR query across existing columns
  const where = existing.map((col, i) => `${col} = $${i + 1}`).join(" or ");
  const params = existing.map(() => clerkUserId);

  const res = await client.query(
    `select user_id from public.app_user where ${where} limit 1`,
    params
  );

  if (!res.rows.length) {
    throw new Error("No matching app_user row for current Clerk user.");
  }

  return res.rows[0].user_id;
}

function isUuid(x) {
  return typeof x === "string" && /^[0-9a-fA-F-]{36}$/.test(x);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "POST only." } });
  }

  const auth = await requireClerkUserId(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  const body = req.body || {};
  const domain_id = body.domain_id || null;
  const answers = Array.isArray(body.answers) ? body.answers : [];

  // Expect exactly 25 completed answers
  if (answers.length !== 25) {
    return res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "answers must contain exactly 25 items." },
    });
  }

  // Validate payload shape
  for (const a of answers) {
    if (!a || !isUuid(a.question_id) || !isUuid(a.choice_id)) {
      return res.status(400).json({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Each answer must include question_id and choice_id UUIDs." },
      });
    }
  }

  if (domain_id !== null && !isUuid(domain_id)) {
    return res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "domain_id must be a UUID or null." },
    });
  }

  const questionIds = answers.map((a) => a.question_id);
  const choiceIds = answers.map((a) => a.choice_id);

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Resolve app_user.user_id from Clerk
    const appUserId = await resolveAppUserId(client, auth.clerkUserId);

    // Pull authoritative question data (snapshots + scoring dimensions)
    // NOTE: This assumes public.question has these columns. If your question table uses different names, tell me and I’ll adjust.
    const qRes = await client.query(
      `
      select
        q.question_id,
        q.prompt,
        q.explanation,
        q.citation_text,
        q.domain_id,
        q.difficulty,
        q.category_id
      from public.question q
      where q.question_id = any($1::uuid[])
      `,
      [questionIds]
    );

    if (qRes.rows.length !== 25) {
      throw new Error("One or more question_id values were not found in public.question.");
    }

    const questionById = new Map(qRes.rows.map((r) => [r.question_id, r]));

    // Pull authoritative choice data (label/text/is_correct + verify choice belongs to question)
    const cRes = await client.query(
      `
      select
        c.choice_id,
        c.question_id,
        c.choice_label,
        c.choice_text,
        c.is_correct
      from public.choice c
      where c.choice_id = any($1::uuid[])
      `,
      [choiceIds]
    );

    if (cRes.rows.length !== 25) {
      throw new Error("One or more choice_id values were not found in public.choice.");
    }

    const choiceById = new Map(cRes.rows.map((r) => [r.choice_id, r]));

    // Validate choice belongs to question, compute correctness
    const computed = answers.map((a, idx) => {
      const q = questionById.get(a.question_id);
      const c = choiceById.get(a.choice_id);

      if (!q) throw new Error("Question not found during processing.");
      if (!c) throw new Error("Choice not found during processing.");
      if (c.question_id !== a.question_id) {
        throw new Error("A submitted choice_id does not belong to its question_id.");
      }

      return {
        ordinal: idx + 1,
        question_id: a.question_id,
        domain_id_snapshot: q.domain_id,
        difficulty_snapshot: q.difficulty,
        category_id: q.category_id || null,

        prompt_snapshot: q.prompt,
        explanation_snapshot: q.explanation,
        citation_text_snapshot: q.citation_text,

        choice_id: a.choice_id,
        chosen_choice_label: c.choice_label,
        chosen_choice_text: c.choice_text,
        is_correct: c.is_correct === true,
      };
    });

    const correctCount = computed.reduce((sum, x) => sum + (x.is_correct ? 1 : 0), 0);
    const percentScore = (correctCount / 25) * 100;

    // Insert quiz_session
    // status: since we only write on completion, use "SUBMITTED" (common pattern)
    const sessRes = await client.query(
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
      values ($1, $2, 25, 'SUBMITTED', now(), $3, $4, $5, $5)
      returning quiz_session_id
      `,
      [appUserId, domain_id, correctCount, percentScore, appUserId]
    );

    const quizSessionId = sessRes.rows[0].quiz_session_id;

    // Insert quiz_session_question rows and return mapping (question_id -> quiz_session_question_id)
    const ordinals = computed.map((x) => x.ordinal);
    const prompts = computed.map((x) => x.prompt_snapshot);
    const explanations = computed.map((x) => x.explanation_snapshot);
    const citations = computed.map((x) => x.citation_text_snapshot);
    const domainSnapshots = computed.map((x) => x.domain_id_snapshot);
    const difficultySnapshots = computed.map((x) => x.difficulty_snapshot);

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
        questionIds,
        prompts,
        explanations,
        citations,
        domainSnapshots,
        difficultySnapshots,
        ordinals,
      ]
    );

    const sessionQuestionIdByQuestionId = new Map(
      qsRes.rows.map((r) => [r.question_id, r.quiz_session_question_id])
    );

    // Insert quiz_answer rows
    for (const x of computed) {
      const sessionQuestionId = sessionQuestionIdByQuestionId.get(x.question_id);
      if (!sessionQuestionId) throw new Error("Failed to map quiz_session_question_id.");

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
        [
          sessionQuestionId,
          x.chosen_choice_label,
          x.chosen_choice_text,
          x.is_correct,
          appUserId,
        ]
      );
    }

    // Domain score rows (always can compute from domain_id_snapshot)
    const domainAgg = new Map();
    for (const x of computed) {
      const key = x.domain_id_snapshot;
      if (!key) continue;
      const cur = domainAgg.get(key) || { question_count: 0, correct_count: 0 };
      cur.question_count += 1;
      if (x.is_correct) cur.correct_count += 1;
      domainAgg.set(key, cur);
    }

    for (const [domId, agg] of domainAgg.entries()) {
      const pct = (agg.correct_count / agg.question_count) * 100;
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

    // Category score rows (only if category_id exists on question and is non-null)
    const categoryAgg = new Map();
    for (const x of computed) {
      if (!x.category_id) continue;
      const cur = categoryAgg.get(x.category_id) || { question_count: 0, correct_count: 0 };
      cur.question_count += 1;
      if (x.is_correct) cur.correct_count += 1;
      categoryAgg.set(x.category_id, cur);
    }

    for (const [catId, agg] of categoryAgg.entries()) {
      const pct = (agg.correct_count / agg.question_count) * 100;
      await client.query(
        `
        insert into public.quiz_session_category_score (
          quiz_session_id,
          category_id,
          question_count,
          correct_count,
          percent_score,
          created_by,
          updated_by
        )
        values ($1, $2, $3, $4, $5, $6, $6)
        `,
        [quizSessionId, catId, agg.question_count, agg.correct_count, pct, appUserId]
      );
    }

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