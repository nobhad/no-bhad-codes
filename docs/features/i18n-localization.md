# i18n/Localization Feature Documentation

**Last Updated:** February 15, 2026

## Overview

This document describes the i18n/Localization feature for both frontend and backend, enabling multi-language support across the application.

---

## Frontend Implementation

- **Module:** `src/i18n.ts`
- **Locale Support:** English (`en`), Spanish (`es`), French (`fr`) — extendable
- **API:**
  - `setLocale(locale: Locale)`: Switches the current language
  - `t(key: string)`: Returns the localized string for the given key
- **Usage Example:**

  ```ts
  import { t, setLocale } from './i18n';
  setLocale('es');
  t('greeting'); // 'Hola'
  ```

- **Integration:**
  - Use `t('key')` in UI components for all user-facing text
  - Add new keys to the `translations` object as needed

---

## Backend Implementation

- **Middleware:** `server/middleware/i18n-middleware.ts`
- **Locale Detection:** Uses `Accept-Language` header, defaults to `en`
- **API:**
  - `req.locale`: Detected locale for the request
  - `req.t(key: string)`: Returns the localized string for the given key
- **Integration:**
  - Register middleware in `server/app.ts`:

    ```ts
    import { i18nMiddleware } from './middleware/i18n-middleware';
    app.use(i18nMiddleware);
    ```

  - Use `req.t('key')` in route handlers for localized responses

---

## Extending Localization

- Add new locales by updating the `translations` object in both frontend and backend modules
- Add new translation keys as needed for new features

---

## Testing

- Switch locale and verify UI/response text changes accordingly
- Ensure fallback to key if translation is missing

---

## Related Files

- `src/i18n.ts` (frontend)
- `server/middleware/i18n-middleware.ts` (backend)
- `server/app.ts` (middleware registration)

---

## Revision History

- **2026-02-15:** Initial implementation and documentation

---

## Contact

For questions or to request new locales, contact the repository maintainer.
