# Knowledge Base System

**Status:** Complete
**Last Updated:** February 8, 2026

## Overview

The Knowledge Base System provides a help center with categorized articles. Admins manage categories and articles; clients access published content through the portal.

## Access Points

### Admin Dashboard

- Sidebar: "Knowledge Base" tab
- Category and article management
- **File:** `src/features/admin/modules/admin-knowledge-base.ts`

### Client Portal

- Help section with searchable articles
- Category browsing
- Featured articles display
- **File:** `src/features/client/modules/portal-help.ts`

## Features

### Categories

- Organize articles by topic
- Custom icons and colors
- Sort order control
- Active/inactive toggle
- Article count display

### Articles

- Rich text content
- Category assignment
- Featured flag for homepage
- Published/draft status
- SEO-friendly slugs
- Summary for previews

### Client Features

- Search across all articles
- Browse by category
- View featured articles
- Read full article content

## Database Schema

### kb_categories

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | Category name |
| `slug` | TEXT | URL-friendly slug |
| `description` | TEXT | Category description |
| `icon` | TEXT | Icon identifier |
| `color` | TEXT | Display color |
| `sort_order` | INTEGER | Display order |
| `is_active` | BOOLEAN | Active flag |
| `created_at` | TEXT | Timestamp |
| `updated_at` | TEXT | Timestamp |

### kb_articles

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `category_id` | INTEGER | FK to kb_categories |
| `title` | TEXT | Article title |
| `slug` | TEXT | URL-friendly slug |
| `summary` | TEXT | Short description |
| `content` | TEXT | Full article content |
| `is_featured` | BOOLEAN | Featured flag |
| `is_published` | BOOLEAN | Published flag |
| `created_at` | TEXT | Timestamp |
| `updated_at` | TEXT | Timestamp |

## API Endpoints

### Admin Endpoints

```text
GET /api/kb/admin/categories
  Returns: all categories with article counts

POST /api/kb/admin/categories
  Body: { name, description?, icon?, color?, sortOrder }
  Returns: created category

PUT /api/kb/admin/categories/:id
  Body: { name, description?, icon?, color?, sortOrder, isActive }
  Returns: updated category

DELETE /api/kb/admin/categories/:id
  Returns: success message

GET /api/kb/admin/articles
  Query: categoryId?, status?
  Returns: all articles

POST /api/kb/admin/articles
  Body: { categoryId, title, summary?, content, isFeatured, isPublished }
  Returns: created article

PUT /api/kb/admin/articles/:id
  Body: { categoryId, title, summary?, content, isFeatured, isPublished }
  Returns: updated article

DELETE /api/kb/admin/articles/:id
  Returns: success message
```

### Public/Client Endpoints

```text
GET /api/kb/categories
  Returns: active categories

GET /api/kb/featured
  Returns: featured published articles

GET /api/kb/search?q=query
  Returns: matching published articles

GET /api/kb/articles/:slug
  Returns: single article by slug

GET /api/kb/categories/:slug/articles
  Returns: articles in category
```

## UI Components

### Admin - Categories Tab

- Table with name, description, article count, status
- Add/Edit category modal
- Reorder via sort_order field

### Admin - Articles Tab

- Table with title, category, status, featured, updated date
- Filter by category and status
- Add/Edit article modal with rich text editor

### Client - Help Section

- Category cards with icons
- Search bar
- Featured articles carousel
- Article detail view

## Files

| File | Purpose |
|------|---------|
| `src/features/admin/modules/admin-knowledge-base.ts` | Admin module |
| `src/features/client/modules/portal-help.ts` | Client module |
| `server/routes/kb.ts` | API endpoints |
| `src/components/portal-modal.ts` | Modal component |
