/**
 * ===============================================
 * INTEGRATIONS INDEX
 * ===============================================
 * @file server/services/integrations/index.ts
 *
 * Barrel file for all integration services.
 */

export * from './zapier-service';
export * from './slack-service';
export * from './stripe-service';
export * from './calendar-service';

// Default exports for convenience
import zapierService from './zapier-service';
import slackService from './slack-service';
import stripeService from './stripe-service';
import calendarService from './calendar-service';

export {
  zapierService,
  slackService,
  stripeService,
  calendarService
};
