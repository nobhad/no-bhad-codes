/**
 * Knowledge Base Mount
 * Island architecture mount using createMountWrapper factory
 */

import { createMountWrapper, type BaseMountOptions } from '@/react/factories';
import { KnowledgeBase } from './KnowledgeBase';

export interface KnowledgeBaseMountOptions extends BaseMountOptions {
  /** Callback when article is clicked for detail view */
  onViewArticle?: (articleId: number) => void;
}

export const {
  mount: mountKnowledgeBase,
  unmount: unmountKnowledgeBase,
  shouldUseReact: shouldUseReactKnowledgeBase
} = createMountWrapper<KnowledgeBaseMountOptions>({
  Component: KnowledgeBase,
  displayName: 'KnowledgeBase'
});
