# Client Intake (Onboarding Wizard)

**Status:** Complete
**Last Updated:** 2026-04-30

## Overview

The client intake is a five-step React onboarding wizard mounted at `/client/intake`. It collects everything needed to scope and start a project: contact info, project overview, requirements, assets, and a final review.

It is reached from the main site via the "intake form" link in the contact section (`#open-intake-link` in `index.html`), which redirects to `/client/intake` on click.

## Architecture

### Page

- Route: `/client/intake`
- Server view: `server/views/pages/auth/intake.ejs`
- The view ships an empty `<section class="terminal-intake-container">` and mounts the React wizard into it on `DOMContentLoaded`.

### React Module

| File | Purpose |
|------|---------|
| `src/react/features/portal/onboarding/mount.tsx` | Island-mount wrapper (`mountOnboardingWizard`) built via `createMountWrapper` factory |
| `src/react/features/portal/onboarding/OnboardingWizard.tsx` | Main wizard: state, validation, draft autosave, step navigation |
| `src/react/features/portal/onboarding/StepIndicator.tsx` | Numbered progress indicator |
| `src/react/features/portal/onboarding/types.ts` | Step config, form-data types, constants (project types, budgets, design styles, features, timezones) |
| `src/react/features/portal/onboarding/steps/` | One component per step: `BasicInfoStep`, `ProjectOverviewStep`, `RequirementsStep`, `AssetsStep`, `ConfirmationStep` |
| `src/styles/pages/terminal-intake.css` | Page styling (monospace, brutalist treatment) |

### Step Sequence

Defined by `ONBOARDING_STEPS` in `types.ts`:

1. **Basic Info** — contact name, email, phone, company, website, timezone, preferred contact method
2. **Project Overview** — project name, project type, description, target launch date, budget, target audience
3. **Requirements** — design style, color preferences, brand-guidelines flag, content-ready flag, feature multi-select, integrations, notes
4. **Assets** — file uploads, logo flag, existing assets, content access
5. **Confirmation** — review and submit

Each step validates locally via `validateStep()` before the user can advance.

## Persistence

- **Draft autosave:** every `DRAFT_SAVE_INTERVAL` (5s) the in-progress form data is saved to `localStorage` under `DRAFT_STORAGE_KEY` (`onboarding_draft`) and posted to the server.
- **Resume:** on mount, the wizard pulls existing progress from the API and falls back to the localStorage draft.

## Validation

`validateStep()` in `OnboardingWizard.tsx` runs per-step rules:

- **Basic Info:** contact name + valid email required
- **Project Overview:** project name + project type + description required
- **Requirements:** design style required
- **Assets:** none (optional step)
- **Confirmation:** submit-only

Email validation uses the shared `validateEmail` from `shared/validation/validators` (allows disposable addresses for the intake context).

## API Surface

API endpoints are referenced via `API_ENDPOINTS` from `src/constants/api-endpoints.ts`. The wizard uses:

- `apiFetch` to load existing progress on mount
- `apiPost` to save drafts and submit the final form

Submissions land in the `client_intakes` table (see `server/database/migrations/002_client_intakes.sql` and follow-on migrations).

## Design Notes

The wizard follows a brutalist visual treatment (per the comment in `OnboardingWizard.tsx`): transparent backgrounds, no border-radius, monospace typography. GSAP handles step transitions and entrance animations via `useFadeIn` from `@react/hooks/useGsap`.

## Constants Reference

Defined in `types.ts`:

- `PROJECT_TYPES` — Website Design, Web Application, E-commerce, Landing Page, Redesign, Brand Identity, Other
- `BUDGET_RANGES` — Under $5K, $5–10K, $10–25K, $25–50K, $50K+, Not sure
- `DESIGN_STYLES` — Modern & Minimal, Bold & Vibrant, Corporate & Professional, Creative & Artistic, Playful & Fun, Luxury & Elegant, Not sure
- `FEATURE_OPTIONS` — auth, payments, CMS, blog, contact forms, newsletter, social, analytics, search, i18n, uploads, admin dashboard
- `TIMEZONES` — common US/EU/APAC zones

## Change Log

### 2026-04-30 - Architecture rewrite

- Replaced the prior terminal/chat-style intake (`src/features/client/terminal-intake*.ts`) with a five-step React onboarding wizard (`src/react/features/portal/onboarding/`).
- Intake now lives at `/client/intake` (server-rendered shell + React island), not in a modal on the main site.
- Main-site contact link still says "intake form" but redirects to `/client/intake` rather than opening a modal.
