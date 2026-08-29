# Logger Migration Status

**Status:** Complete (superseded by the React migration)
**Last Updated:** 2026-08-29

## Outcome

This document tracked replacing raw `console.*` calls with the `createLogger` helper across the
vanilla-TS admin dashboard (`src/features/admin/`, since removed). That work is finished, and the
tracking list below is historical: **`src/features/admin/` no longer exists** — it was rebuilt
as a React SPA under `src/react/features/admin/`, so the remaining files in the original queue
were deleted rather than migrated.

## Current State

- `createLogger` is used across the source tree (97 files at last check).
- The only remaining direct `console.*` calls are intentional:

  |File|Why it stays|
  |------|-------------|
  |`src/services/code-protection-service.ts`|Protection tooling that must log before the logger is available|
  |`src/utils/obfuscation-plugin.ts`|Vite build plugin — runs outside the app runtime|
  |`src/config/protection.config.ts`|Build-time configuration|
  |`src/react/components/portal/ErrorBoundary.tsx`|Last-resort error reporting|
  |`src/react/components/portal/RouteErrorBoundary.tsx`|Last-resort error reporting|

## Migration Pattern (for reference)

For each file:

1. Add import: `import { createLogger } from '../../../utils/logger';` (adjust path as needed)
2. Add logger instance: `const logger = createLogger('ModuleName');`
3. Replace `console.error('[ModuleName]'` with `logger.error('`
4. Replace `console.log('[ModuleName]'` with `logger.log('`
5. Replace `console.warn('[ModuleName]'` with `logger.warn('`

## Notes

- No logic changes — only the logging mechanism was replaced.
- New code should use `createLogger` rather than `console.*`; debug logs are stripped outside
  development.
