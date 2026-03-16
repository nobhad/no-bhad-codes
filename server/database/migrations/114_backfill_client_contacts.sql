-- Backfill client_contacts from clients table for clients that have no contacts.
-- Splits contact_name into first_name/last_name and sets as primary contact.

INSERT INTO client_contacts (client_id, first_name, last_name, email, phone, role, is_primary, created_at, updated_at)
SELECT
  c.id,
  CASE
    WHEN INSTR(TRIM(c.contact_name), ' ') > 0
    THEN SUBSTR(TRIM(c.contact_name), 1, INSTR(TRIM(c.contact_name), ' ') - 1)
    ELSE TRIM(c.contact_name)
  END AS first_name,
  CASE
    WHEN INSTR(TRIM(c.contact_name), ' ') > 0
    THEN SUBSTR(TRIM(c.contact_name), INSTR(TRIM(c.contact_name), ' ') + 1)
    ELSE ''
  END AS last_name,
  c.email,
  c.phone,
  'primary',
  1,
  COALESCE(c.created_at, datetime('now')),
  datetime('now')
FROM clients c
LEFT JOIN client_contacts cc ON cc.client_id = c.id AND cc.deleted_at IS NULL
WHERE c.deleted_at IS NULL
  AND c.contact_name IS NOT NULL
  AND c.contact_name != ''
  AND cc.id IS NULL;
