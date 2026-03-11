-- Ensure Welcome article appears before Uploading Files in Getting Started
UPDATE kb_articles SET sort_order = 1 WHERE slug = 'welcome-portal';
UPDATE kb_articles SET sort_order = 2 WHERE slug = 'uploading-files';
