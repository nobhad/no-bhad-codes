# Milestones & Tasks Feature

**Status:** Active
**Last Updated:** 2026-02-11

## Overview

Milestones and tasks provide structured progress tracking for projects. When a new project is created, both milestones AND their associated tasks are automatically generated based on the project type, giving both admin and clients visibility into project phases, deliverables, and actionable work items.

## How It Works

### Auto-Generation

1. Project is created with a specific project type (e.g., "business-site")
2. System looks up milestone templates for that project type
3. Due dates are calculated from project start date + estimated days
4. Milestones are inserted into the database linked to the project
5. **NEW:** For each milestone, tasks are auto-generated from templates
6. Task due dates are distributed evenly before the milestone due date

### Progress Tracking

**Milestones:**

- Milestone progress is calculated from task completion (not manual checkbox)
- Progress = completed tasks / total tasks × 100
- Example: 5 of 12 tasks complete = 42%
- Milestones auto-complete when ALL tasks are marked complete

**Tasks:**

- Each task has a status (pending, in_progress, completed, blocked, cancelled)
- Tasks can be viewed in milestone cards (expandable)
- Tasks can be viewed in dedicated Kanban or List view
- Milestone tasks are distinguished from standalone (ad-hoc) tasks

**Projects:**

- Overall project progress considers both milestone and standalone tasks
- Progress bar updates automatically when tasks are completed

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

## Task Auto-Generation

### Task Templates

Each milestone has associated task templates that define the specific work items needed to complete that milestone. Tasks are automatically generated when milestones are created.

**Task Counts by Project Type:**

- Simple Site: ~21 tasks across 3 milestones
- Business Site: ~42 tasks across 5 milestones
- E-commerce Site: ~49 tasks across 5 milestones
- Web App: ~64 tasks across 5 milestones
- Maintenance: ~27 tasks across 3 milestones (monthly cycle)
- Other/Custom: ~18 tasks across 3 milestones

### Task Due Date Distribution

Task due dates are automatically calculated and distributed evenly between today and the milestone due date:

```text
Milestone Due: Feb 21 (12 days from now)
7 tasks in milestone:
  - Task 1: Feb 11 (2 days)
  - Task 2: Feb 12 (3 days)
  - Task 3: Feb 14 (5 days)
  - Task 4: Feb 16 (7 days)
  - Task 5: Feb 18 (9 days)
  - Task 6: Feb 19 (10 days)
  - Task 7: Feb 21 (12 days - milestone due)
```

If milestone is in the past or today, all tasks get the milestone due date.

### Task Fields

Each generated task includes:

- **Title**: Descriptive name of the task
- **Description**: (optional) Additional details about what needs to be done
- **Status**: Initially "pending"
- **Priority**: Initially "medium"
- **Due Date**: Auto-calculated distribution
- **Estimated Hours**: (optional) Time estimate for the task
- **Sort Order**: Display order within milestone

### Example: Business Site Tasks

**Discovery Milestone (7 tasks):**

1. Conduct business analysis workshop (3h)
2. Research competitors (4h)
3. Define user personas (3h)
4. Document feature requirements (3h)
5. Define content strategy (2h)
6. Create discovery document (3h)
7. Client approval of discovery phase (1h)

**Design Milestone (8 tasks):**

1. Create wireframes for all page templates (6h)
2. Develop style guide (4h)
3. Design homepage mockup (6h)
4. Design interior page templates (8h)
5. Client design review round 1 (1h)
6. Design revisions (4h)
7. Client design review round 2 (1h)
8. Prepare design assets for development (2h)
**(Continues for Development, Content Integration, Testing & Launch)**

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

Generate milestones AND tasks for all existing projects that don't have any.

**Response:**

```json
{
  "success": true,
  "message": "Backfill complete: 12 milestones and 87 tasks created for 4 projects",
  "data": {
    "projectsProcessed": 4,
    "milestonesCreated": 12,
    "tasksCreated": 87,
    "errors": []
  }
}
```

### Backfill Tasks (Admin)

```text
POST /api/admin/tasks/backfill
```

Generate tasks for all existing milestones that don't have any tasks.

**Response:**

```json
{
  "success": true,
  "message": "Backfill complete: 87 tasks created for 12 milestones",
  "data": {
    "milestonesProcessed": 12,
    "tasksCreated": 87,
    "errors": []
  }
}
```

## Database Schema

**Milestones Table:**

