# Terminal Intake Restore — Design Spec

- **Date:** 2026-06-04
- **Status:** Approved (pending spec review)
- **Author:** Noelle Bhaduri

## Problem

The public `/intake` page is broken: an anonymous lead lands on it, the page
mounts the authenticated portal `OnboardingWizard`, the wizard immediately
calls `GET /api/client-info/onboarding` (auth-only) → **401**, and the global
`api-client.ts` 401 interceptor fires `handleSessionExpired()`, which clears
storage and redirects the visitor off `/intake` to the login page. Net effect:
the intake form appears blank / bounces. No lead can ever submit.

### Root cause (verified by live reproduction on :4000)

1. `server/views/pages/auth/intake.ejs:17` mounts `mountOnboardingWizard`.
2. `OnboardingWizard.tsx:144` loads a draft from the authenticated
   `/api/client-info/onboarding` endpoint on mount → 401 for anonymous users.
3. `src/utils/api-client.ts` global fetch interceptor (≈L523-544) treats any
   `/api/*` 401 as a session expiry → `handleSessionExpired()` (≈L249-283)
   redirects to login after ~1.5s.

The correct public endpoint, `POST /api/intake` (`server/routes/intake.ts:207`,
no auth), already exists and does the full job (creates client + project +
milestones, emails admin, generates invoice/JWT). Nothing on the front end
currently uses it.

### History

