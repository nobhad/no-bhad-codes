# Terminal Intake Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the deleted terminal-chat intake form (modal pop-up + standalone `/intake` page) so anonymous leads can submit to `POST /api/intake`, replacing the broken auth-gated `OnboardingWizard` mount.

**Architecture:** Recover the original vanilla `TerminalIntakeModule` (extends `BaseModule`) and its submodules from git commit `e9f9095e^`, strip the out-of-scope proposal-builder coupling, recover/reconcile the matched terminal CSS, and re-connect the two host entry points whose chrome/handlers already survive (`index.html` modal, `intake.ejs` page).

**Tech Stack:** Vanilla TypeScript modules (public site), Vite, EJS server views, existing `apiFetch` client, `BaseModule` lifecycle, Vitest for the guard test.

> **Commit policy (project rule):** Do NOT auto-commit. Commit commands are provided as copy-paste for Noelle to run manually. Do not add Claude as author; no emoji in messages.

> **Reference commit:** `e9f9095e^` is the commit immediately before the deletion (`e9f9095e "remove 99 dead vanilla JS/TS files, React SPA approach"`). All `git show e9f9095e^:<path>` commands below recover the pre-deletion version.

---

## File Structure

**Restore (recover verbatim, then de-rot):**

- `src/features/client/terminal-intake.ts` — orchestrator (`TerminalIntakeModule`)
- `src/features/client/terminal-intake-types.ts` — `IntakeData`, `IntakeQuestion`, `TerminalIntakeOptions`, `ChatMessage`
- `src/features/client/terminal-intake-data.ts` — `QUESTIONS`, `getBaseQuestionCount`
- `src/features/client/terminal-intake-ui.ts` — render, typing animation, messages
- `src/features/client/terminal-intake-commands.ts` — CLI commands
- `src/features/client/intake/index.ts` — barrel
- `src/features/client/intake/api-handler.ts` — `submitIntakeData`, `buildSubmitPayload`, `buildSuccessMessage`
- `src/features/client/intake/validation.ts` — `validateAnswer`, parsers
- `src/features/client/intake/event-binding.ts` — input/command binding
- `src/features/client/intake/progress-store.ts` — answer persistence
- `src/features/client/intake/prompt-handlers.ts` — per-prompt handling
- `src/features/client/intake/step-config.ts` — question resolution
- `src/features/client/intake/step-renderers.ts` — review/summary rendering
- `src/features/client/intake/terminal-effects.ts` — CRT/typing effects

**Modify:**

- `index.html:1280-1292` — replace the stopgap redirect in `openIntakeModal()` with module instantiation
- `server/views/pages/auth/intake.ejs` — replace `mountOnboardingWizard` with `TerminalIntakeModule`
- `src/styles/pages/terminal-intake.css` — add recovered missing classes
- `src/styles/components/nav-portal.css` / `src/styles/pages/client.css` — remove scattered terminal duplicates (only if they collide)

**Create:**

- `src/features/client/intake/__tests__/schema-parity.test.ts` — guard test

**Explicitly NOT restored (out of scope):** `proposal-builder.ts`, `proposal-builder-types.ts`, `portal-intake-loader.ts`.

---

## Task 1: Restore original module files from git

**Files:** all 14 restore-manifest paths above.

- [ ] **Step 1: Recreate the directory and restore all files**

```bash
cd /Users/noellebhaduri/Projects/Development/Active/no-bhad-codes
mkdir -p src/features/client/intake
for f in terminal-intake.ts terminal-intake-types.ts terminal-intake-data.ts terminal-intake-ui.ts terminal-intake-commands.ts; do
  git show "e9f9095e^:src/features/client/$f" > "src/features/client/$f"
done
for f in index.ts api-handler.ts validation.ts event-binding.ts progress-store.ts prompt-handlers.ts step-config.ts step-renderers.ts terminal-effects.ts; do
  git show "e9f9095e^:src/features/client/intake/$f" > "src/features/client/intake/$f"
done
```

- [ ] **Step 2: Verify all files restored**

Run: `ls src/features/client/terminal-intake*.ts src/features/client/intake/`
Expected: 5 top-level `terminal-intake*.ts` files + 9 files under `intake/`.

- [ ] **Step 3: Capture the baseline typecheck error surface**

Run: `npx tsc --noEmit 2>&1 | grep -E 'features/client' | head -60`
Expected: errors referencing `./proposal-builder`, `./proposal-builder-types`, and possibly moved imports. Record them — Tasks 2–3 clear them.

- [ ] **Step 4: Commit the raw restore (copy-paste for Noelle)**

```bash
git add src/features/client/terminal-intake*.ts src/features/client/intake/
git commit -m "restore(intake): recover terminal intake modules from e9f9095e^"
```

