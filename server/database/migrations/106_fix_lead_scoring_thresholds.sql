-- Fix lead scoring rule thresholds to match actual intake form values
-- Project type values from intake: simple-site, business-site, portfolio, e-commerce, web-app, browser-extension

-- Fix 'Business Website' rule: 'business' → 'business-site'
UPDATE lead_scoring_rules
SET threshold_value = 'business-site',
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'Business Website'
  AND field_name = 'project_type'
  AND threshold_value = 'business';

-- Fix 'Custom App' rule: 'custom' → 'web-app'
UPDATE lead_scoring_rules
SET threshold_value = 'web-app',
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'Custom App'
  AND field_name = 'project_type'
  AND threshold_value = 'custom';

-- Add timeline feasibility rules
INSERT OR IGNORE INTO lead_scoring_rules (name, field_name, operator, threshold_value, points, description)
VALUES
  ('Reasonable Timeline', 'timeline', 'in', '1-3-months,3-6-months,1-3_months,3-6_months', 15, 'Reasonable timelines suggest well-planned projects'),
  ('Rush Timeline Penalty', 'timeline', 'in', 'asap,ASAP', -10, 'Very tight timelines may indicate unrealistic expectations');

-- DOWN
UPDATE lead_scoring_rules
SET threshold_value = 'business', updated_at = CURRENT_TIMESTAMP
WHERE name = 'Business Website' AND field_name = 'project_type' AND threshold_value = 'business-site';

UPDATE lead_scoring_rules
SET threshold_value = 'custom', updated_at = CURRENT_TIMESTAMP
WHERE name = 'Custom App' AND field_name = 'project_type' AND threshold_value = 'web-app';

DELETE FROM lead_scoring_rules WHERE name IN ('Reasonable Timeline', 'Rush Timeline Penalty');