A complete **terminal-chat intake modal** once drove `/api/intake` correctly —
~15 vanilla TS files (~2,000 lines) under `src/features/client/`. It was deleted
wholesale in commit `e9f9095e` ("remove 99 dead vanilla JS/TS files, React SPA
approach") and replaced with the broken wizard mount. The surviving artifacts:
`src/styles/pages/terminal-intake.css` (partial), `BRANDING.TERMINAL`, and
`src/modules/animation/avatar-intro.ts` (extracted from the intake UI).

## Goal

Restore the original terminal-style intake as a **pop-up modal** (opened from the
contact section's "intake form" link) **and** as the standalone `/intake` page,
posting to `POST /api/intake`, matching its surviving CSS/aesthetic.

## Non-goals (out of scope)

- The **portal "New Project" tab** (`#tab-new-project`) usage of the old
  `portal-intake-loader.ts` / `TerminalIntakeModule`. That is an authenticated
  portal context; not part of this public-intake fix.
- Any change to the `POST /api/intake` backend behavior (account creation,
  invoice/JWT generation). Consume it as-is.
- Removing the now-unused `OnboardingWizard` (leave in place; flag only).
- Any new design/visual invention beyond recovering the original.

## Approach: recover & refit

Restore the original implementation from `e9f9095e^` (the commit immediately
before deletion), de-rot it against the current codebase, recover the matched
CSS from the same point in history, reconcile CSS with scattered survivors,
rewire the trigger, and replace the broken `/intake` mount.

Rationale (vs rebuild): the surviving CSS was partially stripped and scattered
(`terminal-title`, `terminal-prompt-line`, `terminal-typing-text`,
`terminal-cursor`, `terminal-messages` are **missing**; `terminal-window`,
`terminal-input-area`, `intake-modal`, `terminal-header` survive in
`nav-portal.css`/`client.css`). Both restore and rebuild therefore need CSS
reconstruction. Restore recovers a **matched, self-consistent JS + CSS pair**
known to have worked together, avoiding hand-derived/speculative CSS.

### Architecture fit

The public marketing site is still vanilla TS (only the portal is React).
Restoring vanilla modules for the public intake is consistent with that
architecture, not a regression of the SPA direction.

## Restore manifest

Recover from `e9f9095e^` into the public-site source tree:

| Original path | Purpose |
|---|---|
| `src/features/client/terminal-intake.ts` | Orchestrator (`TerminalIntakeModule`) |
| `src/features/client/terminal-intake-types.ts` | Types (`IntakeData`, `IntakeQuestion`, options) |
| `src/features/client/terminal-intake-data.ts` | Question flow + options |
| `src/features/client/terminal-intake-ui.ts` | UI render, typing animation, messages |
| `src/features/client/terminal-intake-commands.ts` | CLI commands (restart, etc.) |
| `src/features/client/intake/api-handler.ts` | `submitIntakeData` → `POST /api/intake`, `buildSubmitPayload` |
| `src/features/client/intake/validation.ts` | Client-side validation |
| `src/features/client/intake/event-binding.ts` | Input / command event binding |
| `src/features/client/intake/progress-store.ts` | In-progress answer store |
| `src/features/client/intake/prompt-handlers.ts` | Per-prompt handling |
| `src/features/client/intake/step-config.ts` | Step config |
| `src/features/client/intake/step-renderers.ts` | Step rendering |
| `src/features/client/intake/terminal-effects.ts` | CRT/typing effects |
| `src/features/client/intake/index.ts` | Barrel |

Final file layout/splitting to be confirmed during planning (no hard line
limits; split by logical organization). The `avatar-intro.ts` already lives at
`src/modules/animation/avatar-intro.ts` — reuse it, do not duplicate.

**Explicitly NOT restored:** `portal-intake-loader.ts`, `proposal-builder*.ts`,
and anything coupling to the portal/proposal flow (out of scope).

## CSS recovery & reconciliation

1. Recover the full terminal CSS from `e9f9095e^` (`terminal-intake.css` and the
   `.intake-modal` rules then in `nav-portal.css`).
2. Diff against the current `src/styles/pages/terminal-intake.css` and the
   scattered survivors in `nav-portal.css` / `client.css`.
3. Restore the **missing** classes (`terminal-title`, `terminal-prompt-line`,
   `terminal-typing-text`, `terminal-cursor`, `terminal-messages`, full
   `terminal-window`/`terminal-header`/`intake-modal` modal chrome).
4. Consolidate into `src/styles/pages/terminal-intake.css` (the existing home),
   removing duplicates so no class is defined twice. Use existing
   `--color-terminal-*` / `--terminal-*` variables (already present in
   `design-system/tokens/colors.css` + `dimensions.css`). No hex in components.

## De-rot checklist

Verified still-present: `apiFetch(url, options)` (same signature),
`BRANDING.TERMINAL.PROMPT`. To verify/fix during implementation:

- Import paths that moved since deletion (`@/` / `@react` aliases, `logger`,
  `getContactEmail`, validation utilities).
- `buildSubmitPayload` output still matches `ValidationSchemas.intakeSubmission`
  enums (`projectType`, `timeline`, `budget`, `projectFor`, `techComfort`,
  `domainHosting`, `designLevel`). Add a guard test (below).
- Any references to deleted siblings (`proposal-builder`, `portal-intake-loader`).
- Module bootstrap: the old code ran as `TerminalIntakeModule` (does **not**
  extend `BaseModule`). Re-bootstrap for the two public entry points below.

## Entry points

1. **Pop-up modal** — the contact section's "intake form" link currently renders
   as a dead `href="#"`. Wire it to open the `#intake-modal` terminal pop-up
   (backdrop + terminal window). Locate the contact-section markup (homepage
   template/partial) during planning and attach the open/close binding.
2. **Standalone `/intake` page** — `server/views/pages/auth/intake.ejs` stops
   mounting `OnboardingWizard`; instead it initializes the restored
   `TerminalIntakeModule` into `.terminal-intake-container`
   (`body[data-page="client-intake"]` full-page styling already exists in CSS).

Both entry points share one module; only the host container differs.

## Data flow

```text
user opens modal / page
  → TerminalIntakeModule renders terminal window (login line, prompt,
    blinking cursor, ./project_intake.sh typing animation, coyote avatar)
  → AI chat-style Q&A (QUESTIONS flow): name, email, projectFor, companyName?,
    projectType, projectDescription, timeline, budget, techComfort,
    domainHosting, features, ...
  → progress-store accumulates answers; validation per prompt
  → on completion: buildSubmitPayload(answers) → apiFetch('/api/intake', POST)
  → 201 Created (no 401 → global redirect interceptor never fires)
  → terminal prints success/confirmation line (inline; no redirect, no login)
```

## Error handling

- Submit failure (non-201): print an error line in the terminal with the
  fallback contact email; keep answers in the progress-store so the user can
  retry without re-entering everything.
- `/api/intake` validation rejection (422): surface the field-level message in
  the terminal; re-prompt the offending question.
- SVG avatar fetch failure: existing `avatar-intro.ts` already falls back to an
  `<img>` tag.

## Testing

- **Unit/guard:** assert the restored question-flow option values exactly match
  the server `ValidationSchemas.intakeSubmission` `allowedValues` for
  `projectType`, `timeline`, `budget`, `projectFor`, `techComfort`,
  `domainHosting` (guards against future schema drift).
- **Typecheck + lint:** clean (`tsc --noEmit`, eslint).
- **Manual browser repro (:4000):**
  - Click contact "intake form" link → terminal modal opens (not `#`).
  - `/intake` page renders the terminal (no redirect to login).
  - Complete the flow → submit → 201 → success line; verify a client + project
    row is created and the admin notification fires.

## Risks / open questions

- **CSS reconciliation** is the fiddly part: survivors scattered into
  `nav-portal.css`/`client.css` must not collide with recovered rules. Mitigate
  by diffing and consolidating into one file.
- **Contact-link location:** homepage contact markup not yet located; planning
  step must find it and confirm the link/selector to bind.
- **Schema drift:** the 2024-era question flow may use an enum value the current
  schema dropped (or vice versa); the guard test surfaces this.
- **`OnboardingWizard` orphaned:** left in place per scope; note for later
  cleanup, do not remove now.
