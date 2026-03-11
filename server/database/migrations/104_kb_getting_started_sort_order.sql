-- Fix sort_order for Getting Started articles so Welcome appears first
UPDATE kb_articles SET sort_order = 1 WHERE slug = 'welcome-portal';
UPDATE kb_articles SET sort_order = 2 WHERE slug = 'uploading-files';
