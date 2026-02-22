BEGIN;

-- ============================================================
-- Seed Categories
-- ============================================================

INSERT INTO category (
  category_name,
  is_active,
  created_by,
  updated_by
)
VALUES
  (
    'Legal Framework & Authority',
    true,
    '4df9ecff-9477-4a6c-9e72-3af75d551bb3',
    '4df9ecff-9477-4a6c-9e72-3af75d551bb3'
  ),
  (
    'Real Property Valuation',
    true,
    '4df9ecff-9477-4a6c-9e72-3af75d551bb3',
    '4df9ecff-9477-4a6c-9e72-3af75d551bb3'
  ),
  (
    'Personal Property & Discovery',
    true,
    '4df9ecff-9477-4a6c-9e72-3af75d551bb3',
    '4df9ecff-9477-4a6c-9e72-3af75d551bb3'
  ),
  (
    'Cadastral Operations',
    true,
    '4df9ecff-9477-4a6c-9e72-3af75d551bb3',
    '4df9ecff-9477-4a6c-9e72-3af75d551bb3'
  )
ON CONFLICT (category_name) DO NOTHING;


-- ============================================================
-- Seed Domains
-- ============================================================

-- Legal Framework & Authority
INSERT INTO domain (
  category_id,
  domain_name,
  is_active,
  created_by,
  updated_by
)
SELECT
  c.category_id,
  d.domain_name,
  true,
  '4df9ecff-9477-4a6c-9e72-3af75d551bb3',
  '4df9ecff-9477-4a6c-9e72-3af75d551bb3'
FROM category c
CROSS JOIN (
  VALUES
    ('Constitutional & Statutory Mandates (Art. 10 & Title 68)'),
    ('Administrative & Case Law (OTC Rules, AG Opinions, Court Rulings)'),
    ('Assessment Administration (Exemptions, Assessment Caps, Tax Roll Calendar, Public Records)')
) AS d(domain_name)
WHERE c.category_name = 'Legal Framework & Authority'
ON CONFLICT (domain_name) DO NOTHING;


-- Real Property Valuation
INSERT INTO domain (
  category_id,
  domain_name,
  is_active,
  created_by,
  updated_by
)
SELECT
  c.category_id,
  d.domain_name,
  true,
  '4df9ecff-9477-4a6c-9e72-3af75d551bb3',
  '4df9ecff-9477-4a6c-9e72-3af75d551bb3'
FROM category c
CROSS JOIN (
  VALUES
    ('Residential Valuation (Mass Appraisal, Sales Comparison, Neighborhood Modeling)'),
    ('Commercial & Industrial Valuation (Income Approach, Cost Approach, Depreciation)'),
    ('Agricultural Land Productivity (Soil Classification, Use-Value Methodology, Cash Rent Analysis)')
) AS d(domain_name)
WHERE c.category_name = 'Real Property Valuation'
ON CONFLICT (domain_name) DO NOTHING;


-- Personal Property & Discovery
INSERT INTO domain (
  category_id,
  domain_name,
  is_active,
  created_by,
  updated_by
)
SELECT
  c.category_id,
  d.domain_name,
  true,
  '4df9ecff-9477-4a6c-9e72-3af75d551bb3',
  '4df9ecff-9477-4a6c-9e72-3af75d551bb3'
FROM category c
CROSS JOIN (
  VALUES
    ('Business Personal Property (Renditions, Auditing, Asset Classification, Schedules)'),
    ('Specialized Assets (Oil & Gas Equipment, Manufactured Housing, 5-Year Manufacturing Exemptions)')
) AS d(domain_name)
WHERE c.category_name = 'Personal Property & Discovery'
ON CONFLICT (domain_name) DO NOTHING;


-- Cadastral Operations
INSERT INTO domain (
  category_id,
  domain_name,
  is_active,
  created_by,
  updated_by
)
SELECT
  c.category_id,
  d.domain_name,
  true,
  '4df9ecff-9477-4a6c-9e72-3af75d551bb3',
  '4df9ecff-9477-4a6c-9e72-3af75d551bb3'
FROM category c
CROSS JOIN (
  VALUES
    ('Mapping & Legal Descriptions (Metes & Bounds, STR, Platting, Parcel Identification)'),
    ('GIS & Data Integration (Spatial/Database Connectivity & Acreage Reconciliation)')
) AS d(domain_name)
WHERE c.category_name = 'Cadastral Operations'
ON CONFLICT (domain_name) DO NOTHING;

COMMIT;