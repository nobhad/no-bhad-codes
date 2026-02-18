/**
 * Keyboard Shortcut Help Panel
 * Press ? to show all available keyboard shortcuts
 */

interface ShortcutItem {
  action: string;
  keys: string[];
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUTS: ShortcutSection[] = [
  {
    title: 'Global',
    shortcuts: [
      { action: 'Open command palette', keys: ['⌘', 'K'] },
      { action: 'Show keyboard shortcuts', keys: ['?'] },
      { action: 'Close modal/panel', keys: ['Esc'] }
    ]
  },
  {
    title: 'Navigation',
    shortcuts: [
      { action: 'Dashboard', keys: ['1'] },
      { action: 'Work', keys: ['2'] },
      { action: 'CRM', keys: ['3'] },
      { action: 'Documents', keys: ['4'] },
      { action: 'Workflows', keys: ['5'] },
      { action: 'Analytics', keys: ['6'] },
      { action: 'Knowledge', keys: ['7'] },
      { action: 'System', keys: ['8'] }
    ]
  },
  {
    title: 'Tables',
    shortcuts: [
      { action: 'Move down', keys: ['J', '↓'] },
      { action: 'Move up', keys: ['K', '↑'] },
      { action: 'Open item', keys: ['Enter'] },
      { action: 'Toggle select', keys: ['X', 'Space'] },
      { action: 'Select all', keys: ['⌘', 'A'] }
    ]
  },
  {
    title: 'Actions',
    shortcuts: [
      { action: 'Save', keys: ['⌘', 'S'] },
      { action: 'Edit', keys: ['E'] },
      { action: 'Delete', keys: ['⌫'] }
    ]
  }
];

let panelElement: HTMLElement | null = null;
let isOpen = false;

function createPanel(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'keyboard-help-overlay';
  overlay.id = 'keyboard-help-overlay';

  const panel = document.createElement('div');
  panel.className = 'keyboard-help-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'keyboard-help-title');

  // Header
  const header = document.createElement('div');
  header.className = 'keyboard-help-header';

  const title = document.createElement('h2');
  title.className = 'keyboard-help-title';
  title.id = 'keyboard-help-title';
  title.textContent = 'Keyboard Shortcuts';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'keyboard-help-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '×';
  closeBtn.addEventListener('click', close);

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Sections
  SHORTCUTS.forEach(section => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'keyboard-help-section';

    const sectionTitle = document.createElement('h3');
    sectionTitle.className = 'keyboard-help-section-title';
    sectionTitle.textContent = section.title;
    sectionEl.appendChild(sectionTitle);

    const list = document.createElement('ul');
    list.className = 'keyboard-help-list';

    section.shortcuts.forEach(shortcut => {
      const item = document.createElement('li');
      item.className = 'keyboard-help-item';

      const action = document.createElement('span');
      action.className = 'keyboard-help-action';
      action.textContent = shortcut.action;

      const keys = document.createElement('span');
      keys.className = 'keyboard-help-keys';

      shortcut.keys.forEach((key, index) => {
        const keyEl = document.createElement('kbd');
        keyEl.className = 'keyboard-help-key';
        keyEl.textContent = key;
        keys.appendChild(keyEl);

        if (index < shortcut.keys.length - 1 && shortcut.keys.length === 2 && !['↓', '↑'].includes(shortcut.keys[1])) {
          const sep = document.createElement('span');
          sep.className = 'keyboard-help-separator';
          sep.textContent = '+';
          keys.appendChild(sep);
        }
      });

      item.appendChild(action);
      item.appendChild(keys);
      list.appendChild(item);
    });

    sectionEl.appendChild(list);
    panel.appendChild(sectionEl);
  });

  overlay.appendChild(panel);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
    }
  });

  return overlay;
}

export function open(): void {
  if (isOpen) return;

  if (!panelElement) {
    panelElement = createPanel();
    document.body.appendChild(panelElement);
  }

  panelElement.classList.add('open');
  isOpen = true;

  // Focus the close button
  const closeBtn = panelElement.querySelector('.keyboard-help-close') as HTMLButtonElement;
  closeBtn?.focus();
}

export function close(): void {
  if (!isOpen || !panelElement) return;

  panelElement.classList.remove('open');
  isOpen = false;
}

export function toggle(): void {
  if (isOpen) {
    close();
  } else {
    open();
  }
}

export function isShowing(): boolean {
  return isOpen;
}

// Initialize keyboard listener
export function initKeyboardHelp(): void {
  document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // ? key (Shift + /)
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      toggle();
      return;
    }

    // Escape to close
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
    }
  });
}

export default {
  open,
  close,
  toggle,
  isShowing,
  initKeyboardHelp
};