---

## Task 2: Strip out-of-scope proposal-builder coupling

The orchestrator and api-handler import the un-restored proposal-builder. Remove the proposal flow; the question flow submits directly on completion. (`/api/intake` treats `proposalSelection` as optional.)

**Files:**
- Modify: `src/features/client/terminal-intake.ts`
- Modify: `src/features/client/intake/api-handler.ts`

- [ ] **Step 1: api-handler — drop the `proposalSelection` parameter**

In `src/features/client/intake/api-handler.ts`:
- Remove `import type { ProposalSelection } from '../proposal-builder-types';`
- Change `buildSubmitPayload(intakeData, proposalSelection)` to `buildSubmitPayload(intakeData)` and delete the line that spreads/sets `proposalSelection` into `submitData`.
- Change `submitIntakeData(intakeData: IntakeData, proposalSelection: ProposalSelection | null)` to `submitIntakeData(intakeData: IntakeData)`; update its internal call to `buildSubmitPayload(intakeData)`.
- In `buildSuccessMessage`, delete the `tierName`/proposal branch and keep the plain success copy (the non-proposal text).

- [ ] **Step 2: orchestrator — remove proposal imports, fields, methods**

In `src/features/client/terminal-intake.ts` remove:
- Imports: `import { ProposalBuilderModule } from './proposal-builder';` and `import type { ProposalSelection } from './proposal-builder-types';`
- Fields: `private proposalSelection: ProposalSelection | null = null;` and `private proposalBuilderContainer: HTMLElement | null = null;`
- Methods (whole bodies): `showProposalBuilder()`, `waitForProposalDecision()`, `cleanupProposalBuilder()`.

- [ ] **Step 3: orchestrator — route completion straight to submit**

At the post-review branch that currently does:

```ts
this.addMessage({ type: 'user', content: '[1] Yes, continue to proposal' });
await this.showProposalBuilder();
```

replace with:

```ts
await this.submitIntake();
```

And change the final submit call from:

```ts
const result = await submitIntakeData(this.intakeData, this.proposalSelection);
```

to:

```ts
const result = await submitIntakeData(this.intakeData);
```

Also revise any review-prompt option label offering "proposal" so the completion prompt reads as a direct submit confirmation (e.g. "[1] Yes, submit my request").

- [ ] **Step 4: Verify proposal coupling is gone**

