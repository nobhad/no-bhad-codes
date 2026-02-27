import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Admin Dashboard State
 * Manages state for the admin dashboard React components
 */
export interface AdminState {
  // Current active tab in admin dashboard
  currentTab: string;

  // Loading states
  isLoading: boolean;

  // Selected items (for batch operations)
  selectedIds: Set<string>;

  // Filter/search state
  searchQuery: string;
  filters: Record<string, string | string[]>;

  // Actions
  setCurrentTab: (tab: string) => void;
  setLoading: (loading: boolean) => void;
  setSelectedIds: (ids: Set<string>) => void;
  toggleSelectedId: (id: string) => void;
  clearSelection: () => void;
  setSearchQuery: (query: string) => void;
  setFilter: (key: string, value: string | string[]) => void;
  clearFilters: () => void;
  reset: () => void;
}

const initialState = {
  currentTab: 'projects',
  isLoading: false,
  selectedIds: new Set<string>(),
  searchQuery: '',
  filters: {} as Record<string, string | string[]>
};

export const useAdminStore = create<AdminState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setCurrentTab: (tab) => set({ currentTab: tab }, false, 'setCurrentTab'),

      setLoading: (loading) => set({ isLoading: loading }, false, 'setLoading'),

      setSelectedIds: (ids) => set({ selectedIds: ids }, false, 'setSelectedIds'),

      toggleSelectedId: (id) => {
        const current = get().selectedIds;
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        set({ selectedIds: next }, false, 'toggleSelectedId');
      },

      clearSelection: () => set({ selectedIds: new Set() }, false, 'clearSelection'),

      setSearchQuery: (query) => set({ searchQuery: query }, false, 'setSearchQuery'),

      setFilter: (key, value) =>
        set(
          (state) => ({
            filters: { ...state.filters, [key]: value }
          }),
          false,
          'setFilter'
        ),

      clearFilters: () => set({ filters: {}, searchQuery: '' }, false, 'clearFilters'),

      reset: () => set(initialState, false, 'reset')
    }),
    { name: 'admin-store' }
  )
);

// Selector hooks for common state slices
export const useCurrentTab = () => useAdminStore((state) => state.currentTab);
export const useIsLoading = () => useAdminStore((state) => state.isLoading);
export const useSelectedIds = () => useAdminStore((state) => state.selectedIds);
export const useSearchQuery = () => useAdminStore((state) => state.searchQuery);
export const useFilters = () => useAdminStore((state) => state.filters);
