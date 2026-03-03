/**
 * ===============================================
 * ICON FACTORY
 * ===============================================
 * @file src/factories/icons/icon-factory.ts
 *
 * Core icon rendering functions.
 * Creates consistent SVG icons with proper sizing and accessibility.
 */

import { ICON_SIZES, SVG_ATTRS } from '../constants';
import type { IconConfig, IconSizeKey } from '../types';
import { getIconDefinition } from './icon-registry';
import { createLogger } from '../../utils/logger';

const logger = createLogger('IconFactory');

// ============================================
// ICON RENDERING
// ============================================

/**
 * Resolve size to pixels.
 * Accepts a size key (e.g., 'lg') or explicit pixel value.
 */
export function resolveIconSize(size: IconSizeKey | number | undefined): number {
  if (typeof size === 'number') {
    return size;
  }
  return ICON_SIZES[size ?? 'lg'];
}

/**
 * Render an SVG icon as an HTML string.
 * Uses the icon registry and applies consistent styling.
 */
export function renderIcon(config: IconConfig): string {
  const { name, size, className = '', ariaLabel, ariaHidden = true } = config;

  const definition = getIconDefinition(name);
  if (!definition) {
    logger.warn(`Unknown icon: ${name}`);
    return '';
  }

  const resolvedSize = resolveIconSize(size);
  const ariaAttrs = ariaLabel
    ? `aria-label="${ariaLabel}"`
    : ariaHidden
      ? 'aria-hidden="true"'
      : '';

  return `<svg xmlns="${SVG_ATTRS.xmlns}" width="${resolvedSize}" height="${resolvedSize}" viewBox="0 0 24 24" fill="${SVG_ATTRS.fill}" stroke="${SVG_ATTRS.stroke}" stroke-width="${SVG_ATTRS.strokeWidth}" stroke-linecap="${SVG_ATTRS.strokeLinecap}" stroke-linejoin="${SVG_ATTRS.strokeLinejoin}" class="${className}" ${ariaAttrs}>${definition.path}</svg>`;
}

/**
 * Get the raw SVG string for an icon with optional size override.
 * Simpler API for quick icon rendering.
 */
export function getIconSvg(name: string, size?: IconSizeKey | number): string {
  return renderIcon({ name, size });
}

/**
 * Create an SVG element for an icon (for DOM manipulation).
 */
export function createIconElement(config: IconConfig): SVGSVGElement | null {
  const svgString = renderIcon(config);
  if (!svgString) return null;

  const template = document.createElement('template');
  template.innerHTML = svgString.trim();
  return template.content.firstChild as SVGSVGElement;
}

/**
 * Get icon SVG with explicit dimensions (for backwards compatibility).
 * @deprecated Use renderIcon() or getIconSvg() instead.
 */
export function getIconWithSize(
  name: string,
  dimensions: { width: number; height: number }
): string {
  return renderIcon({ name, size: dimensions.width });
}

// ============================================
// LUCIDE ICON MAPPINGS (for React)
// ============================================

/**
 * Map of icon names to their Lucide-react component names.
 * Used by React factory to dynamically import icons.
 */
export const LUCIDE_ICON_MAP: Record<string, string> = {
  eye: 'Eye',
  'eye-off': 'EyeOff',
  edit: 'Pencil',
  trash: 'Trash2',
  plus: 'Plus',
  x: 'X',
  copy: 'Copy',
  download: 'Download',
  upload: 'Upload',
  refresh: 'RefreshCw',
  'rotate-ccw': 'RotateCcw',
  archive: 'Archive',
  send: 'Send',
  search: 'Search',
  filter: 'Filter',
  check: 'Check',
  'circle-check': 'CheckCircle',
  'circle-x': 'XCircle',
  'check-square': 'CheckSquare',
  clock: 'Clock',
  bell: 'Bell',
  'help-circle': 'HelpCircle',
  file: 'File',
  'file-text': 'FileText',
  'file-signature': 'FileSignature',
  folder: 'Folder',
  image: 'Image',
  paperclip: 'Paperclip',
  clipboard: 'Clipboard',
  mail: 'Mail',
  'message-square': 'MessageSquare',
  inbox: 'Inbox',
  camera: 'Camera',
  palette: 'Palette',
  'more-vertical': 'MoreVertical',
  'more-horizontal': 'MoreHorizontal',
  'layout-dashboard': 'LayoutDashboard',
  settings: 'Settings',
  list: 'List',
  'list-todo': 'ListTodo',
  globe: 'Globe',
  cookie: 'Cookie',
  users: 'Users',
  user: 'User',
  'user-plus': 'UserPlus',
  briefcase: 'Briefcase',
  receipt: 'Receipt',
  'bar-chart': 'BarChart',
  rocket: 'Rocket',
  workflow: 'GitBranch',
  package: 'Package',
  'book-open': 'BookOpen',
  zap: 'Zap',
  'log-out': 'LogOut',
  'arrow-left': 'ArrowLeft',
  'chevron-left': 'ChevronLeft',
  'chevron-right': 'ChevronRight',
  'chevron-down': 'ChevronDown',
  'chevron-up': 'ChevronUp',
  'chevrons-left': 'ChevronsLeft',
  'chevrons-right': 'ChevronsRight',
  'external-link': 'ExternalLink',
  'sort-neutral': 'ChevronsUpDown',
  'sort-asc': 'ChevronUp',
  'sort-desc': 'ChevronDown'
};

/**
 * Get the Lucide component name for an icon.
 */
export function getLucideComponentName(iconName: string): string | undefined {
  return LUCIDE_ICON_MAP[iconName];
}

// ============================================
// ICON ALIASES (exported for convenience)
// ============================================

export {
  ICON_REGISTRY,
  getIconDefinition,
  getAllIconNames,
  getIconsByCategory
} from './icon-registry';
