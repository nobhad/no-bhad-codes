-- Migration 138: Hedgewitch pre-launch onboarding checklist
-- Replaces the stale generic steps on Hedgewitch's existing checklist (id=1)
-- with the curated 12-item pre-launch deliverables list. Invoice items live in
-- the Payments tab, not the checklist. Bios for Emily & Abby and copy review
-- already complete — not in this list.

UPDATE onboarding_checklists
SET welcome_text = 'Hi Emily & Abby! Here is what I need from you to launch your site. Click any item to jump straight to the right place.'
WHERE id = 1 AND client_id = 6;

DELETE FROM onboarding_steps WHERE checklist_id = 1;

INSERT INTO onboarding_steps (checklist_id, step_type, label, description, step_order, status, navigate_tab, auto_detect) VALUES
  (1, 'approve_font',     'Approve PP Cirka as heading font',                'Confirm the typeface for headings on your site.',                                                                                  0,  'pending', NULL,    0),
  (1, 'purchase_font',    'Purchase Cirka web license',                      'Once approved, buy the "Web" Variable weight license (~$40).',                                                                     1,  'pending', NULL,    0),
  (1, 'upload_headshot',  'Send headshot — Karsen',                          'Landscape, high-resolution photo. Drop in Files.',                                                                                 2,  'pending', 'files', 0),
  (1, 'upload_headshot',  'Send headshot — Sophia',                          'Landscape, high-resolution photo. Drop in Files.',                                                                                 3,  'pending', 'files', 0),
  (1, 'upload_headshot',  'Send group shot',                                 'Once fully staffed in May. Drop in Files.',                                                                                        4,  'pending', 'files', 0),
  (1, 'submit_bio',       'Send bio — Katarina',                             'A short paragraph for the team page.',                                                                                             5,  'pending', 'files', 0),
  (1, 'submit_bio',       'Send bio — Karsen',                               'A short paragraph for the team page.',                                                                                             6,  'pending', 'files', 0),
  (1, 'submit_bio',       'Send bio — Sophia',                               'A short paragraph for the team page.',                                                                                             7,  'pending', 'files', 0),
  (1, 'upload_imagery',   'Send 9 hero images',                              'One each for Home, Approach, Offerings, Team, Contact, FAQ, Careers, Resources, Gallery. Landscape, high-res.',                    8,  'pending', 'files', 0),
  (1, 'upload_imagery',   'Send 15–20 gallery photos',                       'Mix: designed gardens by season, team at work, native plants & meadows, edible gardens, before/afters.',                           9,  'pending', 'files', 0),
  (1, 'provide_info',     'Provide 14 destination URLs for Resources page',  'Replace the current placeholder links with real destinations.',                                                                    10, 'pending', NULL,    0),
  (1, 'provide_info',     'Provide blog "Coming Soon" dates',                'For the home page preview cards.',                                                                                                 11, 'pending', NULL,    0);
