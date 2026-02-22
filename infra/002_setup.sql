BEGIN;

-- ============================================================
-- 0) updated_at trigger (applies to every table)
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- Helper to attach trigger if missing
DO $$
DECLARE
  t text;
BEGIN
  -- We'll attach triggers after tables are created below.
END $$;


-- ============================================================
-- 1) Category / Domain (configurable)
-- ============================================================
CREATE TABLE IF NOT EXISTS category (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(user_id),
  updated_by uuid NOT NULL REFERENCES app_user(user_id)
);

CREATE TABLE IF NOT EXISTS domain (
  domain_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES category(category_id) ON DELETE RESTRICT,
  domain_name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(user_id),
  updated_by uuid NOT NULL REFERENCES app_user(user_id)
);

CREATE INDEX IF NOT EXISTS ix_domain_category_id ON domain(category_id);


-- ============================================================
-- 2) Question bank (global)
--    - single citation_text field (your decision)
--    - difficulty 1..3
--    - no tags
-- ============================================================
CREATE TABLE IF NOT EXISTS question (
  question_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES domain(domain_id) ON DELETE RESTRICT,

  prompt text NOT NULL,
  explanation text NOT NULL,
  citation_text text NOT NULL,

  difficulty smallint NOT NULL CHECK (difficulty between 1 and 3),
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(user_id),
  updated_by uuid NOT NULL REFERENCES app_user(user_id)
);

CREATE INDEX IF NOT EXISTS ix_question_domain_id ON question(domain_id);
CREATE INDEX IF NOT EXISTS ix_question_active ON question(is_active);


-- ============================================================
-- 3) Choices (exactly 4 per question, 1 correct)
--    We enforce:
--      - choices are labeled A-D (prevents more than 4)
--      - exactly one correct (partial unique index)
-- ============================================================
CREATE TABLE IF NOT EXISTS choice (
  choice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES question(question_id) ON DELETE CASCADE,

  choice_label text NOT NULL CHECK (choice_label IN ('A','B','C','D')),
  choice_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(user_id),
  updated_by uuid NOT NULL REFERENCES app_user(user_id),

  UNIQUE (question_id, choice_label)
);

CREATE INDEX IF NOT EXISTS ix_choice_question_id ON choice(question_id);

-- Exactly one correct choice per question
CREATE UNIQUE INDEX IF NOT EXISTS ux_choice_one_correct
  ON choice(question_id)
  WHERE (is_correct);

-- NOTE: This design prevents >4 options.
-- It doesn't force all 4 to exist at DB level; we’ll enforce “must have A-D” in your loading workflow.


-- ============================================================
-- 4) Quiz sessions (locked at start; abandoned logic)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_session (
  quiz_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,

  -- null = "All Domains", else domain quiz
  domain_id uuid NULL REFERENCES domain(domain_id) ON DELETE RESTRICT,

  question_count int NOT NULL DEFAULT 25 CHECK (question_count = 25),

  status text NOT NULL CHECK (status IN ('in_progress','submitted','abandoned')),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz NULL,

  correct_count int NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  percent_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (percent_score >= 0 AND percent_score <= 100),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(user_id),
  updated_by uuid NOT NULL REFERENCES app_user(user_id)
);

CREATE INDEX IF NOT EXISTS ix_quiz_session_user_started
  ON quiz_session(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS ix_quiz_session_status
  ON quiz_session(status);


-- ============================================================
-- 5) Locked questions per session (snapshots stored)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_session_question (
  quiz_session_question_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id uuid NOT NULL REFERENCES quiz_session(quiz_session_id) ON DELETE CASCADE,

  question_id uuid NOT NULL REFERENCES question(question_id) ON DELETE RESTRICT,

  -- Snapshots (preserve history if question later changes)
  prompt_snapshot text NOT NULL,
  explanation_snapshot text NOT NULL,
  citation_text_snapshot text NOT NULL,
  domain_id_snapshot uuid NOT NULL REFERENCES domain(domain_id) ON DELETE RESTRICT,
  difficulty_snapshot smallint NOT NULL CHECK (difficulty_snapshot between 1 and 3),

  ordinal int NOT NULL CHECK (ordinal between 1 and 25),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(user_id),
  updated_by uuid NOT NULL REFERENCES app_user(user_id),

  UNIQUE (quiz_session_id, ordinal)
);

