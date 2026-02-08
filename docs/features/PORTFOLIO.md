# Portfolio Projects

**Status:** Complete
**Last Updated:** February 8, 2026

## Overview

The portfolio system displays projects on the main site's projects page. Projects are stored in `public/data/portfolio.json` and rendered dynamically.

**Location:** Main site Projects section (`#/projects`)
**Data File:** `public/data/portfolio.json`
**Module:** `src/modules/ui/projects.ts`

## Adding a New Project

### Project Template

Copy this template and fill in all fields:

```json
{
  "id": "project-slug",
  "title": "Project Title",
  "slug": "project-slug",
  "tagline": "Short tagline (shown under title)",
  "description": "Full description paragraph for the overview section.",
  "category": "websites",
  "role": "Full Stack Developer",
  "tools": ["TypeScript", "Node.js", "Express.js"],
  "year": 2026,
  "technologies": ["TypeScript", "Node.js", "Express.js"],
  "date": "2026-01-01",
  "status": "in-progress",
  "featured": true,
  "heroImage": "/projects/project-slug-hero.png",
  "screenshots": [
    "/projects/project-slug-screen1.png",
    "/projects/project-slug-screen2.png"
  ],
  "liveUrl": "https://example.com",
  "repoUrl": "https://github.com/user/repo",
  "isDocumented": true,
  "titleCard": "/projects/project-slug-title.png",
  "duration": "3 months",
  "challenge": "Description of the problem being solved, user pain points, or business requirements that led to this project.",
  "approach": "Description of the methodology, key technical decisions, and how you solved the challenge.",
  "results": [
    "Specific outcome or metric #1",
    "Specific outcome or metric #2",
    "Specific outcome or metric #3"
  ],
  "keyFeatures": [
    "Feature highlight #1",
    "Feature highlight #2",
    "Feature highlight #3",
    "Feature highlight #4"
  ]
}
```

## Field Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (use slug format) |
| `title` | string | Display title |
| `slug` | string | URL-friendly identifier (used in `#/projects/slug`) |
| `tagline` | string | Short descriptor shown below title |
| `description` | string | Full overview paragraph |
| `category` | string | One of: `websites`, `applications`, `extensions`, `ecommerce` |
| `role` | string | Your role (e.g., "Full Stack Developer") |
| `tools` | string[] | Technologies used (displayed as tags) |
| `year` | number | Year of project |
| `status` | string | One of: `in-progress`, `completed`, `planned` |
| `isDocumented` | boolean | Set to `true` to show on projects page |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `technologies` | string[] | Duplicate of tools (legacy support) |
| `date` | string | Full date in ISO format |
| `featured` | boolean | Featured project flag |
| `heroImage` | string | Path to hero image (empty string if none) |
| `screenshots` | string[] | Array of screenshot paths |
| `liveUrl` | string | URL to live project |
| `repoUrl` | string | URL to source code |
| `titleCard` | string | Image shown in CRT TV preview on hover |

### Case Study Fields

| Field | Type | Description |
|-------|------|-------------|
| `duration` | string | Project duration (e.g., "3 months", "Ongoing") |
| `challenge` | string | Problem statement - what pain point does this solve? |
| `approach` | string | Solution methodology - how did you solve it? |
| `results` | string[] | Outcomes and metrics - what was achieved? |
| `keyFeatures` | string[] | Feature highlights - what are the standout capabilities? |

## Category Options

| Category | Description |
|----------|-------------|
| `websites` | Marketing sites, portfolios, landing pages |
| `applications` | Web apps, dashboards, tools |
| `extensions` | Browser extensions, plugins |
| `ecommerce` | Online stores, shopping carts |

## Status Options

| Status | Badge Color | Description |
|--------|-------------|-------------|
| `in-progress` | Yellow | Currently being developed |
| `completed` | Green | Finished and deployed |
| `planned` | Purple | Future project |

## Image Requirements

### Hero Image

- **Size:** 1200x630px recommended (16:9 or 12:7 aspect ratio)
- **Format:** PNG or JPG
- **Location:** `/public/projects/`
- **Naming:** `{slug}-hero.png`

### Title Card (CRT Preview)

- **Size:** 400x300px recommended
- **Format:** PNG
- **Location:** `/public/projects/`
- **Naming:** `{slug}-title.png`

### Screenshots

- **Size:** Varies, maintain consistent aspect ratio
- **Format:** PNG or JPG
- **Location:** `/public/projects/`
- **Naming:** `{slug}-screen1.png`, `{slug}-screen2.png`, etc.

## Visibility Rules

Projects appear on the main projects page only when:

1. `isDocumented` is `true`
2. At least 2 projects have `isDocumented: true` (otherwise WIP sign shows)

## Files

| File | Purpose |
|------|---------|
| `public/data/portfolio.json` | Project data |
| `src/modules/ui/projects.ts` | Rendering logic |
| `src/styles/pages/projects.css` | Projects list styles |
| `src/styles/pages/projects-detail.css` | Project detail page styles |
| `index.html` | Project detail HTML structure |

## Example: Adding a New Project

1. Add images to `/public/projects/`:
   - `new-project-title.png` (for CRT preview)
   - `new-project-hero.png` (optional)
   - `new-project-screen1.png` (optional screenshots)

2. Add project object to `portfolio.json`:

```json
{
  "id": "new-project",
  "title": "New Project",
  "slug": "new-project",
  "tagline": "A brief tagline",
  "description": "Full description of what this project does and why it matters.",
  "category": "applications",
  "role": "Full Stack Developer",
  "tools": ["React", "TypeScript", "PostgreSQL"],
  "year": 2026,
  "technologies": ["React", "TypeScript", "PostgreSQL"],
  "date": "2026-02-01",
  "status": "completed",
  "featured": true,
  "heroImage": "/projects/new-project-hero.png",
  "screenshots": ["/projects/new-project-screen1.png"],
  "liveUrl": "https://newproject.com",
  "repoUrl": "https://github.com/user/new-project",
  "isDocumented": true,
  "titleCard": "/projects/new-project-title.png",
  "duration": "2 months",
  "challenge": "Users needed a way to...",
  "approach": "Built a solution using...",
  "results": [
    "Reduced time by 50%",
    "Increased user satisfaction"
  ],
  "keyFeatures": [
    "Real-time updates",
    "Mobile-responsive design",
    "Dark mode support"
  ]
}
```

3. Verify the project appears at `#/projects` and detail page at `#/projects/new-project`

## Writing Tips

### Challenge Section

- Focus on the problem, not the solution
- Mention user pain points or business requirements
- Keep it to 2-3 sentences

### Approach Section

- Describe your methodology and key decisions
- Mention notable technical choices and why
- Keep it to 2-3 sentences

### Results Section

- Use specific metrics when possible ("50% faster", "3x more users")
- Include qualitative outcomes ("positive client feedback")
- 3-5 bullet points recommended

### Key Features Section

- Lead with the most impressive/unique features
- Be specific (not just "responsive design" but "mobile-first with offline support")
- 4-6 bullet points recommended
