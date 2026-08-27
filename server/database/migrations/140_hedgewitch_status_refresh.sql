-- Migration 140: Hedgewitch portal status refresh (post hand-off, 2026-08-25)
--
-- The portal still showed the April picture: 60% complete, an estimated end
-- date four months in the past, three open milestones that are done, twelve
-- pending checklist items most of which were delivered, and six duplicate
-- draft invoices auto-generated against installments that were never marked
-- paid. This brings client_id=6 / project_id=7 in line with reality.
--
-- Rows are matched by label / invoice_number rather than id, since the
-- production ids from migration 138 may differ from local.

-- ---------------------------------------------------------------------------
-- 1. Project — build complete, awaiting launch (domain repoint + noindex off)
-- ---------------------------------------------------------------------------

UPDATE projects
SET status                     = 'in-review',
    progress                   = 95,
    project_health             = 'on_track',
    estimated_end_date         = '2026-09-30',
    staging_url                = 'https://hedgewitch.netlify.app',
    hourly_rate                = 150,
    maintenance_tier           = 'essential',
    maintenance_status         = 'active',
    maintenance_start_date     = '2026-08-25',
    maintenance_included_months = 12,
    maintenance_included_until = '2027-07-24',
    health_notes               = 'Build complete and handed off 2026-08-25. Launch pending: remove the site-wide noindex header, repoint DNS from Squarespace, verify form notifications. Maintenance year (Essential, $500) runs to 2027-07-24 and lapses by default.',
    updated_at                 = datetime('now')
WHERE id = 7 AND client_id = 6;

-- ---------------------------------------------------------------------------
-- 2. Milestones — Design and Content Integration closed at hand-off
-- ---------------------------------------------------------------------------

UPDATE milestones
SET due_date       = '2026-06-30',
    completed_date = '2026-08-25',
    is_completed   = 1,
    status         = 'completed',
    updated_at     = datetime('now')
WHERE project_id = 7 AND title = 'Design';

UPDATE milestones
SET due_date       = '2026-08-25',
    completed_date = '2026-08-25',
    is_completed   = 1,
    status         = 'completed',
    updated_at     = datetime('now')
WHERE project_id = 7 AND title = 'Content Integration';

UPDATE milestones
SET due_date   = '2026-09-30',
    status     = 'in_progress',
    updated_at = datetime('now')
WHERE project_id = 7 AND title = 'Testing & Launch';

UPDATE milestones
SET status = 'completed', updated_at = datetime('now')
WHERE project_id = 7 AND is_completed = 1 AND status <> 'completed';

-- ---------------------------------------------------------------------------
-- 3. Onboarding checklist — mark what arrived, drop what no longer applies
-- ---------------------------------------------------------------------------

-- Delivered: headshots, group shot, hero art, gallery photos, resource links.
UPDATE onboarding_steps
SET status       = 'completed',
    completed_at = '2026-08-25 00:00:00',
    updated_at   = datetime('now')
WHERE checklist_id = 1
  AND label IN (
    'Send headshot — Karsen',
    'Send headshot — Sophia',
    'Send group shot',
    'Send 9 hero images',
    'Send 15–20 gallery photos',
    'Provide 14 destination URLs for Resources page'
  );

-- Obsolete: the type direction moved off PP Cirka (Otto Attack / Della Respira
-- / Spectral / Manrope shipped), and the home blog preview no longer carries
-- dated "Coming Soon" cards.
DELETE FROM onboarding_steps
WHERE checklist_id = 1
  AND label IN (
    'Approve PP Cirka as heading font',
    'Purchase Cirka web license',
    'Provide blog "Coming Soon" dates'
  );

-- Still outstanding, and one new item: two partner orgs on the Resources page
-- are still placeholders with url "#".
INSERT INTO onboarding_steps
  (checklist_id, step_type, label, description, step_order, status, navigate_tab, auto_detect)
VALUES
  (1, 'provide_info', 'Send details for 2 partner organizations',
   'The Resources page still has two placeholder partners. For each: real organization name, website URL, a one-line description, and a logo.',
   3, 'pending', 'files', 0);

