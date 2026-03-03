/**
 * ===============================================
 * ADMIN COMMAND PALETTE INTEGRATION
 * ===============================================
 * @file src/features/admin/admin-command-palette.ts
 *
 * Integrates the command palette with the admin dashboard.
 * Provides navigation, actions, and search functionality.
 */

import {
  initCommandPalette,
  addRecentItem,
  destroyCommandPalette,
  isPaletteOpen,
  type CommandItem
} from '../../components/command-palette';
import {
  initTableKeyboardNav,
  destroyAllTableKeyboardNav,
  type TableKeyboardNavConfig
} from '../../components/table-keyboard-nav';
import { ICONS } from '../../constants/icons';

// ============================================================================
// TYPES
// ============================================================================

interface AdminCommandPaletteConfig {
  /** Function to switch to a specific tab */
  switchTab: (tab: string) => void;
  /** Function to show client details */
  showClientDetails?: (clientId: number) => void;
  /** Function to show project details */
  showProjectDetails?: (projectId: number) => void;
  /** Function to create a new client */
  createClient?: () => void;
  /** Function to create a new project */
  createProject?: () => void;
  /** Function to create a new invoice */
  createInvoice?: () => void;
  /** Function to log out */
  logout: () => void;
}

// ============================================================================
// COMMAND ITEMS
// ============================================================================

/**
 * Build navigation command items
 */
function buildNavigationItems(config: AdminCommandPaletteConfig): CommandItem[] {
  return [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      shortcut: '⌘1',
      icon: ICONS.LAYOUT_DASHBOARD,
      section: 'navigation',
      keywords: ['home', 'dashboard', 'main'],
      action: () => {
        config.switchTab('dashboard');
        addRecentItem({
          id: 'nav-dashboard',
          label: 'Dashboard',
          icon: ICONS.LAYOUT_DASHBOARD,
          action: () => config.switchTab('dashboard')
        });
      }
    },
    {
      id: 'nav-clients',
      label: 'Clients',
      shortcut: '⌘2',
      icon: ICONS.USERS,
      section: 'navigation',
      keywords: ['customers', 'accounts'],
      action: () => {
        config.switchTab('clients');
        addRecentItem({
          id: 'nav-clients',
          label: 'Clients',
          icon: ICONS.USERS,
          action: () => config.switchTab('clients')
        });
      }
    },
    {
      id: 'nav-projects',
      label: 'Projects',
      shortcut: '⌘3',
      icon: ICONS.BRIEFCASE,
      section: 'navigation',
      keywords: ['work', 'jobs'],
      action: () => {
        config.switchTab('projects');
        addRecentItem({
          id: 'nav-projects',
          label: 'Projects',
          icon: ICONS.BRIEFCASE,
          action: () => config.switchTab('projects')
        });
      }
    },
    {
      id: 'nav-invoices',
      label: 'Invoices',
      shortcut: '⌘4',
      icon: ICONS.RECEIPT,
      section: 'navigation',
      keywords: ['billing', 'payments', 'money'],
      action: () => {
        config.switchTab('invoices');
        addRecentItem({
          id: 'nav-invoices',
          label: 'Invoices',
          icon: ICONS.RECEIPT,
          action: () => config.switchTab('invoices')
        });
      }
    },
    {
      id: 'nav-contracts',
      label: 'Contracts',
      shortcut: '⌘5',
      icon: ICONS.FILE_SIGNATURE,
      section: 'navigation',
      keywords: ['agreements', 'documents', 'signatures'],
      action: () => {
        config.switchTab('contracts');
        addRecentItem({
          id: 'nav-contracts',
          label: 'Contracts',
          icon: ICONS.FILE_SIGNATURE,
          action: () => config.switchTab('contracts')
        });
      }
    },
    {
      id: 'nav-messages',
      label: 'Messages',
      shortcut: '⌘6',
      icon: ICONS.MESSAGE_SQUARE,
      section: 'navigation',
      keywords: ['chat', 'communication', 'inbox'],
      action: () => {
        config.switchTab('messages');
        addRecentItem({
          id: 'nav-messages',
          label: 'Messages',
          icon: ICONS.MESSAGE_SQUARE,
          action: () => config.switchTab('messages')
        });
      }
    },
    {
      id: 'nav-leads',
      label: 'Leads',
      icon: ICONS.INBOX,
      section: 'navigation',
      keywords: ['prospects', 'contacts', 'crm'],
      action: () => {
        config.switchTab('leads');
        addRecentItem({
          id: 'nav-leads',
          label: 'Leads',
          icon: ICONS.INBOX,
          action: () => config.switchTab('leads')
        });
      }
    },
    {
      id: 'nav-contacts',
      label: 'Contacts',
      icon: ICONS.USER,
      section: 'navigation',
      keywords: ['people', 'submissions', 'forms'],
      action: () => {
        config.switchTab('contacts');
        addRecentItem({
          id: 'nav-contacts',
          label: 'Contacts',
          icon: ICONS.USER,
          action: () => config.switchTab('contacts')
        });
      }
    },
    {
      id: 'nav-tasks',
      label: 'Tasks',
      icon: ICONS.CHECK_SQUARE,
      section: 'navigation',
      keywords: ['todo', 'checklist'],
      action: () => {
        config.switchTab('tasks');
        addRecentItem({
          id: 'nav-tasks',
          label: 'Tasks',
          icon: ICONS.CHECK_SQUARE,
          action: () => config.switchTab('tasks')
        });
      }
    },
    {
      id: 'nav-analytics',
      label: 'Analytics',
      icon: ICONS.BAR_CHART,
      section: 'navigation',
      keywords: ['stats', 'metrics', 'data'],
      action: () => {
        config.switchTab('analytics');
        addRecentItem({
          id: 'nav-analytics',
          label: 'Analytics',
          icon: ICONS.BAR_CHART,
          action: () => config.switchTab('analytics')
        });
      }
    },
    {
      id: 'nav-ad-hoc-requests',
      label: 'Ad Hoc Requests',
      icon: ICONS.ZAPPY,
      section: 'navigation',
      keywords: ['requests', 'support', 'tickets'],
      action: () => {
        config.switchTab('ad-hoc-requests');
        addRecentItem({
          id: 'nav-ad-hoc-requests',
          label: 'Ad Hoc Requests',
          icon: ICONS.ZAPPY,
          action: () => config.switchTab('ad-hoc-requests')
        });
      }
    },
    {
      id: 'nav-questionnaires',
      label: 'Questionnaires',
      icon: ICONS.CLIPBOARD,
      section: 'navigation',
      keywords: ['forms', 'surveys', 'intake'],
      action: () => {
        config.switchTab('questionnaires');
        addRecentItem({
          id: 'nav-questionnaires',
          label: 'Questionnaires',
          icon: ICONS.CLIPBOARD,
          action: () => config.switchTab('questionnaires')
        });
      }
    },
    {
      id: 'nav-knowledge-base',
      label: 'Knowledge Base',
      icon: ICONS.BOOK_OPEN,
      section: 'navigation',
      keywords: ['docs', 'documentation', 'help', 'faq'],
      action: () => {
        config.switchTab('knowledge-base');
        addRecentItem({
          id: 'nav-knowledge-base',
          label: 'Knowledge Base',
          icon: ICONS.BOOK_OPEN,
          action: () => config.switchTab('knowledge-base')
        });
      }
    },
    {
      id: 'nav-system',
      label: 'System Status',
      icon: ICONS.SETTINGS,
      section: 'navigation',
      keywords: ['settings', 'config', 'status'],
      action: () => {
        config.switchTab('system');
        addRecentItem({
          id: 'nav-system',
          label: 'System Status',
          icon: ICONS.SETTINGS,
          action: () => config.switchTab('system')
        });
      }
    }
  ];
}

