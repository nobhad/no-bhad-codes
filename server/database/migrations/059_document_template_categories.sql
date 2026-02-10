-- UP
-- Migration: Document Template Categories
-- Add category and project_type to document request templates
-- Created: 2026-02-10

-- =====================================================
-- ADD CATEGORY COLUMN
-- =====================================================
ALTER TABLE document_request_templates ADD COLUMN category TEXT DEFAULT 'general';

-- =====================================================
-- ADD PROJECT TYPE COLUMN
-- =====================================================
ALTER TABLE document_request_templates ADD COLUMN project_type TEXT;

-- =====================================================
-- UPDATE EXISTING TEMPLATES WITH CATEGORIES
-- =====================================================
UPDATE document_request_templates SET category = 'brand_assets' WHERE name IN ('brand_assets', 'photo_gallery');
UPDATE document_request_templates SET category = 'content' WHERE name = 'content_copy';
UPDATE document_request_templates SET category = 'legal' WHERE name IN ('business_license', 'signed_contract');
UPDATE document_request_templates SET category = 'technical' WHERE name IN ('domain_info', 'hosting_access');

-- =====================================================
-- ADD NEW CATEGORY-SPECIFIC TEMPLATES
-- =====================================================
INSERT OR IGNORE INTO document_request_templates (name, title, description, document_type, is_required, days_until_due, category, project_type) VALUES
-- Brand Assets
('logo_files', 'Logo Files (All Formats)', 'Please provide your logo in all available formats (AI, EPS, SVG, PNG, JPG).', 'asset', true, 7, 'brand_assets', NULL),
('brand_guidelines', 'Brand Guidelines Document', 'If available, please share your brand guidelines or style guide.', 'asset', false, 10, 'brand_assets', NULL),
('font_files', 'Brand Fonts', 'Please provide the font files used in your branding.', 'asset', false, 7, 'brand_assets', NULL),

-- Content
('homepage_content', 'Homepage Content', 'Written content for your homepage including headlines, descriptions, and call-to-action text.', 'general', true, 14, 'content', 'website'),
('about_page_content', 'About Page Content', 'Company history, mission statement, team bios, and any about page content.', 'general', true, 14, 'content', 'website'),
('services_content', 'Services/Products Content', 'Detailed descriptions of your services or products.', 'general', true, 14, 'content', 'website'),
('testimonials', 'Testimonials', 'Customer testimonials and reviews you would like featured.', 'general', false, 10, 'content', NULL),

-- Legal
('w9_form', 'W-9 Form', 'Please provide a completed W-9 form for tax purposes.', 'identification', false, 7, 'legal', NULL),
('certificate_of_insurance', 'Certificate of Insurance', 'Please provide your certificate of insurance if applicable.', 'identification', false, 14, 'legal', NULL),
('nda_signed', 'Signed NDA', 'Please return the signed non-disclosure agreement.', 'contract', false, 5, 'legal', NULL),

-- Technical
('analytics_access', 'Google Analytics Access', 'Please share Google Analytics access via admin permission.', 'general', false, 5, 'technical', 'website'),
('social_logins', 'Social Media Credentials', 'Login credentials for social media accounts if management is included.', 'general', false, 5, 'technical', NULL),
('dns_access', 'DNS/Domain Registrar Access', 'Access credentials to your domain registrar for DNS changes.', 'general', true, 5, 'technical', 'website'),
('existing_site_backup', 'Existing Website Backup', 'Please provide a full backup of your current website if migrating.', 'source', false, 7, 'technical', 'website');

-- =====================================================
-- CREATE INDEX FOR CATEGORY
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_document_request_templates_category ON document_request_templates(category);
CREATE INDEX IF NOT EXISTS idx_document_request_templates_project_type ON document_request_templates(project_type);

-- DOWN
DROP INDEX IF EXISTS idx_document_request_templates_project_type;
DROP INDEX IF EXISTS idx_document_request_templates_category;

-- Note: SQLite doesn't support DROP COLUMN, so we can't reverse the ALTER TABLE statements
-- The columns will remain but can be ignored

-- Remove the newly added templates
DELETE FROM document_request_templates WHERE name IN (
  'logo_files', 'brand_guidelines', 'font_files',
  'homepage_content', 'about_page_content', 'services_content', 'testimonials',
  'w9_form', 'certificate_of_insurance', 'nda_signed',
  'analytics_access', 'social_logins', 'dns_access', 'existing_site_backup'
);
