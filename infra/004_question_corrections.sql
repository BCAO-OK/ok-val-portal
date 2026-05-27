-- Question corrections identified during manual review
-- Apply with: psql <connection_string> -f 004_question_corrections.sql

BEGIN;

-- ============================================================
-- Fix 1 (line 9 in questionpool.txt)
-- Q: "Which body has constitutional authority to equalize assessments among the counties?"
-- Error: Answer was C (County Board of Equalization), which equalizes WITHIN a county.
--        Correct answer is B (State Board of Equalization), which equalizes AMONG counties.
-- ============================================================

UPDATE public.choice c
SET is_correct = (c.choice_label = 'B')
FROM public.question q
WHERE c.question_id = q.question_id
  AND q.prompt = 'Which body has constitutional authority to equalize assessments among the counties?'
  AND c.choice_label IN ('B', 'C');

UPDATE public.question
SET
  explanation  = 'The State Board of Equalization has constitutional authority to equalize assessments among the counties.',
  citation_text = 'Okla. Const. Art. 10 § 21; 68 O.S. § 2864',
  updated_at   = now()
WHERE prompt = 'Which body has constitutional authority to equalize assessments among the counties?';


-- ============================================================
-- Fix 2 (line 51 in questionpool.txt)
-- Q: "The additional homestead exemption for certain low income seniors..."
-- Errors: (1) Exemption is not limited to seniors — available to qualifying low-income
--             property owners generally.
--         (2) Answer was C ($2,000 — the combined total); correct additional amount is
--             $1,000 (choice B) per 68 O.S. § 2890.1.
-- ============================================================

UPDATE public.choice c
SET is_correct = (c.choice_label = 'B')
FROM public.question q
WHERE c.question_id = q.question_id
  AND q.prompt = 'The additional homestead exemption for certain low income seniors reduces assessed value by up to what amount?'
  AND c.choice_label IN ('B', 'C');

UPDATE public.question
SET
  prompt        = 'The additional homestead exemption for qualifying low income property owners reduces assessed value by up to what amount?',
  explanation   = 'Qualifying low income property owners may receive an additional homestead exemption of $1,000 of assessed valuation.',
  updated_at    = now()
WHERE prompt = 'The additional homestead exemption for certain low income seniors reduces assessed value by up to what amount?';


-- ============================================================
-- Fix 3 (line 254 in questionpool.txt)
-- Q: "If assessments are progressive across value ranges the price related differential will generally be what?"
-- Error: Answer was C (Greater than accepted standards), which describes REGRESSIVITY.
--        For PROGRESSIVE assessments (higher-value properties over-assessed), PRD falls
--        BELOW 1.00 — the explanation itself states "below suggests progressivity concerns."
--        Correct answer is A (Less than 1.00).
-- ============================================================

UPDATE public.choice c
SET is_correct = (c.choice_label = 'A')
FROM public.question q
WHERE c.question_id = q.question_id
  AND q.prompt = 'If assessments are progressive across value ranges the price related differential will generally be what?'
  AND c.choice_label IN ('A', 'C');

UPDATE public.question
SET
  explanation  = 'For progressive assessments the price related differential typically falls below 1.00 as higher-value properties are relatively over-assessed compared to lower-value properties.',
  updated_at   = now()
WHERE prompt = 'If assessments are progressive across value ranges the price related differential will generally be what?';


-- ============================================================
-- Fix 4 (line 395 in questionpool.txt)
-- Q: "What is the statutory deadline for filing a business personal property rendition without penalty?"
-- Error: Answer was C (April 1). The deadline under 68 O.S. § 2836 is March 15,
--        consistent with Legal Framework questions (lines 59, 136). April 1 is the
--        assessor's change-of-value notice deadline, not the rendition deadline.
--        Correct answer is B (March 15).
-- ============================================================

UPDATE public.choice c
SET is_correct = (c.choice_label = 'B')
FROM public.question q
WHERE c.question_id = q.question_id
  AND q.prompt = 'What is the statutory deadline for filing a business personal property rendition without penalty?'
  AND c.choice_label IN ('B', 'C');

UPDATE public.question
SET
  explanation  = 'Business personal property renditions must be filed by March 15 each year without incurring a late filing penalty.',
  updated_at   = now()
WHERE prompt = 'What is the statutory deadline for filing a business personal property rendition without penalty?';


-- ============================================================
-- Fix 5 (line 419 in questionpool.txt)
-- Q: "If a taxpayer files a late rendition after April 1 but before May 1..."
-- Error: Question used April 1 as the penalty threshold. The correct deadline is
--        March 15, so the relevant late-filing window is March 15 – April 15.
--        Answer B (statutory percentage penalty) is unchanged.
-- ============================================================

UPDATE public.question
SET
  prompt       = 'If a taxpayer files a late rendition after March 15 but before April 15 what penalty typically applies?',
  explanation  = 'A statutory penalty is added when a rendition is filed after the March 15 deadline.',
  updated_at   = now()
WHERE prompt = 'If a taxpayer files a late rendition after April 1 but before May 1 what penalty typically applies?';


-- ============================================================
-- Fix 6 (line 8 in questionpool.txt)
-- Q: "Which class of property is constitutionally limited to assessment at 10% of fair cash value?"
-- Error: No property class in Oklahoma is assessed at "10% of fair cash value."
--        Agricultural land is assessed at 11% of USE VALUE — a fundamentally
--        different standard of value. The "10% FCV equivalent" explanation is
--        not grounded in any statute and would mislead practitioners who know
--        ag land uses productivity-based use value methodology.
-- ============================================================

UPDATE public.question
SET
  prompt      = 'Under the Oklahoma Constitution which class of property must be assessed based on its agricultural use value rather than fair cash value?',
  explanation = 'Agricultural land that qualifies must be assessed based on its agricultural productivity use value rather than fair cash value or speculative market price.',
  updated_at  = now()
WHERE prompt = 'Which class of property is constitutionally limited to assessment at 10% of fair cash value?';

COMMIT;


