# Standardized Error Handling Pattern

## Pattern Overview

- Use a unified logger utility (`logger.error`, `logger.warn`, `logger.info`) for all error handling in both backend and frontend modules.
- Always log errors in catch blocks, including error context.
- Avoid silent catches; handle or log all errors.
- For frontend, optionally report critical errors to a global handler (e.g., `window.onerror`).
- Throw errors with descriptive messages after logging, when necessary.

## Example Usage

```typescript
try {
  // ...code...
} catch (error) {
  logger.error('Descriptive error message', error);
  // Optionally rethrow or handle
}
```

## Implementation

- Backend: Use the existing logger service.
- Frontend: Use `src/services/logger.ts` utility.
- Replace direct `console.error` and silent catches with logger calls.

## Migration Checklist

- [x] Logger utility created for frontend
- [x] Sample module updated (data-service.ts)
- [ ] Backend sample module updated
- [ ] All modules migrated to standardized pattern

---

For further details, see `docs/current_work.md` and update as modules are migrated.