/**
 * Build action command items
 */
function buildActionItems(config: AdminCommandPaletteConfig): CommandItem[] {
  const actions: CommandItem[] = [];

  if (config.createClient) {
    actions.push({
      id: 'action-create-client',
      label: 'Create new client',
      shortcut: '⌘N',
      icon: ICONS.USER_PLUS,
      section: 'actions',
      keywords: ['add', 'new', 'client', 'customer'],
      action: () => config.createClient!()
    });
  }

  if (config.createProject) {
    actions.push({
      id: 'action-create-project',
      label: 'Create new project',
      shortcut: '⌘⇧P',
      icon: ICONS.PLUS,
      section: 'actions',
      keywords: ['add', 'new', 'project', 'job'],
      action: () => config.createProject!()
    });
  }

  if (config.createInvoice) {
    actions.push({
      id: 'action-create-invoice',
      label: 'Create new invoice',
      shortcut: '⌘⇧I',
      icon: ICONS.RECEIPT,
      section: 'actions',
      keywords: ['add', 'new', 'invoice', 'bill'],
      action: () => config.createInvoice!()
    });
  }

  actions.push({
    id: 'action-logout',
    label: 'Log out',
    icon: ICONS.LOG_OUT,
    section: 'actions',
    keywords: ['signout', 'exit', 'leave'],
    action: () => config.logout()
  });

  return actions;
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

/**
 * Keyboard shortcuts configuration for help panel
 */
const KEYBOARD_SHORTCUTS = [
  { keys: '⌘K', description: 'Open command palette' },
  { keys: '1-8', description: 'Navigate sidebar sections' },
  { keys: '⌘N', description: 'Create new client' },
  { keys: '⌘⇧P', description: 'Create new project' },
  { keys: '⌘⇧I', description: 'Create new invoice' },
  { keys: '?', description: 'Show this help' },
  { keys: 'Esc', description: 'Close dialogs' }
] as const;

/**
 * Show keyboard shortcuts help panel
 */
function showKeyboardShortcutsPanel(): void {
  // Check if panel already exists
  if (document.getElementById('keyboard-shortcuts-panel')) {
    hideKeyboardShortcutsPanel();
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'keyboard-shortcuts-panel';
  panel.className = 'keyboard-shortcuts-panel';
  panel.innerHTML = `
    <div class="shortcuts-backdrop"></div>
    <div class="shortcuts-content">
      <div class="shortcuts-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="shortcuts-close" aria-label="Close">&times;</button>
      </div>
      <div class="shortcuts-list">
        ${KEYBOARD_SHORTCUTS.map((s) => `<div class="shortcut-item"><kbd>${s.keys}</kbd><span>${s.description}</span></div>`).join('')}
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.id = 'keyboard-shortcuts-styles';
  style.textContent = `
    .keyboard-shortcuts-panel {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: var(--z-index-portal-modal, 9600);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .shortcuts-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
    }
    .shortcuts-content {
      position: relative;
      background: var(--portal-bg-primary, #1a1a1a);
      border: 1px solid var(--portal-border, #333);
      border-radius: 8px;
      padding: 24px;
      min-width: 320px;
      max-width: 400px;
    }
    .shortcuts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .shortcuts-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--portal-text-primary, #fff);
    }
    .shortcuts-close {
      background: none;
      border: none;
      color: var(--portal-text-muted, #888);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .shortcuts-close:hover {
      color: var(--portal-text-primary, #fff);
    }
    .shortcuts-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .shortcut-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .shortcut-item kbd {
      background: var(--portal-bg-secondary, #2a2a2a);
      border: 1px solid var(--portal-border, #333);
      border-radius: 4px;
      padding: 4px 8px;
      font-family: monospace;
      font-size: 12px;
      color: var(--portal-text-primary, #fff);
      min-width: 60px;
      text-align: center;
    }
    .shortcut-item span {
      color: var(--portal-text-secondary, #aaa);
      font-size: 14px;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(panel);

  // Add event listeners
  const closeBtn = panel.querySelector('.shortcuts-close');
  const backdrop = panel.querySelector('.shortcuts-backdrop');

  closeBtn?.addEventListener('click', hideKeyboardShortcutsPanel);
  backdrop?.addEventListener('click', hideKeyboardShortcutsPanel);

  // Close on Escape
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideKeyboardShortcutsPanel();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Hide keyboard shortcuts help panel
 */
function hideKeyboardShortcutsPanel(): void {
  const panel = document.getElementById('keyboard-shortcuts-panel');
  const style = document.getElementById('keyboard-shortcuts-styles');
  panel?.remove();
  style?.remove();
}

/**
 * Sidebar shortcut mapping (1-8 keys)
 * Matches the data-shortcut attributes in admin/index.html
 */
const SIDEBAR_SHORTCUTS: Record<string, string> = {
  '1': 'dashboard',
  '2': 'work',
  '3': 'crm',
  '4': 'documents',
  '5': 'workflows',
  '6': 'analytics',
  '7': 'support',
  '8': 'system'
};

/** Reference to the keyboard handler for cleanup */
let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

/**
 * Handle global keyboard shortcuts for sidebar navigation
 */
function createKeyboardHandler(config: AdminCommandPaletteConfig): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    // Don't handle if command palette is open
    if (isPaletteOpen()) return;

    // Don't handle if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Don't handle if any modifier keys are pressed (except for ?)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Handle number keys 1-8 for sidebar navigation
    const tab = SIDEBAR_SHORTCUTS[e.key];
    if (tab) {
      e.preventDefault();
      config.switchTab(tab);
      return;
    }

    // Handle ? for help - show keyboard shortcuts panel
    if (e.key === '?' && e.shiftKey) {
      e.preventDefault();
      showKeyboardShortcutsPanel();
    }
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize the admin command palette and keyboard shortcuts
 */
export function initAdminCommandPalette(config: AdminCommandPaletteConfig): void {
  const items: CommandItem[] = [...buildNavigationItems(config), ...buildActionItems(config)];

  initCommandPalette({
    items,
    placeholder: 'Search or jump to...'
  });

  // Set up global keyboard shortcuts for number keys
  keyboardHandler = createKeyboardHandler(config);
  document.addEventListener('keydown', keyboardHandler);
}

/**
 * Destroy the admin command palette and keyboard shortcuts
 */
export function destroyAdminCommandPalette(): void {
  destroyCommandPalette();
  destroyAllTableKeyboardNav();

  // Remove keyboard shortcut handler
  if (keyboardHandler) {
    document.removeEventListener('keydown', keyboardHandler);
    keyboardHandler = null;
  }
}

/**
 * Add a recently viewed item to the command palette
 */
export function addRecentAdminItem(item: Omit<CommandItem, 'section'>): void {
  addRecentItem(item);
}

/**
 * Initialize keyboard navigation for an admin table
 */
export function initAdminTableNav(
  config: Omit<TableKeyboardNavConfig, 'focusClass' | 'selectedClass'>
): ReturnType<typeof initTableKeyboardNav> {
  return initTableKeyboardNav({
    ...config,
    focusClass: 'row-focused',
    selectedClass: 'row-selected'
  });
}
