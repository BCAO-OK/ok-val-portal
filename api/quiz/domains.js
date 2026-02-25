// api/quiz/domains.js
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
    return { ok: false, status: 401, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const clerkUserId = authResult?.toAuth?.().userId || authResult?.userId;
  if (!clerkUserId) {
    return { ok: false, status: 401, error: { code: "UNAUTHORIZED", message: "Invalid session." } };
  }

  return { ok: true, clerkUserId };
}

function pickDomainLabel(row) {
  // Be resilient to column name differences without guessing your exact schema.
  return (
    row.domain_name ||
    row.domain_title ||
    row.domain_label ||
    row.name ||
    row.domain_code ||
    row.code ||
    String(row.domain_id)
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "GET only." } });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    // Fetch all domain fields; we’ll derive display text safely in JS.
    const { rows } = await pool.query(`select * from public.domain order by 1`);

    const domains = rows
      .filter((r) => !!r.domain_id)
      .map((r) => ({
        domain_id: r.domain_id,
        domain_label: pickDomainLabel(r),
      }))
      .sort((a, b) => a.domain_label.localeCompare(b.domain_label));

    return res.status(200).json({ ok: true, domains });
  } catch (err) {
    console.error("quiz/domains error:", err);
    return res.status(500).json({
      ok: false,
      error: { code: "SERVER_ERROR", message: "Failed to load domains." },
    });
  }
}