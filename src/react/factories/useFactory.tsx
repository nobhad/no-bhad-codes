/**
 * ===============================================
 * USE FACTORY HOOKS
 * ===============================================
 * @file src/react/factories/useFactory.ts
 *
 * React hooks for using the factory system.
 */

import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { IconButton, TableActions, getLucideIcon } from './IconButton';
import { ICON_SIZES, CONTEXT_DEFAULTS } from '../../factories/constants';
import { BUTTON_SETS } from '../../factories/buttons/button-sets';
import type { UIContext, ButtonConfig, IconSizeKey } from '../../factories/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useFactory');

// ============================================
// BUTTON FACTORY HOOK
// ============================================

interface UseButtonFactoryOptions {
  /** Default context for all buttons */
  context?: UIContext;
  /** Default click handler */
  onClick?: (action: string, id?: string | number, e?: React.MouseEvent) => void;
}

/**
 * Hook for creating buttons using the factory system.
 *
 * @example
 * const { renderButton, renderButtonGroup } = useButtonFactory({
 *   context: 'table',
 *   onClick: (action, id) => handleAction(action, id)
 * });
 *
 * return (
 *   <TableActions>
 *     {renderButton({ action: 'view', dataId: row.id })}
 *     {renderButton({ action: 'edit', dataId: row.id })}
 *   </TableActions>
 * );
 */
export function useButtonFactory(options: UseButtonFactoryOptions = {}) {
  const { context = 'table', onClick } = options;

  /**
   * Render a single button.
   */
  const renderButton = useCallback(
    (config: ButtonConfig) => {
      const { action, dataId, show = true, ...rest } = config;
      const buttonContext = config.context ?? context;

      if (!show) return null;

      const handleClick = onClick
        ? (e: React.MouseEvent) => onClick(action, dataId, e)
        : undefined;

      return (
        <IconButton
          key={`${action}-${dataId}`}
          action={action}
          context={buttonContext}
          dataId={dataId}
          onClick={handleClick}
          {...rest}
        />
      );
    },
    [context, onClick]
  );

  /**
   * Render multiple buttons.
   */
  const renderButtons = useCallback(
    (configs: ButtonConfig[]) => {
      return configs
        .filter(cfg => cfg.show !== false)
        .map(cfg => renderButton(cfg));
    },
    [renderButton]
  );

  /**
   * Render a button group with wrapper.
   */
  const renderButtonGroup = useCallback(
    (configs: ButtonConfig[], wrapperClass?: string) => {
      const buttons = renderButtons(configs);
      if (buttons.length === 0) return null;

      return (
        <TableActions className={wrapperClass}>
          {buttons}
        </TableActions>
      );
    },
    [renderButtons]
  );

  /**
   * Render a predefined button set.
   */
  const renderButtonSet = useCallback(
    <T extends keyof typeof BUTTON_SETS>(
      setName: T,
      ...args: Parameters<(typeof BUTTON_SETS)[T]>
    ) => {
      const setFn = BUTTON_SETS[setName] as (...args: unknown[]) => ButtonConfig[];
      const configs = setFn(...args);
      return renderButtons(configs);
    },
    [renderButtons]
  );

  return {
    renderButton,
    renderButtons,
    renderButtonGroup,
    renderButtonSet,
    context
  };
}

// ============================================
// ICON SIZE HOOK
// ============================================

interface UseIconSizeOptions {
  /** UI context */
  context?: UIContext;
  /** Override size */
  size?: IconSizeKey | number;
}

/**
 * Hook for getting icon size based on context.
 *
 * @example
 * const iconSize = useIconSize({ context: 'table' }); // 18
 * const iconSize = useIconSize({ context: 'modal' }); // 24
 */
export function useIconSize(options: UseIconSizeOptions = {}): number {
  const { context = 'table', size } = options;

  return useMemo(() => {
    if (typeof size === 'number') {
      return size;
    }
    if (size) {
      return ICON_SIZES[size];
    }
    const defaults = CONTEXT_DEFAULTS[context];
    return ICON_SIZES[defaults.iconSize];
  }, [context, size]);
}

// ============================================
// TABLE ACTIONS HOOK
// ============================================

interface UseTableActionsOptions {
  /** Handler for action clicks */
  onAction: (action: string, id: string | number) => void;
  /** Actions to render per row */
  actions: Array<{
    action: string;
    show?: boolean | ((row: unknown) => boolean);
    disabled?: boolean | ((row: unknown) => boolean);
  }>;
}

/**
 * Hook for common table action patterns.
 *
 * @example
 * const { renderActions } = useTableActions({
 *   onAction: (action, id) => {
 *     switch (action) {
 *       case 'view': handleView(id); break;
 *       case 'edit': handleEdit(id); break;
 *       case 'delete': handleDelete(id); break;
 *     }
 *   },
 *   actions: [
 *     { action: 'view' },
 *     { action: 'edit' },
 *     { action: 'delete', show: (row) => row.canDelete }
 *   ]
 * });
 *
 * return <TableCell>{renderActions(row.id, row)}</TableCell>;
 */
export function useTableActions<T extends { id: string | number }>(
  options: UseTableActionsOptions
) {
  const { onAction, actions } = options;
  const { renderButtonGroup } = useButtonFactory({
    context: 'table',
    onClick: (action, id) => {
      if (id !== undefined) {
        onAction(action, id);
      }
    }
  });

  const renderActions = useCallback(
    (id: string | number, row?: T) => {
      const configs = actions.map(({ action, show, disabled }) => {
        const isVisible = typeof show === 'function' ? show(row) : show ?? true;
        const isDisabled = typeof disabled === 'function' ? disabled(row) : disabled ?? false;

        return {
          action,
          dataId: id,
          show: isVisible,
          disabled: isDisabled
        };
      });

      return renderButtonGroup(configs);
    },
    [actions, renderButtonGroup]
  );

  return { renderActions };
}

