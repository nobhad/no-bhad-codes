/**
 * Client Detail Sub-Hooks
 * Each hook handles a single concern within the client detail view.
 */

export { useClientCore } from './useClientCore';
export { useClientContacts } from './useClientContacts';
export { useClientNotes } from './useClientNotes';
export { useClientTags } from './useClientTags';

// Re-export shared types
export type {
  ClientDetailHookOptions,
  ClientDetailData,
  UseClientDetailReturn,
  UseClientDetailOptions
} from './types';
