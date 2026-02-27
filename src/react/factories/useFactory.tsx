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
import { IconButton, ActionButton, TableActions, getLucideIcon } from './IconButton';
import { ICON_SIZES, CONTEXT_DEFAULTS } from '../../factories/constants';
import { BUTTON_ACTIONS } from '../../factories/buttons/button-actions';
import { BUTTON_SETS } from '../../factories/buttons/button-sets';
import type { UIContext, ButtonConfig, IconSizeKey } from '../../factories/types';

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
// EXPORTS
// ============================================

export { getLucideIcon };
