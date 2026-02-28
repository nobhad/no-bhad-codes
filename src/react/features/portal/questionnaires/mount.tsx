/**
 * Portal Questionnaires Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { PortalQuestionnairesView } from './PortalQuestionnairesView';

export interface PortalQuestionnairesMountOptions extends BaseMountOptions {}

export const {
  mount: mountPortalQuestionnaires,
  unmount: unmountPortalQuestionnaires,
  shouldUseReact: shouldUseReactPortalQuestionnaires
} = createMountWrapper<PortalQuestionnairesMountOptions>({
  Component: PortalQuestionnairesView,
  displayName: 'PortalQuestionnairesView'
});
