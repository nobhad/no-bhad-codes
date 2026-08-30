-- Migration 142: Email sequence copy — first person singular
--
-- No Bhad Codes is one person. The drip-sequence copy seeded in migration 122
-- was written in the plural ("We received your inquiry", "the ways we help
-- clients like you"), which in a one-person studio reads as either a front or
-- a template nobody edited. This brings the seeded rows in line with the rest
-- of the outbound email, which moved to first person singular in the same pass.
--
-- Why a new migration and not an edit to 122: 122 is already applied, so the
-- runner will never execute it again — editing that file changes the repo and
-- nothing else. The rows it inserted have to be UPDATEd in place.
--
-- Every statement matches on the EXACT seeded text. That makes this idempotent
-- (a second run matches nothing) and, more importantly, non-destructive: if a
-- sequence step has since been reworded in the admin UI, it will not match and
-- is left exactly as it is. Nothing here overwrites edited copy.
--
-- "our conversation" and "what we discussed" are deliberately left plural —
-- those are genuinely shared between two people and are correct as written.

-- UP

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, thank you for reaching out. I got your inquiry and would love to learn more about your project. Let''s schedule a quick consultation to discuss your goals.'
WHERE body_override = 'Hi {{entity.name}}, thank you for reaching out. We received your inquiry and would love to learn more about your project. Let''s schedule a quick consultation to discuss your goals.';

UPDATE sequence_steps
SET subject_override = 'A Few Things I Can Help With'
WHERE subject_override = 'A Few Things We Can Help With';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, just wanted to share some of the ways I help clients like you. From web design to full-stack development, I tailor every project to your specific needs.'
WHERE body_override = 'Hi {{entity.name}}, just wanted to share some of the ways we help clients like you. From web design to full-stack development, we tailor every project to your specific needs.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, I haven''t heard back yet and wanted to check in. If you''re still considering your project, I''d love to chat. No pressure — just here to help when you''re ready.'
WHERE body_override = 'Hi {{entity.name}}, we haven''t heard back yet and wanted to check in. If you''re still considering your project, we''d love to chat. No pressure — just here to help when you''re ready.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, just a friendly reminder that your proposal is ready for review. Take a look when you get a chance and let me know if you have any questions.'
WHERE body_override = 'Hi {{entity.name}}, just a friendly reminder that your proposal is ready for review. Take a look when you get a chance and let us know if you have any questions.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, I noticed you haven''t had a chance to review your proposal yet. I''m happy to walk through it with you or make adjustments if needed.'
WHERE body_override = 'Hi {{entity.name}}, we noticed you haven''t had a chance to review your proposal yet. We''re happy to walk through it with you or make adjustments if needed.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, your proposal is still available for review. If your plans have changed, no worries at all. Otherwise, I''m here whenever you''re ready to move forward.'
WHERE body_override = 'Hi {{entity.name}}, your proposal is still available for review. If your plans have changed, no worries at all. Otherwise, we''re here whenever you''re ready to move forward.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, it was great chatting about your project. Based on our conversation, I''m putting together a proposal tailored to your needs. You''ll hear from me soon.'
WHERE body_override = 'Hi {{entity.name}}, it was great chatting about your project. Based on our conversation, we''re putting together a proposal tailored to your needs. You''ll hear from us soon.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, just a quick update — I''m finalizing the details of your proposal. I want to make sure everything aligns with what we discussed. Stay tuned!'
WHERE body_override = 'Hi {{entity.name}}, just a quick update — we''re finalizing the details of your proposal. We want to make sure everything aligns with what we discussed. Stay tuned!';

-- DOWN

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, thank you for reaching out. We received your inquiry and would love to learn more about your project. Let''s schedule a quick consultation to discuss your goals.'
WHERE body_override = 'Hi {{entity.name}}, thank you for reaching out. I got your inquiry and would love to learn more about your project. Let''s schedule a quick consultation to discuss your goals.';

UPDATE sequence_steps
SET subject_override = 'A Few Things We Can Help With'
WHERE subject_override = 'A Few Things I Can Help With';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, just wanted to share some of the ways we help clients like you. From web design to full-stack development, we tailor every project to your specific needs.'
WHERE body_override = 'Hi {{entity.name}}, just wanted to share some of the ways I help clients like you. From web design to full-stack development, I tailor every project to your specific needs.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, we haven''t heard back yet and wanted to check in. If you''re still considering your project, we''d love to chat. No pressure — just here to help when you''re ready.'
WHERE body_override = 'Hi {{entity.name}}, I haven''t heard back yet and wanted to check in. If you''re still considering your project, I''d love to chat. No pressure — just here to help when you''re ready.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, just a friendly reminder that your proposal is ready for review. Take a look when you get a chance and let us know if you have any questions.'
WHERE body_override = 'Hi {{entity.name}}, just a friendly reminder that your proposal is ready for review. Take a look when you get a chance and let me know if you have any questions.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, we noticed you haven''t had a chance to review your proposal yet. We''re happy to walk through it with you or make adjustments if needed.'
WHERE body_override = 'Hi {{entity.name}}, I noticed you haven''t had a chance to review your proposal yet. I''m happy to walk through it with you or make adjustments if needed.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, your proposal is still available for review. If your plans have changed, no worries at all. Otherwise, we''re here whenever you''re ready to move forward.'
WHERE body_override = 'Hi {{entity.name}}, your proposal is still available for review. If your plans have changed, no worries at all. Otherwise, I''m here whenever you''re ready to move forward.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, it was great chatting about your project. Based on our conversation, we''re putting together a proposal tailored to your needs. You''ll hear from us soon.'
WHERE body_override = 'Hi {{entity.name}}, it was great chatting about your project. Based on our conversation, I''m putting together a proposal tailored to your needs. You''ll hear from me soon.';

UPDATE sequence_steps
SET body_override = 'Hi {{entity.name}}, just a quick update — we''re finalizing the details of your proposal. We want to make sure everything aligns with what we discussed. Stay tuned!'
WHERE body_override = 'Hi {{entity.name}}, just a quick update — I''m finalizing the details of your proposal. I want to make sure everything aligns with what we discussed. Stay tuned!';
