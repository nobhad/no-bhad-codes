/// <reference types="vite/client" />

/**
 * Vite environment variable type definitions
 * Add VITE_ prefixed env vars here for TypeScript support
 */
interface ImportMetaEnv {
  // Contact form services
  readonly VITE_FORMSPREE_FORM_ID?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID?: string;
  readonly VITE_EMAILJS_PUBLIC_KEY?: string;

  // Base URL for the app
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