```sql
CREATE TABLE milestones (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  deliverables TEXT,           -- JSON array
  is_completed BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  sort_order INTEGER DEFAULT 0,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

**Project Tasks Table:**

```sql
CREATE TABLE project_tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  milestone_id INTEGER,        -- NULL for standalone tasks
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed, blocked, cancelled
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  assigned_to TEXT,
  due_date DATE,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  sort_order INTEGER DEFAULT 0,
  parent_task_id INTEGER,     -- For subtasks
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_task_id) REFERENCES project_tasks(id) ON DELETE CASCADE
);
```

**Key Relationships:**

- Projects (1) → (many) Milestones
- Milestones (1) → (many) Tasks
- Projects (1) → (many) Tasks (includes both milestone and standalone tasks)
- Tasks can exist without a milestone (`milestone_id = NULL` for standalone tasks)

## Files

### Configuration

- `server/config/default-milestones.ts` - Milestone templates per project type
- `server/config/default-tasks.ts` - Task templates per milestone and project type

### Services

- `server/services/milestone-generator.ts` - Milestone auto-generation and backfill logic
- `server/services/task-generator.ts` - Task auto-generation and backfill logic
- `server/services/progress-calculator.ts` - Progress calculation and milestone auto-completion
- `server/services/project-service.ts` - Task CRUD with automatic progress updates

### Routes

- `server/routes/projects/milestones.ts` - Milestone CRUD endpoints
- `server/routes/projects/tasks.ts` - Task CRUD endpoints (includes dependencies, checklist, comments)
- `server/routes/admin/projects.ts` - Backfill endpoints for milestones and tasks

### Frontend

- `src/features/admin/project-details/milestones.ts` - Milestone view with expandable task lists
- `src/features/admin/modules/admin-tasks.ts` - Task Kanban/List view with milestone tags
- `src/styles/admin/project-detail.css` - Milestone and task UI styles
- `src/styles/admin/tasks.css` - Task card and milestone tag styles

### Router Structure

```text
server/routes/projects/
├── index.ts          # Router mounting for all project subroutes
├── core.ts           # Project CRUD operations
├── milestones.ts     # Milestone management
├── tasks.ts          # Task endpoints (dependencies, checklist, comments)
└── ...               # Other project-related routes
```

## Manual Override

Auto-generated milestones and tasks are a starting point. You can:

### Milestones

- **Add** custom milestones specific to the project
- **Edit** milestone titles, descriptions, due dates, deliverables
- **Delete** milestones (all associated tasks will be deleted via cascade)
- **Reorder** milestones (via due date adjustment)

### Tasks

- **Add** standalone tasks (not linked to any milestone)
- **Add** additional tasks to existing milestones
- **Edit** task details, status, priority, due dates
- **Delete** tasks (progress will automatically recalculate)
- **Move** tasks between milestones
- **Mark complete** directly from milestone view or task view

## UI Features

### Milestone Cards

- **Progress Bar**: Visual indicator showing task completion percentage
- **Task Count**: Shows "5/12 tasks" with percentage
- **Expandable Tasks**: Click to show/hide all tasks for that milestone
- **Auto-Completion**: Milestone automatically marks complete when all tasks are done

### Task Views

**In Milestone Cards:**

- Expandable task list within each milestone
- Toggle task completion with checkboxes
- View task due dates and assignees
- Instant progress updates

**In Kanban/List View:**

- **Milestone Tags**: Tasks show which milestone they belong to
- **Standalone Tags**: Ad-hoc tasks show "Standalone" tag
- **Filtering**: Filter tasks by milestone vs standalone
- **All standard task features**: Priority, status, due dates, etc.

### Progress Tracking

- **Milestone Progress**: Calculated from task completion (not manual toggle)
- **Project Progress**: Combines milestone tasks + standalone tasks
- **Auto-Update**: Progress updates automatically when tasks are completed
- **Real-Time**: Changes reflect immediately in UI

## Notes

- **New Projects**: Milestones AND tasks are auto-generated on creation
- **Existing Projects**: Use backfill endpoints to generate milestones/tasks
- **Backfill Safety**: System checks for existing milestones/tasks to prevent duplicates
- **Cascading Deletes**: Deleting a milestone deletes all its tasks
- **Progress Integrity**: Milestone completion is calculated from tasks (not editable directly)
- **Due Date Intelligence**: If milestone is overdue, tasks get milestone due date
