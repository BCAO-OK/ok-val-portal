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

async function requireAuth(req) {
  const webReq = toWebRequest(req);
  const authResult = await clerk.authenticateRequest(webReq);

  if (!authResult?.isAuthenticated) {
    return {
      ok: false,
      status: 401,
      error: { code: "UNAUTHORIZED", message: "Sign in required." },
    };
  }

  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "GET only." } });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  const { domain_id } = req.query;

  try {
    const params = [];
    let whereClause = "";

    if (domain_id) {
      params.push(domain_id);
      whereClause = `where q.domain_id = $1`;
    }

    // Pull enough rows to form 25 questions (each question has 4 choices)
    // We’ll randomize questions by ordering question_id in a random subquery.
    const { rows } = await pool.query(
      `
      with qpick as (
        select q.question_id
        from public.question q
        ${whereClause}
        order by random()
        limit 25
      )
      select
        q.question_id,
        q.prompt,
        q.explanation,
        q.citation_text,
        c.choice_id,
        c.choice_label,
        c.choice_text,
        c.is_correct
      from public.question q
      join qpick qp on qp.question_id = q.question_id
      join public.choice c on c.question_id = q.question_id
      order by q.question_id, c.choice_label;
      `,
      params
    );

    const questionMap = new Map();

    for (const row of rows) {
      if (!questionMap.has(row.question_id)) {
        questionMap.set(row.question_id, {
          question_id: row.question_id,
          prompt: row.prompt,
          explanation: row.explanation,
          citation_text: row.citation_text,
          choices: [],
        });
      }

      questionMap.get(row.question_id).choices.push({
        choice_id: row.choice_id,
        choice_label: row.choice_label,
        choice_text: row.choice_text,
        is_correct: row.is_correct === true,
      });
    }

    const selected = Array.from(questionMap.values());

    return res.status(200).json({
      ok: true,
      questions: selected,
    });
  } catch (err) {
    console.error("quiz/start error:", err);
    return res.status(500).json({
      ok: false,
      error: { code: "SERVER_ERROR", message: "Failed to start quiz." },
    });
  }
}