/* ============================================================
   OK-VAL BOOTSTRAP v0
   Purpose:
     - Create Postgres roles (owner/editor/readonly/app)
     - Create minimal identity tables
     - Insert Jonathan as first app_user
     - Backfill audit fields
     - Enforce created_by/updated_by NOT NULL going forward

   NOTES:
     - Replace passwords + your Clerk user id + email + name
     - Run as a Neon role that can CREATE ROLE / CREATE TABLE (e.g., neondb_owner)
   ============================================================ */

BEGIN;

-- 0) Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Postgres roles (DB-level principals)
--    Replace the passwords. You can also omit PASSWORD and set it later if you prefer.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'okval_owner') THEN
    CREATE ROLE okval_owner LOGIN PASSWORD 'REPLACE_ME_OWNER_PASSWORD';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'okval_editor') THEN
    CREATE ROLE okval_editor LOGIN PASSWORD 'REPLACE_ME_EDITOR_PASSWORD';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'okval_readonly') THEN
    CREATE ROLE okval_readonly LOGIN PASSWORD 'REPLACE_ME_READONLY_PASSWORD';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'okval_app') THEN
    CREATE ROLE okval_app LOGIN PASSWORD 'REPLACE_ME_APP_PASSWORD';
  END IF;
END $$;

-- 2) Minimal tables (audit fields TEMPORARILY nullable for bootstrap only)

-- organization_type
CREATE TABLE IF NOT EXISTS organization_type (
  organization_type_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code text NOT NULL UNIQUE,     -- 'county' | 'organization' | 'company'
  type_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL
);

-- organization
CREATE TABLE IF NOT EXISTS organization (
  organization_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name text NOT NULL UNIQUE,
  organization_type_id uuid NOT NULL REFERENCES organization_type(organization_type_id),
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL
);

-- role (application roles)
CREATE TABLE IF NOT EXISTS role (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL UNIQUE,     -- system_admin, assessor, director, supervisor, user
  role_name text NOT NULL,
  role_rank int NOT NULL,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL
);

-- app_user (Clerk-mapped)
CREATE TABLE IF NOT EXISTS app_user (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text NOT NULL,

  organization_id uuid NULL REFERENCES organization(organization_id),
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL
);

-- user_role (many-to-many, but you want one effective role per user)
CREATE TABLE IF NOT EXISTS user_role (
  user_role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES role(role_id) ON DELETE RESTRICT,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,

  UNIQUE (user_id)  -- Enforces “one effective role per user”
);

-- 3) Seed reference rows (still with null audit fields for the moment)

INSERT INTO organization_type (type_code, type_name)
VALUES
  ('county', 'County'),
  ('organization', 'Organization'),
  ('company', 'Company')
ON CONFLICT (type_code) DO NOTHING;

INSERT INTO role (role_code, role_name, role_rank)
VALUES
  ('user', 'User', 1),
  ('supervisor', 'Supervisor', 2),
  ('assessor', 'Assessor', 3),
  ('director', 'Director', 3),
  ('system_admin', 'System Admin', 99)
ON CONFLICT (role_code) DO NOTHING;

-- OPTIONAL: create your organization now (replace name if you want)
-- If you don't want to seed an org yet, you can delete this insert.
INSERT INTO organization (organization_name, organization_type_id)
SELECT
  'Beckham County Assessor',
  ot.organization_type_id
FROM organization_type ot
WHERE ot.type_code = 'county'
ON CONFLICT (organization_name) DO NOTHING;

-- 4) Insert YOU as the first user (replace these values)
-- IMPORTANT: Replace clerk_user_id with your real Clerk user id once you have it.
-- If you don’t have Clerk set up yet, you can still insert a placeholder and update later.
WITH org AS (
  SELECT organization_id FROM organization WHERE organization_name = 'Beckham County Assessor'
)
INSERT INTO app_user (clerk_user_id, email, display_name, organization_id, is_active)
VALUES (
  'REPLACE_ME_CLERK_USER_ID',
  'REPLACE_ME_EMAIL',
  'Jonathan Beck',
  (SELECT organization_id FROM org),
  true
)
ON CONFLICT (clerk_user_id) DO NOTHING;

-- 5) Backfill audit fields to your user_id
-- (Find your user_id by clerk_user_id)
WITH me AS (
  SELECT user_id FROM app_user WHERE clerk_user_id = 'REPLACE_ME_CLERK_USER_ID'
)
UPDATE organization_type
SET created_by = (SELECT user_id FROM me),
    updated_by = (SELECT user_id FROM me)
