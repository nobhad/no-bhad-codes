# Knowledge Base System

**Status:** Complete
**Last Updated:** 2026-06-25

## Overview

The Knowledge Base System provides a help center with categorized articles. Admins manage categories and articles; clients access published content through the portal.

## Access Points

### Admin Dashboard

- Sidebar: "Knowledge Base" tab
- Category and article management
- **Files:** `src/react/features/admin/knowledge-base/` (`KnowledgeBase.tsx`, `ArticlesTable.tsx`, `CategoriesTable.tsx`)

### Client Portal

- Help section with searchable articles
- Category browsing
- Featured articles display
- **File:** `src/react/features/portal/help/PortalHelp.tsx`

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

### Article Feedback & Search Logging

- "Was this helpful?" feedback per article (`POST /api/kb/articles/:id/feedback`), stored in `kb_article_feedback`
- Search queries logged to `kb_search_log` for analytics
- Admins can fetch a single article for editing (`GET /api/kb/admin/articles/:id`) and view aggregate stats (`GET /api/kb/admin/stats`)

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
| `keywords` | TEXT | Search keywords (comma-separated) |
| `is_featured` | BOOLEAN | Featured flag |
| `is_published` | BOOLEAN | Published flag |
| `view_count` | INTEGER | View counter |
| `helpful_count` | INTEGER | "Was this helpful?" yes count |
| `not_helpful_count` | INTEGER | "Was this helpful?" no count |
| `sort_order` | INTEGER | Display order |
| `author_email` | TEXT | Article author |
| `created_at` | DATETIME | Timestamp |
| `updated_at` | DATETIME | Timestamp |
| `published_at` | DATETIME | Publish timestamp |

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
  Query: category?
  Returns: all articles

GET /api/kb/admin/articles/:id
  Returns: single article by ID (for editing)

GET /api/kb/admin/stats
  Returns: knowledge base statistics (article/category counts)

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

GET /api/kb/articles/:categorySlug/:articleSlug
  Returns: single article by category + article slug

GET /api/kb/categories/:slug
  Returns: category with its articles

POST /api/kb/articles/:id/feedback
  Body: { isHelpful, comment? }
  Returns: feedback submitted
```

## UI Components

### Admin - Page Header Controls

The Knowledge Base page features a section toggle in the unified portal header (next to the page title) that switches between two content views:

- **Categories** - Displays the categories management table
- **Articles** - Displays the articles management table with filters

The toggle uses the `createViewToggle` component with Categories (grid) and Articles (document) icons.

### Admin - Categories Tab

- Table with name, description, article count, status
- Add/Edit category modal
- Reorder via sort_order field

### Admin - Articles Tab

- Table with title, category, status, featured, updated date
- Filter by category and status
- Add/Edit article modal with rich text editor

### Client - Help Section

Two-column layout redesigned for better UX:

**Layout Structure:**

```text
+------------------------------------------+
|  HERO SEARCH (full width)                |
|  Search with live suggestions            |
+------------------+-----------------------+
|  LEFT COLUMN     |  RIGHT COLUMN         |
|  (narrower)      |  (wider)              |
|                  |                       |
|  Categories      |  Quick Start Articles |
|  Accordion       |  (Grid of featured)   |
|  - Single-open   |                       |
|  - Loads articles|  Article Detail View  |
|    on expand     |  (shows when clicked) |
|                  |                       |
+------------------+-----------------------+
|  CONTACT SECTION (full width)            |
+------------------------------------------+
```

**Features:**

- **Hero Search:** Live search suggestions as user types, keyboard navigation (arrows + Enter)
- **Categories Accordion:** Left column, collapsible with single-open behavior (only one expanded at a time)
- **Quick Start Grid:** Right column, featured articles in card format, clickable to show detail
- **Article Detail View:** Replaces Quick Start grid when article is selected, shows full content
- **Contact Section:** "Still Need Help?" with link to messages (single person, not "we")

## Files

| File | Purpose |
|------|---------|
| `src/react/features/admin/knowledge-base/` | Admin React feature (KnowledgeBase, ArticlesTable, CategoriesTable) |
| `src/react/features/portal/help/PortalHelp.tsx` | Client help React component |
| `server/routes/knowledge-base.ts` | API endpoints |
| `src/components/portal-modal.ts` | Modal component |

## Change Log

### February 11, 2026 - Help Page UX Redesign

- Redesigned Help page with two-column layout (Categories LEFT, Content RIGHT)
- Added hero search section with live suggestions and keyboard navigation
- Implemented collapsible accordion for categories with single-open behavior
- Quick Start articles now displayed in grid format, clickable to show article detail
- Article detail view appears in right column when article is selected
- Updated contact section language for single person ("Contact Noelle" not "Contact us")
- Fixed container heights so accordion expansion doesn't change main div height

**Files Modified (legacy vanilla TS — since rewritten as React):**

- `src/features/client/modules/portal-views.ts` *(removed)* — replaced by `src/react/features/portal/help/PortalHelp.tsx`
- `src/features/client/modules/portal-help.ts` *(removed)* — accordion/search logic now in `PortalHelp.tsx`
- `src/styles/client-portal/help.css` - Two-column grid layout styles

### February 9, 2026 - Section Toggle UI Enhancement

- Added section toggle in unified portal header to switch between Categories and Articles tables
- Toggle appears next to page title, consistent with Analytics/Workflows pattern
- Uses `createViewToggle` component with icons (Categories: grid, Articles: document)

### February 8, 2026 - Initial Implementation

- Created knowledge base system with categories and articles
- Added admin CRUD functionality
- Added client-facing help section with search
