// i18n-middleware.ts
// Express middleware for backend localization

import type { Request, Response, NextFunction } from 'express';

export type Locale = 'en' | 'es' | 'fr';

const translations: Record<Locale, Record<string, string>> = {
  en: {
    greeting: 'Hello',
    farewell: 'Goodbye',
  },
  es: {
    greeting: 'Hola',
    farewell: 'Adiós',
  },
  fr: {
    greeting: 'Bonjour',
    farewell: 'Au revoir',
  },
};

export function detectLocale(req: Request): Locale {
  const lang = req.headers['accept-language']?.split(',')[0]?.slice(0, 2);
  if (lang === 'es' || lang === 'fr') return lang;
  return 'en';
}

export function t(locale: Locale, key: string): string {
  return translations[locale][key] || key;
}

export function i18nMiddleware(req: Request, res: Response, next: NextFunction) {
  req.locale = detectLocale(req);
  req.t = (key: string) => t(req.locale ?? 'en', key);
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      locale?: Locale;
      t?: (key: string) => string;
    }
  }
}
