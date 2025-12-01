/**
 * ===============================================
 * MAIN APPLICATION ENTRY POINT
 * ===============================================
 * @file src/main.ts
 *
 * Main entry point for the NO BHAD WORKS application.
 * Initializes the application with the new architecture.
 */

// Import new modular CSS architecture
import './styles/main-new.css';

// Import and initialize application
import { app } from './core/app';

// Export for debugging
export { app };

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).NBW_APP = app;
}