// ============================================
// BUTTON SET HOOK
// ============================================

type ButtonSetName = keyof typeof BUTTON_SETS;

interface UseButtonSetOptions {
  /** UI context */
  context?: UIContext;
  /** Handler for action clicks */
  onClick?: (action: string, id?: string | number, e?: React.MouseEvent) => void;
}

/**
 * Hook for using predefined button sets.
 *
 * @example
 * const { renderSet } = useButtonSet({
 *   onClick: (action, id) => handleAction(action, id)
 * });
 *
 * return <TableCell>{renderSet('tableCrud', row.id)}</TableCell>;
 */
export function useButtonSet(options: UseButtonSetOptions = {}) {
  const { context = 'table', onClick } = options;
  const { renderButtons } = useButtonFactory({ context, onClick });

  const renderSet = useCallback(
    <T extends ButtonSetName>(
      setName: T,
      ...args: Parameters<(typeof BUTTON_SETS)[T]>
    ) => {
      const setFn = BUTTON_SETS[setName] as (...args: unknown[]) => ButtonConfig[];
      const configs = setFn(...args);
      return (
        <TableActions>
          {renderButtons(configs)}
        </TableActions>
      );
    },
    [renderButtons]
  );

  return { renderSet };
}

// ============================================
// CONDITIONAL ACTIONS HOOK
// ============================================

type ActionCondition<T> = boolean | ((row: T) => boolean);

interface ConditionalAction<T> {
  /** Action name */
  action: string;
  /** Show condition */
  show?: ActionCondition<T>;
  /** Disabled condition */
  disabled?: ActionCondition<T>;
  /** Custom title override */
  title?: string;
  /** Custom aria-label override */
  ariaLabel?: string;
  /** Additional data attributes */
  dataAttrs?: Record<string, string | number>;
}

interface UseConditionalActionsOptions<T> {
  /** Handler for action clicks */
  onAction: (action: string, id: string | number, row: T) => void;
  /** Actions configuration */
  actions: ConditionalAction<T>[];
  /** UI context */
  context?: UIContext;
}

/**
 * Hook for complex conditional action rendering.
 * Provides more control over action visibility and state.
 *
 * @example
 * const { renderActions } = useConditionalActions({
 *   onAction: (action, id, row) => {
 *     if (action === 'approve') approveItem(id);
 *     if (action === 'reject') rejectItem(id);
 *   },
 *   actions: [
 *     { action: 'view' },
 *     { action: 'approve', show: (row) => row.status === 'pending' },
 *     { action: 'reject', show: (row) => row.status === 'pending' },
 *     { action: 'delete', disabled: (row) => row.isProtected }
 *   ]
 * });
 */
export function useConditionalActions<T extends { id: string | number }>(
  options: UseConditionalActionsOptions<T>
) {
  const { onAction, actions, context = 'table' } = options;

  const resolveCondition = useCallback(
    (condition: ActionCondition<T> | undefined, row: T, defaultValue: boolean): boolean => {
      if (condition === undefined) return defaultValue;
      if (typeof condition === 'function') return condition(row);
      return condition;
    },
    []
  );

  const renderActions = useCallback(
    (row: T) => {
      const configs: ButtonConfig[] = actions.map(
        ({ action, show, disabled, title, ariaLabel, dataAttrs }) => ({
          action,
          dataId: row.id,
          show: resolveCondition(show, row, true),
          disabled: resolveCondition(disabled, row, false),
          title,
          ariaLabel,
          dataAttrs
        })
      );

      const visibleConfigs = configs.filter(cfg => cfg.show !== false);
      if (visibleConfigs.length === 0) return null;

      return (
        <TableActions>
          {visibleConfigs.map(config => (
            <IconButton
              key={`${config.action}-${config.dataId}`}
              action={config.action}
              context={context}
              dataId={config.dataId}
              disabled={config.disabled}
              title={config.title}
              ariaLabel={config.ariaLabel}
              onClick={() => onAction(config.action, row.id, row)}
            />
          ))}
        </TableActions>
      );
    },
    [actions, context, onAction, resolveCondition]
  );

  return { renderActions };
}

// ============================================
// ACTION HANDLER HOOK
// ============================================

type ActionHandler<T> = (id: string | number, row?: T) => void | Promise<void>;

interface UseActionHandlersOptions<T> {
  /** Map of action names to handlers */
  handlers: Record<string, ActionHandler<T>>;
  /** Fallback handler for unknown actions */
  onUnknownAction?: (action: string, id: string | number, row?: T) => void;
}

/**
 * Hook for creating a unified action handler from individual handlers.
 *
 * @example
 * const handleAction = useActionHandlers({
 *   handlers: {
 *     view: (id) => openDetail(id),
 *     edit: (id) => openEditModal(id),
 *     delete: (id) => confirmDelete(id)
 *   }
 * });
 *
 * const { renderActions } = useTableActions({
 *   onAction: handleAction,
 *   actions: [...]
 * });
 */
export function useActionHandlers<T = unknown>(options: UseActionHandlersOptions<T>) {
  const { handlers, onUnknownAction } = options;

  const handleAction = useCallback(
    (action: string, id: string | number, row?: T) => {
      const handler = handlers[action];
      if (handler) {
        handler(id, row);
      } else if (onUnknownAction) {
        onUnknownAction(action, id, row);
      } else {
        logger.warn(`No handler for action: ${action}`);
      }
    },
    [handlers, onUnknownAction]
  );

  return handleAction;
}

// ============================================
// EXPORTS
// ============================================

export { getLucideIcon };
