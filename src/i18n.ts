/**
 * ===============================================
 * INTERNATIONALIZATION (i18n)
 * ===============================================
 * @file src/i18n.ts
 *
 * Frontend localization with browser locale detection.
 * Provides translation lookup and locale switching.
 */

export type Locale = 'en' | 'es' | 'fr';

export interface Messages {
  [key: string]: string;
}

const translations: Record<Locale, Messages> = {
  en: {
    // Common
    loading: 'Loading...',
    error: 'An error occurred',
    success: 'Success',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    submit: 'Submit',
    back: 'Back',
    next: 'Next',
    // Forms
    required: 'This field is required',
    invalidEmail: 'Please enter a valid email address',
    // Empty states
    noResults: 'No results found',
    noData: 'No data available'
  },
  es: {
    loading: 'Cargando...',
    error: 'Ocurrió un error',
    success: 'Éxito',
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    submit: 'Enviar',
    back: 'Atrás',
    next: 'Siguiente',
    required: 'Este campo es obligatorio',
    invalidEmail: 'Por favor ingrese un correo electrónico válido',
    noResults: 'No se encontraron resultados',
    noData: 'No hay datos disponibles'
  },
  fr: {
    loading: 'Chargement...',
    error: 'Une erreur est survenue',
    success: 'Succès',
    cancel: 'Annuler',
    save: 'Enregistrer',
    delete: 'Supprimer',
    edit: 'Modifier',
    close: 'Fermer',
    submit: 'Soumettre',
    back: 'Retour',
    next: 'Suivant',
    required: 'Ce champ est obligatoire',
    invalidEmail: 'Veuillez entrer une adresse e-mail valide',
    noResults: 'Aucun résultat trouvé',
    noData: 'Aucune donnée disponible'
  }
};

const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'fr'];
const DEFAULT_LOCALE: Locale = 'en';

let currentLocale: Locale = DEFAULT_LOCALE;

/**
 * Detect browser locale and return supported locale
 */
function detectBrowserLocale(): Locale {
  const browserLang = navigator.language?.split('-')[0] || DEFAULT_LOCALE;
  return SUPPORTED_LOCALES.includes(browserLang as Locale)
    ? (browserLang as Locale)
    : DEFAULT_LOCALE;
}

/**
 * Initialize i18n with browser locale detection
 */
export function initI18n(): Locale {
  currentLocale = detectBrowserLocale();
  return currentLocale;
}

/**
 * Get current locale
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Set locale manually
 */
export function setLocale(locale: Locale): void {
  if (SUPPORTED_LOCALES.includes(locale)) {
    currentLocale = locale;
  }
}

/**
 * Translate a key to the current locale
 * Returns the key itself if translation not found
 */
export function t(key: string): string {
  return translations[currentLocale]?.[key] ?? translations[DEFAULT_LOCALE]?.[key] ?? key;
}

/**
 * Get all supported locales
 */
export function getSupportedLocales(): Locale[] {
  return [...SUPPORTED_LOCALES];
}
