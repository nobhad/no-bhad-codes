/**
 * Project Detail Sub-Hooks
 * Each hook handles a single concern of the project detail feature.
 */

export { useProjectCore } from './useProjectCore';
export { useProjectMilestones } from './useProjectMilestones';
export { useProjectFiles } from './useProjectFiles';
export { useProjectInvoices } from './useProjectInvoices';
export { useProjectMessages } from './useProjectMessages';

// Re-export shared types
export type {
  AuthTokenGetter,
  ProjectDetailHookOptions,
  UseProjectDetailOptions,
  ProjectDetailData,
  UseProjectDetailReturn
} from './types';
