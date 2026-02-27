/**
 * ===============================================
 * BUTTON FACTORY
 * ===============================================
 * @file src/factories/buttons/button-factory.ts
 *
 * Core button rendering functions.
 * Creates consistent icon buttons with proper sizing and accessibility.
 */

import { ICON_SIZES, CONTEXT_DEFAULTS } from '../constants';
import type { ButtonConfig, ButtonGroupConfig, UIContext } from '../types';
import { renderIcon } from '../icons/icon-factory';
import { getButtonAction } from './button-actions';
import { BUTTON_SETS, getButtonSet, type ButtonSetName } from './button-sets';

// ============================================
// BUTTON RENDERING
// ============================================

/**
 * Get icon size for a given context.
 */
function getIconSizeForContext(context: UIContext = 'table'): number {
  const defaults = CONTEXT_DEFAULTS[context];
  return ICON_SIZES[defaults.iconSize];
}

/**
 * Render a single icon button as HTML string.
 */
export function renderButton(config: ButtonConfig): string {
  const {
    action,
    context = 'table',
    dataId,
    dataAttrs = {},
    title,
    ariaLabel,
    className = '',
    disabled = false,
    show = true,
    variant
  } = config;

  if (!show) return '';

  const actionDef = getButtonAction(action);
  if (!actionDef) {
    console.warn(`[ButtonFactory] Unknown action: ${action}`);
    return '';
  }

  const buttonTitle = title ?? actionDef.title;
  const buttonAriaLabel = ariaLabel ?? actionDef.ariaLabel;
  const buttonVariant = variant ?? actionDef.variant;
  const iconSize = getIconSizeForContext(context);

  // Render the icon
  const iconHtml = renderIcon({
    name: actionDef.icon,
    size: iconSize,
    ariaHidden: true
  });

  if (!iconHtml) {
    console.warn(`[ButtonFactory] Icon not found for action: ${action}`);
    return '';
  }

  // Build data attributes
  const dataAttrEntries: [string, string | number | boolean][] = [['data-action', action]];

  if (dataId !== undefined) {
    dataAttrEntries.push(['data-id', dataId]);
  }

  for (const [key, value] of Object.entries(dataAttrs)) {
    dataAttrEntries.push([`data-${key}`, value]);
  }

  const dataAttrStr = dataAttrEntries.map(([k, v]) => `${k}="${v}"`).join(' ');

  // Build class names
  const classNames = ['icon-btn'];
  if (buttonVariant && buttonVariant !== 'default') {
    classNames.push(`icon-btn-${buttonVariant}`);
  }
  if (className) {
    classNames.push(className);
  }

  const disabledAttr = disabled ? 'disabled' : '';

  return `<button type="button" class="${classNames.join(' ')}" ${dataAttrStr} title="${buttonTitle}" aria-label="${buttonAriaLabel}" ${disabledAttr}>${iconHtml}</button>`;
}

/**
 * Render multiple buttons as HTML string (no wrapper).
 */
export function renderButtons(configs: ButtonConfig[]): string {
  return configs
    .map((config) => renderButton(config))
    .filter(Boolean)
    .join('');
}

/**
 * Render a button group with wrapper.
 */
export function renderButtonGroup(config: ButtonGroupConfig): string {
  const { context, buttons, wrapperClass = '' } = config;

  // Apply context to all buttons
  const contextualButtons = buttons.map((btn) => ({
    ...btn,
    context: btn.context ?? context
  }));

  const buttonsHtml = renderButtons(contextualButtons);
  if (!buttonsHtml) return '';

  const defaults = CONTEXT_DEFAULTS[context];
  const className = ['button-group', wrapperClass].filter(Boolean).join(' ');

  return `<div class="${className}" style="display:flex;gap:${defaults.gap}px">${buttonsHtml}</div>`;
}

/**
 * Render table actions cell (convenience wrapper).
 */
export function renderActionsCell(configs: ButtonConfig[], context: UIContext = 'table'): string {
  const buttonsHtml = renderButtons(configs.map((cfg) => ({ ...cfg, context })));

  if (!buttonsHtml) return '';
  return `<div class="table-actions">${buttonsHtml}</div>`;
}

/**
 * Render a predefined button set.
 */
export function renderButtonSet<T extends ButtonSetName>(
  setName: T,
  context: UIContext = 'table',
  ...args: Parameters<(typeof BUTTON_SETS)[T]>
): string {
  const buttons = getButtonSet(setName, ...args);
  return renderButtons(buttons.map((btn) => ({ ...btn, context })));
}

// ============================================
// DOM CREATION
// ============================================

/**
 * Create a button element.
 */
export function createButton(config: ButtonConfig): HTMLButtonElement | null {
  const html = renderButton(config);
  if (!html) return null;

  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild as HTMLButtonElement;
}

/**
 * Create multiple button elements.
 */
export function createButtons(configs: ButtonConfig[]): HTMLButtonElement[] {
  return configs
    .map((config) => createButton(config))
    .filter((btn): btn is HTMLButtonElement => btn !== null);
}

/**
 * Create a button group element.
 */
export function createButtonGroup(config: ButtonGroupConfig): HTMLElement | null {
  const html = renderButtonGroup(config);
  if (!html) return null;

  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild as HTMLElement;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a simple action config.
 */
export function createAction(
  action: string,
  dataId?: string | number,
  options?: Partial<Omit<ButtonConfig, 'action' | 'dataId'>>
): ButtonConfig {
  return { action, dataId, ...options };
}

/**
 * Create a conditional action (only shows when condition is true).
 */
export function conditionalAction(
  condition: boolean,
  action: string,
  dataId?: string | number,
  options?: Partial<Omit<ButtonConfig, 'action' | 'dataId' | 'show'>>
): ButtonConfig {
  return { action, dataId, show: condition, ...options };
}

// Re-export for convenience
export { BUTTON_ACTIONS, getButtonAction, isValidAction } from './button-actions';
export { BUTTON_SETS, getButtonSet, applyContextToSet } from './button-sets';