Run: `grep -rniE 'proposal' src/features/client/terminal-intake.ts src/features/client/intake/`
Expected: no matches.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E 'features/client' | head -40`
Expected: no remaining `proposal-builder` errors (other import-drift errors handled in Task 3).

- [ ] **Step 6: Commit**

```bash
git add src/features/client/
git commit -m "refactor(intake): remove out-of-scope proposal-builder coupling"
```

---

## Task 3: Resolve remaining import / type drift

Confirmed still-present (no change needed): `BaseModule` at `src/modules/core/base.ts`, `apiFetch(url, options)` at `src/utils/api-client.ts:309`, `BRANDING.TERMINAL.PROMPT` and `getContactEmail()` at `src/config/branding.ts:66`.

**Files:** any restored file flagged by `tsc`.

- [ ] **Step 1: List remaining typecheck errors**

Run: `npx tsc --noEmit 2>&1 | grep -E 'features/client' | head -60`
Expected: zero or a short list of moved-path / signature-drift errors.

- [ ] **Step 2: Fix each flagged import path**

For each error, correct the import to the current location (use alias `@/...` where siblings do). Likely candidates: `logger`, `getContactEmail`, validation utils, any `@/constants` or `@/utils` path that moved. Make the minimal path edit only — do not refactor logic.

- [ ] **Step 3: Typecheck until clean**

Run: `npx tsc --noEmit 2>&1 | grep -E 'features/client'`
Expected: no output (clean).

- [ ] **Step 4: Lint the restored files**

Run: `npx eslint 'src/features/client/**/*.ts'`
Expected: clean (fix any warnings).

- [ ] **Step 5: Commit**

```bash
git add src/features/client/
git commit -m "fix(intake): repair import drift in restored terminal intake"
```

---

## Task 4: Recover and reconcile the terminal CSS

Missing classes (stripped by later dead-CSS passes): `terminal-title`, `terminal-prompt-line`, `terminal-typing-text`, `terminal-cursor`, `terminal-messages`, plus the full `terminal-window`/`terminal-header`/`intake-modal` chrome. Survivors are scattered in `nav-portal.css` and `client.css`.

**Files:**
- Modify: `src/styles/pages/terminal-intake.css`
- Modify (only if duplicates collide): `src/styles/components/nav-portal.css`, `src/styles/pages/client.css`

- [ ] **Step 1: Dump the pre-deletion terminal CSS to a scratch file for reference**

```bash
git show e9f9095e^:src/styles/pages/terminal-intake.css > /tmp/terminal-intake.orig.css
git show e9f9095e^:src/styles/components/nav-portal.css | sed -n '/intake-modal/,/^}/p' > /tmp/intake-modal.orig.css 2>/dev/null || true
```

- [ ] **Step 2: Identify the classes referenced by restored markup**

Run: `grep -rhoE "class=\"[^\"]*terminal[^\"]*\"|getElementById\('terminal[A-Za-z]+'\)" src/features/client/terminal-intake-ui.ts src/features/client/intake/ | sort -u`
Expected: the full set of `terminal-*` classes/IDs the UI needs.

- [ ] **Step 3: Add the missing classes to `terminal-intake.css`**

From `/tmp/terminal-intake.orig.css`, copy the rule blocks for every class from Step 2 that `grep -l <class> src/styles/` reports as MISSING. Use existing `--color-terminal-*` / `--terminal-*` variables (no hex). Append them under clearly-labeled section comments in `src/styles/pages/terminal-intake.css`.

- [ ] **Step 4: De-duplicate against scattered survivors**

For each class you added, run `grep -rn '<class>' src/styles/`. If the same class is also defined in `nav-portal.css` or `client.css` with terminal-specific (not portal-specific) rules, remove the stray copy so the canonical definition lives only in `terminal-intake.css`. Leave portal-context rules (`.portal ...`) untouched.

- [ ] **Step 5: Verify no class is double-defined**

Run: `for c in terminal-title terminal-prompt-line terminal-typing-text terminal-cursor terminal-messages; do echo "$c: $(grep -rl "\.$c" src/styles | wc -l) file(s)"; done`
Expected: each reported in exactly 1 file.

- [ ] **Step 6: Commit**

```bash
git add src/styles/
git commit -m "style(intake): recover missing terminal CSS, consolidate into terminal-intake.css"
```

---

## Task 5: Wire the modal pop-up (index.html)

The modal chrome, `#open-intake-link`, `#card-intake-link`, close/backdrop/Escape handlers already exist. Only `openIntakeModal()` needs to instantiate the module instead of redirecting.

**Files:**
- Modify: `index.html:1278-1292`

- [ ] **Step 1: Replace the redirect with module instantiation**

In `index.html`, change the `openIntakeModal` function body from the current:

```js
        async function openIntakeModal() {
          console.log('[IntakeModal] Opening modal, terminalModule:', terminalModule ? 'exists' : 'null');
          intakeModal.classList.add('open');
          intakeBackdrop.classList.add('open');
          document.body.style.overflow = 'hidden';

          // Redirect to standalone intake page
          window.location.href = '/client/intake';
          return;
        }
```

to:

```js
        async function openIntakeModal() {
          intakeModal.classList.add('open');
          intakeBackdrop.classList.add('open');
          document.body.style.overflow = 'hidden';

          if (!terminalModule && intakeContainer) {
            const { TerminalIntakeModule } = await import(
              '/src/features/client/terminal-intake.ts'
            );
            terminalModule = new TerminalIntakeModule(intakeContainer, { isModal: true });
            await terminalModule.init();
          }
        }
```

(`terminalModule`, `intakeContainer` are already declared above; `closeIntakeModal` already tears the instance down. Confirm `BaseModule` exposes a public `init()` — `src/modules/core/base.ts:90`; if the public method differs, call that instead.)

- [ ] **Step 2: Manual check — modal opens with terminal UI**

Start the dev server if needed: `npm run dev:full`. In the browser at `http://localhost:4000/`, click the contact "intake form" link.
Expected: the terminal modal opens in-place (no navigation away), shows the `project_intake.sh` window with the typing cursor and avatar. No 401 redirect.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(intake): open terminal intake modal in-place instead of redirecting"
```

---

## Task 6: Wire the standalone /intake page (intake.ejs)

**Files:**
- Modify: `server/views/pages/auth/intake.ejs`

- [ ] **Step 1: Replace the wizard mount with the terminal module**

Change the module script in `server/views/pages/auth/intake.ejs` from importing/calling `mountOnboardingWizard` to:

```html
<script type="module">
  import { TerminalIntakeModule } from '/src/features/client/terminal-intake.ts';
  import { BRANDING } from '/src/config/branding.ts';
  import { setCopyrightYear } from '/src/utils/set-copyright-year.ts';

  setCopyrightYear('auth-copyright-year');

  document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('.terminal-intake-container');
    if (container) {
      try {
        const intake = new TerminalIntakeModule(container, { isModal: false });
        await intake.init();
      } catch (error) {
        console.error('[Intake] Failed to initialize terminal intake:', error);
        container.innerHTML =
          '<div style="text-align: center; padding: 2rem; color: var(--app-color-danger, #ff4444);">' +
          '<h2>Unable to load intake form</h2>' +
          '<p>Please try refreshing the page or contact <a href="mailto:' + BRANDING.CONTACT_EMAIL + '">' + BRANDING.CONTACT_EMAIL + '</a></p>' +
          '</div>';
      }
    }
  });
