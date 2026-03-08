-- ===============================================
-- ADMIN TWO-FACTOR AUTHENTICATION
-- ===============================================
-- Migration: 095_admin_two_factor.sql
-- Description: Add TOTP-based two-factor authentication support for the admin account.
--
-- Since the admin is env-based (not a row in the clients table),
-- 2FA state is stored in system_settings using the following keys:
--   - admin.two_factor_secret       : Base32-encoded TOTP secret
--   - admin.two_factor_enabled      : Whether 2FA is currently active
--   - admin.two_factor_backup_codes : JSON array of bcrypt-hashed backup codes
--
-- Date: 2026-03-07

-- UP

-- Seed default 2FA settings (disabled by default)
INSERT OR IGNORE INTO system_settings (setting_key, setting_value, setting_type, description, is_sensitive)
VALUES
  ('admin.two_factor_enabled', 'false', 'boolean', 'Whether TOTP two-factor authentication is enabled for admin', FALSE),
  ('admin.two_factor_secret', '', 'string', 'Base32-encoded TOTP secret for admin 2FA', TRUE),
  ('admin.two_factor_backup_codes', '[]', 'json', 'JSON array of hashed single-use backup codes for admin 2FA', TRUE);

-- DOWN

DELETE FROM system_settings WHERE setting_key IN (
  'admin.two_factor_enabled',
  'admin.two_factor_secret',
  'admin.two_factor_backup_codes'
);