WHERE created_by IS NULL OR updated_by IS NULL;

WITH me AS (
  SELECT user_id FROM app_user WHERE clerk_user_id = 'REPLACE_ME_CLERK_USER_ID'
)
UPDATE role
SET created_by = (SELECT user_id FROM me),
    updated_by = (SELECT user_id FROM me)
WHERE created_by IS NULL OR updated_by IS NULL;

WITH me AS (
  SELECT user_id FROM app_user WHERE clerk_user_id = 'REPLACE_ME_CLERK_USER_ID'
)
UPDATE organization
SET created_by = (SELECT user_id FROM me),
    updated_by = (SELECT user_id FROM me)
WHERE created_by IS NULL OR updated_by IS NULL;

WITH me AS (
  SELECT user_id FROM app_user WHERE clerk_user_id = 'REPLACE_ME_CLERK_USER_ID'
)
UPDATE app_user
SET created_by = (SELECT user_id FROM me),
    updated_by = (SELECT user_id FROM me)
WHERE clerk_user_id = 'REPLACE_ME_CLERK_USER_ID'
  AND (created_by IS NULL OR updated_by IS NULL);

WITH me AS (
  SELECT user_id FROM app_user WHERE clerk_user_id = 'REPLACE_ME_CLERK_USER_ID'
)
UPDATE user_role
SET created_by = (SELECT user_id FROM me),
    updated_by = (SELECT user_id FROM me)
WHERE created_by IS NULL OR updated_by IS NULL;

-- 6) Now that you exist, assign you system_admin
WITH me AS (
  SELECT user_id FROM app_user WHERE clerk_user_id = 'REPLACE_ME_CLERK_USER_ID'
),
r AS (
  SELECT role_id FROM role WHERE role_code = 'system_admin'
)
INSERT INTO user_role (user_id, role_id, created_by, updated_by)
SELECT (SELECT user_id FROM me), (SELECT role_id FROM r), (SELECT user_id FROM me), (SELECT user_id FROM me)
ON CONFLICT (user_id) DO NOTHING;

-- 7) Enforce NOT NULL audit fields everywhere (bootstrap tables)
-- Add FK constraints from created_by/updated_by -> app_user(user_id) AFTER you’ve backfilled
-- (so we can keep everything strict going forward)

ALTER TABLE organization_type
  ADD CONSTRAINT organization_type_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_user(user_id),
  ADD CONSTRAINT organization_type_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_user(user_id);

ALTER TABLE organization
  ADD CONSTRAINT organization_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_user(user_id),
  ADD CONSTRAINT organization_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_user(user_id);

ALTER TABLE role
  ADD CONSTRAINT role_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_user(user_id),
  ADD CONSTRAINT role_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_user(user_id);

ALTER TABLE app_user
  ADD CONSTRAINT app_user_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_user(user_id),
  ADD CONSTRAINT app_user_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_user(user_id);

ALTER TABLE user_role
  ADD CONSTRAINT user_role_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_user(user_id),
  ADD CONSTRAINT user_role_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app_user(user_id);

-- Now make them NOT NULL
ALTER TABLE organization_type ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE organization_type ALTER COLUMN updated_by SET NOT NULL;

ALTER TABLE organization ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE organization ALTER COLUMN updated_by SET NOT NULL;

ALTER TABLE role ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE role ALTER COLUMN updated_by SET NOT NULL;

ALTER TABLE app_user ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE app_user ALTER COLUMN updated_by SET NOT NULL;

ALTER TABLE user_role ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE user_role ALTER COLUMN updated_by SET NOT NULL;

-- 8) Grants (baseline)
-- IMPORTANT: we are not creating quiz/question tables yet, so this just sets the pattern.
GRANT USAGE ON SCHEMA public TO okval_editor, okval_readonly, okval_app;

-- Readonly can select from identity tables (optional; you can tighten later)
GRANT SELECT ON organization_type, organization, role, app_user, user_role TO okval_readonly;

-- Editor can manage data in identity tables
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_type, organization, role, app_user, user_role TO okval_editor;

-- App runtime: generally needs to read identity tables (and will write quiz results later)
GRANT SELECT ON organization_type, organization, role, app_user, user_role TO okval_app;

COMMIT;