</script>
```

- [ ] **Step 2: Manual check — standalone page renders the terminal**

Navigate to `http://localhost:4000/intake`.
Expected: the terminal intake renders full-page (`body[data-page="client-intake"]` styling); no redirect to login.

- [ ] **Step 3: Commit**

```bash
git add server/views/pages/auth/intake.ejs
git commit -m "fix(intake): mount terminal intake on /intake instead of broken wizard"
```

---

## Task 7: Guard test — question-flow enums match the server schema

Prevents the restored options from drifting out of sync with `ValidationSchemas.intakeSubmission`.

**Files:**
- Create: `src/features/client/intake/__tests__/schema-parity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { QUESTIONS } from '../../terminal-intake-data';
import { ValidationSchemas } from '../../../../../server/middleware/validation/schemas';

// Map question field -> allowed values pulled from the server validation schema.
function allowedValues(field: string): string[] {
  const rule = (ValidationSchemas.intakeSubmission as Record<string, unknown>)[field];
  const rules = Array.isArray(rule) ? rule : [rule];
  for (const r of rules) {
    if (r && typeof r === 'object' && 'allowedValues' in r) {
      return (r as { allowedValues: string[] }).allowedValues;
    }
  }
  return [];
}

describe('terminal intake question flow matches server schema', () => {
  const enumFields = ['projectType', 'timeline', 'budget', 'projectFor', 'techComfort', 'domainHosting'];

  for (const field of enumFields) {
    it(`every '${field}' option is accepted by the server schema`, () => {
      const server = allowedValues(field);
      expect(server.length).toBeGreaterThan(0);
      const question = QUESTIONS.find((q) => q.field === field);
      if (!question || !question.options) return; // field not collected as a fixed-option question
      for (const opt of question.options) {
        expect(server).toContain(opt.value);
      }
    });
  }
});
```

- [ ] **Step 2: Run it — expect pass, or a precise drift failure**

Run: `npx vitest run src/features/client/intake/__tests__/schema-parity.test.ts`
Expected: PASS. If it FAILS, the message names the exact `field`/value that drifted — fix the option value in `terminal-intake-data.ts` to match the server enum (do not change the server schema), then re-run.

- [ ] **Step 3: Commit**

```bash
git add src/features/client/intake/__tests__/schema-parity.test.ts src/features/client/terminal-intake-data.ts
git commit -m "test(intake): guard question-flow enums against server schema"
```

---

## Task 8: Full verification

- [ ] **Step 1: Typecheck + lint clean**

Run: `npx tsc --noEmit && npx eslint 'src/features/client/**/*.ts'`
Expected: both clean.

- [ ] **Step 2: End-to-end manual repro (the original bug + the fix)**

With `npm run dev:full` running, in the browser:
1. Homepage → click contact "intake form" link → terminal modal opens in-place (no redirect). ✅
2. `/intake` → terminal renders full-page, no login redirect. ✅
3. Complete the chat flow → submit → terminal prints the success line (no 401, no bounce). ✅
4. Confirm server-side: a `clients` row + `projects` row were created and the admin notification fired (check server logs / DB).

- [ ] **Step 3: Confirm the network call**

In DevTools Network tab during submit, verify `POST /api/intake` → `201` (not a 401 to `/api/client-info/onboarding`).

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore(intake): verification fixes for terminal intake restore"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** restore (T1), de-rot incl. proposal strip (T2–T3), CSS recovery+reconcile (T4), modal entry (T5), `/intake` page entry (T6), schema guard test (T7), manual repro (T8). All spec sections covered. Out-of-scope items (proposal-builder, portal "New Project" tab, wizard removal, backend changes) excluded.
- **Placeholders:** none — every step has exact commands/paths/code. The de-rot in T2/T3 is intentionally typecheck-driven because exact drift depends on intervening refactors; known coupling points are enumerated concretely.
- **Type consistency:** `TerminalIntakeModule(container, { isModal })` constructor and `.init()` used identically in T5/T6; `submitIntakeData(intakeData)` / `buildSubmitPayload(intakeData)` single-arg signatures consistent across T2 and the data flow.
