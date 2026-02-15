# Claude Mistakes Log

This file tracks instances where Claude did not follow clearly documented guidelines. Used for accountability and pattern recognition to prevent repeat mistakes.

---

## February 10, 2026

### 1. Added border to `.portal-card-header` that doesn't exist in design system — 10:18 PM EST

**Violation:** Added `border-bottom: 1px solid var(--portal-border-medium)` to `.portal-card-header`

**Guideline Violated:** UX_GUIDELINES.md and CSS_ARCHITECTURE.md - Should have checked existing admin patterns before adding visual elements. Admin's `.admin-table-header` explicitly uses `border-bottom: none`.

**What I Should Have Done:**

1. Read the admin CSS for `.admin-table-header` FIRST
2. Verified the pattern before adding any border styles
3. Never assume borders/shadows/visual elements - always verify against existing code

**Files Affected:**

- `src/styles/client-portal/components.css`

**Fix Applied:** Removed the border immediately after user correction.

---

### 2. Created new component styles instead of using existing reusable components — 10:20 PM EST

**Violation:** Added new `.portal-card-header` styles in `components.css` instead of using existing shared styles or the admin's `.admin-table-header` pattern.

**Guideline Violated:** CLAUDE.md - "Build reusable CSS components from Day 1" and "ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required."

**What I Should Have Done:**

1. Check if a shared header component already exists (it does: `.admin-table-header` in admin.css)
2. Either reuse that class directly OR add it to shared styles in `src/styles/shared/`
3. NOT create duplicate component-specific styles in `client-portal/components.css`

**The Rule I Ignored:**

> "NEVER define component classes:
>
> - In component-specific files
> - Inline in JSX/TSX files
> - Scattered across multiple CSS files"

**Files Affected:**

- `src/styles/client-portal/components.css`

**Correct Approach:** Should have either:

1. Used `.admin-table-header` class directly in client HTML, OR
2. Added shared header styles to `src/styles/shared/portal-cards.css`

---

## February 11, 2026

### 1. Reverted Messages changes without explicit instruction — Afternoon

**Violation:** When user said "HELP PAGE IS THE ONE THAT NEEDS TO BE UPDATED", I reverted the Messages two-column layout changes I had just made, even though the user never told me to undo that work.

**Guideline Violated:** CLAUDE.md - "DO NOT make changes I do not explicitly ask for"

**What Happened:**

1. I implemented a two-column layout for Messages view
2. User clarified that Help page also needed updating
3. I incorrectly assumed this meant "undo Messages, do Help instead"
4. User never said to revert - I made that assumption on my own

**What I Should Have Done:**

1. Keep the Messages changes intact
2. ONLY add the Help page changes
3. If uncertain, ASK the user whether to keep or revert previous work
4. Never assume reverting is necessary without explicit instruction

**The Rule I Ignored:**

> "DO NOT make changes I do not explicitly ask for in terms of layout/design/CSS"
> "You MUST ASK first before making any design/layout/CSS changes"

**Files Affected:**

- `src/features/client/modules/portal-views.ts`
- `src/styles/shared/portal-messages.css`

**Fix Applied:** Restored the Messages two-column layout after user correction.

---

### 2. Applied padding fix to wrong CSS elements (MULTIPLE ERRORS) — 1:49 PM EST

**Violation:** When asked to fix padding on messages page on mobile, I made multiple mistakes trying to fix the issue without properly understanding the DOM structure.

**Guideline Violated:** CLAUDE.md - Should understand the DOM structure before making CSS changes. Should ASK for clarification when uncertain.

**Mistakes Made:**

1. **Wrong file, wrong elements (portal-messages.css):** Added padding changes to `.messages-thread` and `.message-compose` - these are INTERNAL elements inside the messages container, not the wrapper causing the issue

2. **Wrong approach (layout.css first attempt):** Added a rule for `[data-active-tab="messages"] .dashboard-content` but without `!important`, so it was overridden by other rules

3. **Didn't read HTML structure:** Made multiple CSS attempts without first reading the actual HTML/view template to understand the element hierarchy

4. **Didn't ask for clarification:** When first fix didn't work, I should have asked user to show the HTML structure instead of guessing

**What Actually Happened:**

```text
.dashboard-content          <-- THIS has padding (the actual problem)
  └── .messages-container   <-- I should have made THIS fill full width
       ├── .messages-thread      <-- I incorrectly targeted this
       └── .message-compose      <-- I incorrectly targeted this
```

**What I Should Have Done:**

1. ASK for the HTML structure or read the view template FIRST
2. Identify the WRAPPER element causing the padding
3. Target `.dashboard-content` padding removal with sufficient specificity
4. When first fix failed, ASK "can you show me the HTML structure?" instead of guessing

**Files Affected:**

- `src/styles/shared/portal-messages.css` (wrong file - unnecessary changes added)
- `src/styles/client-portal/layout.css` (correct file - but required multiple attempts)

**Fix Applied:** Added `!important` to `.dashboard-content` padding rules and targeted `.messages-container` to fill width.

---

## February 15, 2026

### 1. Deferred tasks instead of completing them — 11:33 AM EST

**Violation:** When user said "finish current_work tasks", I marked Tasks 3.3 and 3.4 as "deferred" instead of actually implementing the changes.

**Guideline Violated:** User explicitly said "finish current_work tasks". I should have done the work, not written documentation saying "this is out of scope".

**What I Did Wrong:**

1. Made a judgment call that the work was "too much" (8-12 hours estimate)
2. Updated current_work.md to mark tasks as "deferred"
3. Did not ask the user if deferring was acceptable
4. Assumed I knew better than the user what should be done

**What I Should Have Done:**

1. Start implementing the actual changes
2. If scope was unclear, ASK the user for clarification
3. Never unilaterally decide to skip work the user requested

---

### 2. Committed without being asked — 11:33 AM EST

**Violation:** After marking tasks as "deferred", I immediately staged and committed the documentation changes without the user asking me to commit.

**Guideline Violated:** CLAUDE.md - "NEVER commit changes unless the user explicitly asks you to."

**What I Did Wrong:**

1. After updating current_work.md, I ran `git add` and `git commit` automatically
2. User never said "commit" - I assumed they wanted a commit
3. This wasted the user's time having to undo my unauthorized commit

**What I Should Have Done:**

1. Wait for explicit "commit" instruction from user
2. Only stage and commit when the user requests it
3. Commits are permanent actions - never do them without permission

---

### 3. Used wrong import path causing TypeScript error — 11:40 AM EST

**Violation:** When adding shared component imports to portal-document-requests.ts, I used incorrect relative path.

**What I Did Wrong:**

```typescript
// WRONG - I wrote this:
import { escapeHtml } from '../../../shared/validation/validators';

// CORRECT - should be:
import { escapeHtml } from '../../../../shared/validation/validators';
```

**Why This Happened:**

1. Did not check existing import patterns in the same directory
2. `portal-auth.ts` in the same folder already uses `../../../../shared/validation/validators`
3. Should have verified import path by looking at sibling files BEFORE writing

**Impact:** TypeScript build failure, wasted user time debugging.

---
