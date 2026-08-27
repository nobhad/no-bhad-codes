-- Migration 141: Hedgewitch suggested add-ons, visible under Requests
--
-- Three things worth building on top of the launched site, put in front of the
-- client as ideas rather than quotes. Prices are deliberately NULL: the
-- internal hour/price drafts live in CURRENT_WORK.md and go out by email once
-- Noelle has settled them. Nothing here shows a number to the client.
--
-- The already-quoted work (folder upload, cover-variant add-on) is NOT seeded
-- here — it goes up only after the follow-up email lands, so the client does
-- not read a price in the portal first.

INSERT INTO ad_hoc_requests
  (project_id, client_id, title, description, status, request_type, priority, urgency)
VALUES
  (7, 6,
   'Export all your site data',
   'A one-click export in /admin that hands you everything the site holds: your page copy and settings, blog posts, the gallery, and every contact and careers submission with the resumes attached. Useful as a backup you keep yourself, and it means nothing on the site is ever locked in. Say the word and I will send you what it costs.',
   'reviewing', 'feature', 'normal', 'normal'),
  (7, 6,
   'Comments on blog posts',
   'Let readers reply to your posts, with everything held for your approval before it appears — you would get an email, and approve or bin it in /admin. Worth knowing up front: comments need looking after, since spam finds any open form eventually. Happy to price it if you want it.',
   'reviewing', 'feature', 'normal', 'normal'),
  (7, 6,
   'Email newsletter',
   'A sign-up box on the site and a way to send seasonal notes to the people who join — new posts, what to plant this month, availability for the season. The sending runs through a newsletter service with a free tier at your list size. Tell me if you are interested and I will send options and a price.',
   'reviewing', 'feature', 'normal', 'normal');