CREATE INDEX IF NOT EXISTS ix_qsq_session
  ON quiz_session_question(quiz_session_id);

CREATE INDEX IF NOT EXISTS ix_qsq_question
  ON quiz_session_question(question_id);


-- ============================================================
-- 6) Answers (store chosen label + chosen text snapshot)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_answer (
  quiz_answer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_question_id uuid NOT NULL REFERENCES quiz_session_question(quiz_session_question_id) ON DELETE CASCADE,

  chosen_choice_label text NOT NULL CHECK (chosen_choice_label IN ('A','B','C','D')),
  chosen_choice_text text NOT NULL,
  is_correct boolean NOT NULL,

  answered_at timestamptz NOT NULL DEFAULT now(),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(user_id),
  updated_by uuid NOT NULL REFERENCES app_user(user_id),

  UNIQUE (quiz_session_question_id)
);

CREATE INDEX IF NOT EXISTS ix_quiz_answer_session_question
  ON quiz_answer(quiz_session_question_id);


-- ============================================================
-- 7) Stored scoring breakdowns (your decision: store counts + percent)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_session_domain_score (
  quiz_session_domain_score_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id uuid NOT NULL REFERENCES quiz_session(quiz_session_id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES domain(domain_id) ON DELETE RESTRICT,

  question_count int NOT NULL CHECK (question_count >= 0),
  correct_count int NOT NULL CHECK (correct_count >= 0),
  percent_score numeric(5,2) NOT NULL CHECK (percent_score >= 0 AND percent_score <= 100),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(user_id),
  updated_by uuid NOT NULL REFERENCES app_user(user_id),

  UNIQUE (quiz_session_id, domain_id)
);

CREATE TABLE IF NOT EXISTS quiz_session_category_score (
  quiz_session_category_score_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id uuid NOT NULL REFERENCES quiz_session(quiz_session_id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES category(category_id) ON DELETE RESTRICT,

  question_count int NOT NULL CHECK (question_count >= 0),
  correct_count int NOT NULL CHECK (correct_count >= 0),
  percent_score numeric(5,2) NOT NULL CHECK (percent_score >= 0 AND percent_score <= 100),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES app_user(user_id),
  updated_by uuid NOT NULL REFERENCES app_user(user_id),

  UNIQUE (quiz_session_id, category_id)
);


-- ============================================================
-- 8) Attach updated_at triggers
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'category','domain','question','choice',
        'quiz_session','quiz_session_question','quiz_answer',
        'quiz_session_domain_score','quiz_session_category_score'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;', r.tablename, r.tablename);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
                   r.tablename, r.tablename);
  END LOOP;
END $$;


-- ============================================================
-- 9) GRANTS (this is the important governance piece)
-- ============================================================
GRANT USAGE ON SCHEMA public TO okval_editor, okval_readonly, okval_app;

-- Readonly: can read everything
GRANT SELECT ON
  organization_type, organization, app_user, role, user_role,
  category, domain, question, choice,
  quiz_session, quiz_session_question, quiz_answer,
  quiz_session_domain_score, quiz_session_category_score
TO okval_readonly;

-- Editor: can edit everything (humans with editor+ manage question bank via Neon)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organization_type, organization, app_user, role, user_role,
  category, domain, question, choice,
  quiz_session, quiz_session_question, quiz_answer,
  quiz_session_domain_score, quiz_session_category_score
TO okval_editor;

-- App: IMPORTANT
-- - App can read identity + reference + question bank
-- - App can write quiz sessions & results
-- - App CANNOT modify question bank (question/choice)
GRANT SELECT ON
  organization_type, organization, app_user, role, user_role,
  category, domain,
  question, choice
TO okval_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  quiz_session, quiz_session_question, quiz_answer,
  quiz_session_domain_score, quiz_session_category_score
TO okval_app;

COMMIT;