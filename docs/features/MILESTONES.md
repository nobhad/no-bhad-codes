# Milestones Feature

**Status:** Active
**Last Updated:** 2026-02-09

## Overview

Milestones provide structured progress tracking for projects. When a new project is created, milestones are automatically generated based on the project type, giving both admin and clients visibility into project phases and deliverables.

## How It Works

### Auto-Generation

1. Project is created with a specific project type (e.g., "business-site")
2. System looks up milestone templates for that project type
3. Due dates are calculated from project start date + estimated days
4. Milestones are inserted into the database linked to the project

### Progress Tracking

- Each milestone has a checkbox (complete/incomplete)
- Progress percentage = completed milestones / total milestones x 100
- Example: 3 of 5 milestones complete = 60%

### Due Date Calculation

Due dates are cumulative from the project start date:

```text
Project Start: Feb 9
Discovery (5 days):     Feb 14
Design (12 days):       Feb 21
Development (22 days):  Mar 3
```

## Milestone Templates by Project Type

### Simple Site

**Timeline:** ~14 days
**Use for:** Landing pages, single-page sites, personal sites

| Milestone | Days | Description | Deliverables |
|-----------|------|-------------|--------------|
| Discovery & Planning | 3 | Initial consultation, requirements gathering, project planning | Project brief, Sitemap, Content outline |
| Design & Development | 10 | Visual design, development, content integration | Design mockups, Responsive site build, Content integration |
| Testing & Launch | 14 | Quality assurance, client review, deployment | Cross-browser testing, Mobile testing, Live deployment |

### Business Site

**Timeline:** ~32 days
**Use for:** Multi-page business websites, portfolios, corporate sites

| Milestone | Days | Description | Deliverables |
|-----------|------|-------------|--------------|
| Discovery | 5 | Business analysis, competitor research, requirements definition | Discovery document, Competitor analysis, Feature requirements |
| Design | 12 | Brand integration, wireframes, visual design | Wireframes, Style guide, Design mockups |
| Development | 22 | Frontend development, CMS setup, functionality | Responsive build, CMS configuration, Contact forms |
| Content Integration | 27 | Content population, SEO optimization, media | Page content, SEO setup, Image optimization |
| Testing & Launch | 32 | Comprehensive testing, training, production deployment | QA testing, Client training, Live deployment |

### E-commerce Site

**Timeline:** ~45 days
**Use for:** Online stores, shopping platforms

| Milestone | Days | Description | Deliverables |
|-----------|------|-------------|--------------|
| Discovery & Planning | 7 | Business requirements, product catalog analysis, platform selection | Requirements document, Platform recommendation, Product structure |
| Design | 14 | Store design, product page layouts, checkout flow design | Store wireframes, Product page designs, Checkout flow |
| Development | 28 | Platform setup, theme customization, core functionality | Store setup, Payment integration, Shipping configuration |
| Product Setup | 35 | Product import, inventory setup, categorization | Product catalog, Inventory system, Category structure |
| Testing & Launch | 45 | Order testing, payment verification, production launch | Order flow testing, Payment testing, Store launch |

### Web App

**Timeline:** ~60 days
**Use for:** Custom web applications, dashboards, SaaS products

| Milestone | Days | Description | Deliverables |
|-----------|------|-------------|--------------|
| Discovery & Architecture | 10 | Requirements analysis, technical architecture, project planning | Technical spec, Architecture diagram, Project roadmap |
| UI/UX Design | 20 | User research, wireframes, interface design | User flows, Wireframes, UI design system |
| Core Development | 40 | Backend development, API creation, core functionality | Backend API, Database schema, Core features |
| Frontend Integration | 50 | Frontend development and API integration | Frontend application, API integration, User authentication |
| Testing & Deployment | 60 | Testing, bug fixes, production deployment | Test coverage, Bug fixes, Production deployment |

### Maintenance/Retainer

**Timeline:** Monthly (90 days for 3-month cycle)
**Use for:** Ongoing maintenance contracts, retainer agreements

| Milestone | Days | Description | Deliverables |
|-----------|------|-------------|--------------|
| Month 1 - Setup | 30 | Initial audit, setup monitoring, establish maintenance schedule | Site audit, Monitoring setup, Maintenance schedule |
| Month 2 - Optimization | 60 | Performance optimization and security updates | Performance report, Security patches, Optimization updates |
| Month 3 - Review | 90 | Quarterly review and planning for next period | Quarterly report, Next period plan, Recommendations |

### Other/Custom

**Timeline:** ~28 days
**Use for:** Projects that don't fit other categories

| Milestone | Days | Description | Deliverables |
|-----------|------|-------------|--------------|
| Phase 1 - Planning | 7 | Requirements gathering and project planning | Project plan, Requirements document |
| Phase 2 - Execution | 21 | Primary work phase - design and development | Design deliverables, Development work |
| Phase 3 - Completion | 28 | Final review, testing, project handoff | Final deliverables, Testing, Project handoff |

## Project Type Mapping

The system normalizes project type names to match templates:

| Input | Maps To |
|-------|---------|
| simple, landing, personal | simple-site |
| business, corporate, portfolio | business-site |
| ecommerce, e-commerce, shop, store | ecommerce-site |
| webapp, application, dashboard, saas | web-app |
| retainer, support | maintenance |
| custom, (unknown) | other |

## API Endpoints

### Get Project Milestones

```text
GET /api/projects/:id/milestones
```

Returns all milestones for a project with completion status.

### Create Milestone

```text
POST /api/projects/:id/milestones
```

Manually add a milestone to a project.

### Update Milestone

```text
PUT /api/projects/:id/milestones/:milestoneId
```

Update milestone details or mark as complete.

### Delete Milestone

```text
DELETE /api/projects/:id/milestones/:milestoneId
```

Remove a milestone from a project.

### Backfill Milestones (Admin)

```text
POST /api/admin/milestones/backfill
```

Generate milestones for all existing projects that don't have any.

## Database Schema

```sql
CREATE TABLE milestones (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  deliverables TEXT,        -- JSON array
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

## Files

### Configuration

- `server/config/default-milestones.ts` - Milestone templates per project type

### Services

- `server/services/milestone-generator.ts` - Auto-generation and backfill logic

### Routes

- `server/routes/projects.ts` - CRUD endpoints for milestones
- `server/routes/admin.ts` - Backfill endpoint, milestone generation on project create

## Manual Override

Auto-generated milestones are a starting point. You can:

- **Add** custom milestones specific to the project
- **Edit** milestone titles, descriptions, due dates, deliverables
- **Delete** milestones that don't apply
- **Reorder** milestones (via due date adjustment)

## Notes

- Milestones are only auto-generated for NEW projects
- Existing projects need manual backfill or milestone creation
- Backfill uses project start date (or today if not set) for due date calculation
- Progress percentage is visible in project detail header
