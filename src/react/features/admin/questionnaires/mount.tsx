/**
 * Questionnaires Table Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { QuestionnairesTable } from './QuestionnairesTable';

export interface QuestionnairesMountOptions extends BaseMountOptions {
  /** Filter by client ID */
  clientId?: string;
  /** Filter by project ID */
  projectId?: string;
  /** Callback when questionnaire is clicked for detail view */
  onViewQuestionnaire?: (questionnaireId: number) => void;
}

export const {
  mount: mountQuestionnairesTable,
  unmount: unmountQuestionnairesTable,
  shouldUseReact: shouldUseReactQuestionnairesTable
} = createMountWrapper<QuestionnairesMountOptions>({
  Component: QuestionnairesTable,
  displayName: 'QuestionnairesTable'
});