UPDATE onboarding_steps SET step_order = 0 WHERE checklist_id = 1 AND label = 'Send bio — Katarina';
UPDATE onboarding_steps SET step_order = 1 WHERE checklist_id = 1 AND label = 'Send bio — Karsen';
UPDATE onboarding_steps SET step_order = 2 WHERE checklist_id = 1 AND label = 'Send bio — Sophia';
UPDATE onboarding_steps SET step_order = 4 WHERE checklist_id = 1 AND label = 'Send headshot — Karsen';
UPDATE onboarding_steps SET step_order = 5 WHERE checklist_id = 1 AND label = 'Send headshot — Sophia';
UPDATE onboarding_steps SET step_order = 6 WHERE checklist_id = 1 AND label = 'Send group shot';
UPDATE onboarding_steps SET step_order = 7 WHERE checklist_id = 1 AND label = 'Send 9 hero images';
UPDATE onboarding_steps SET step_order = 8 WHERE checklist_id = 1 AND label = 'Send 15–20 gallery photos';
UPDATE onboarding_steps SET step_order = 9 WHERE checklist_id = 1 AND label = 'Provide 14 destination URLs for Resources page';

UPDATE onboarding_checklists
SET welcome_text = 'Hi Emily & Abby! The site is built and handed off — thank you for everything you have sent so far. These are the last few pieces I need from you.'
WHERE id = 1 AND client_id = 6;

-- ---------------------------------------------------------------------------
-- 4. Payment schedule — installments 2-4 were left "overdue" while their
--    invoices were marked paid. That mismatch is what spawned the duplicate
--    drafts, and it is what keeps flagging the account as at risk.
-- ---------------------------------------------------------------------------

UPDATE payment_schedule_installments
SET status         = 'paid',
    paid_date      = (SELECT paid_date FROM invoices i WHERE i.id = payment_schedule_installments.invoice_id),
    paid_amount    = amount,
    payment_method = 'check',
    updated_at     = datetime('now')
WHERE project_id = 7
  AND status <> 'paid'
  AND invoice_id IN (SELECT id FROM invoices WHERE project_id = 7 AND status = 'paid');

INSERT INTO invoice_payments (invoice_id, amount, payment_method, payment_date, notes, status, paid_at)
SELECT i.id, i.amount_paid, 'check', i.paid_date, i.notes, 'succeeded', i.paid_date
FROM invoices i
WHERE i.project_id = 7
  AND i.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM invoice_payments p WHERE p.invoice_id = i.id);

-- ---------------------------------------------------------------------------
-- 5. Remove the six duplicate drafts (auto-generated re-bills of the four
--    installments above; $1,125 each, none sent, none paid)
-- ---------------------------------------------------------------------------

DELETE FROM invoice_line_items
WHERE invoice_id IN (
  SELECT id FROM invoices
  WHERE project_id = 7 AND status = 'draft' AND notes LIKE 'Auto-generated from payment schedule%'
);

DELETE FROM invoices
WHERE project_id = 7 AND status = 'draft' AND notes LIKE 'Auto-generated from payment schedule%';

-- ---------------------------------------------------------------------------
-- 6. Hero plate redesign — agreed on the hand-off call as design work,
--    quoted at 2 hours. Left in draft to go out with the follow-up email.
-- ---------------------------------------------------------------------------

INSERT INTO invoices
  (invoice_number, project_id, client_id, subtotal, amount_total, amount_paid,
   currency, status, issued_date, due_date, invoice_type, notes, terms)
VALUES
  ('INV-202608-HH005', 7, 6, 300, 300, 0,
   'USD', 'draft', NULL, NULL, 'standard',
   'Hero plate redesign — agreed 2026-08-25 as design work, quoted at 2 hours.',
   'Payment due within 14 days of receipt.');

INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, amount, sort_order)
SELECT id,
       'Hero plate redesign — dark rose plate, brown-edged wordmark, contrast verification (design work)',
       2, 150, 300, 0
FROM invoices WHERE invoice_number = 'INV-202608-HH005';

-- ---------------------------------------------------------------------------
-- 7. Client-visible timeline — nothing since "Project Created" in January
-- ---------------------------------------------------------------------------

INSERT INTO project_updates (project_id, title, description, update_type, created_at)
VALUES
  (7, 'Build complete — hand-off call',
   'All twelve pages built, tested and handed off on the 2026-08-25 call, with the user guide and hand-off checklist delivered. The full site is reviewable at hedgewitch.netlify.app.',
   'milestone', '2026-08-25 14:00:00'),
  (7, 'Launch prep underway',
   'Remaining steps to go live: lift the search-engine block on the preview build, point hedgewitchhorticulture.com at the new site, and confirm contact and careers form notifications arrive in your inbox.',
   'general', datetime('now'));
