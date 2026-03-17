/**
 * ===============================================
 * SUBTAB CONTEXT
 * ===============================================
 * @file src/react/contexts/SubtabContext.tsx
 *
 * React context for managing subtab state across the portal.
 * Replaces the vanilla JS custom DOM event system.
 *
 * - PortalSubtabs reads activeSubtab and renders actions
 * - Dashboard components read activeSubtab and call setActions
 * - Zero DOM events, pure React state flow
 */

import * as React from 'react';

interface SubtabContextValue {
  /** Currently active subtab ID (e.g., 'overview', 'revenue', 'leads') */
  activeSubtab: string;
  /** Set the active subtab */
  setSubtab: (subtab: string) => void;
  /** React node to render as actions on the right side of the subtab row */
  actions: React.ReactNode;
  /** Set the actions to render in the subtab row (call from dashboard components) */
  setActions: (actions: React.ReactNode) => void;
}

const SubtabContext = React.createContext<SubtabContextValue>({
  activeSubtab: 'overview',
  setSubtab: () => {},
  actions: null,
  setActions: () => {}
});

export function SubtabProvider({ children }: { children: React.ReactNode }) {
  const [activeSubtab, setActiveSubtab] = React.useState('overview');
  const [actions, setActions] = React.useState<React.ReactNode>(null);

  const setSubtab = React.useCallback((subtab: string) => {
    setActiveSubtab(subtab);
  }, []);

  const value = React.useMemo(
    () => ({ activeSubtab, setSubtab, actions, setActions }),
    [activeSubtab, setSubtab, actions]
  );

  return (
    <SubtabContext.Provider value={value}>
      {children}
    </SubtabContext.Provider>
  );
}

/** Read the active subtab */
export function useActiveSubtab(): string {
  return React.useContext(SubtabContext).activeSubtab;
}

/** Set the active subtab */
export function useSetSubtab(): (subtab: string) => void {
  return React.useContext(SubtabContext).setSubtab;
}

/** Get the actions ReactNode (used by PortalSubtabs to render) */
export function useSubtabActions(): React.ReactNode {
  return React.useContext(SubtabContext).actions;
}

/** Set actions to render in the subtab row (used by dashboard components) */
export function useSetSubtabActions(): (actions: React.ReactNode) => void {
  return React.useContext(SubtabContext).setActions;
}

/** Full context hook */
export function useSubtabContext(): SubtabContextValue {
  return React.useContext(SubtabContext);
}
