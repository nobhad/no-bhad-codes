/**
 * ===============================================
 * ICON BUTTON (REACT FACTORY)
 * ===============================================
 * @file src/react/factories/IconButton.tsx
 *
 * React component for rendering consistent icon buttons.
 * Uses the factory system for icon/button definitions.
 */

import * as React from 'react';
import { cn } from '@react/lib/utils';
import { createLogger } from '../../utils/logger';

const logger = createLogger('IconButton');
import {
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
  X,
  Copy,
  Download,
  Upload,
  RefreshCw,
  RotateCcw,
  Archive,
  Send,
  Search,
  Filter,
  Check,
  CheckCircle,
  XCircle,
  CheckSquare,
  Clock,
  Bell,
  HelpCircle,
  File,
  FileText,
  FileSignature,
  Folder,
  Image,
  Paperclip,
  Clipboard,
  Mail,
  MessageSquare,
  Inbox,
  Camera,
  Palette,
  MoreVertical,
  MoreHorizontal,
  LayoutDashboard,
  Settings,
  List,
  ListTodo,
  Globe,
  Cookie,
  Users,
  User,
  UserPlus,
  Briefcase,
  Receipt,
  BarChart,
  Rocket,
  GitBranch,
  Package,
  BookOpen,
  Zap,
  LogOut,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  ChevronsUpDown,
  Phone,
  Loader2,
  Calendar,
  DollarSign,
  Link,
  Link2,
  Play,
  Pause,
  Pin,
  Tag,
  Star,
  StarOff,
  AlertTriangle,
  Info,
  Hash,
  Percent,
  Lock,
  Unlock,
  Share2,
  UserX,
  type LucideIcon
} from 'lucide-react';
// Icon/button sizes controlled by CSS variables - no JS constants needed
import { BUTTON_ACTIONS } from '../../factories/buttons/button-actions';
import type { UIContext, ButtonVariant, IconSizeKey } from '../../factories/types';

// ============================================
// ICON MAP
// ============================================

/**
 * Map icon names to Lucide components.
 */
const ICON_COMPONENTS: Record<string, LucideIcon> = {
  eye: Eye,
  'eye-off': EyeOff,
  edit: Pencil,
  pencil: Pencil,
  trash: Trash2,
  'trash-2': Trash2,
  delete: Trash2,
  plus: Plus,
  add: Plus,
  x: X,
  close: X,
  cancel: X,
  copy: Copy,
  download: Download,
  export: Download,
  upload: Upload,
  import: Upload,
  refresh: RefreshCw,
  'rotate-ccw': RotateCcw,
  restore: RotateCcw,
  archive: Archive,
  send: Send,
  search: Search,
  filter: Filter,
  check: Check,
  'circle-check': CheckCircle,
  approve: CheckCircle,
  'circle-x': XCircle,
  reject: XCircle,
  'check-square': CheckSquare,
  clock: Clock,
  time: Clock,
  bell: Bell,
  remind: Bell,
  'help-circle': HelpCircle,
  help: HelpCircle,
  file: File,
  'file-text': FileText,
  'file-signature': FileSignature,
  contract: FileSignature,
  folder: Folder,
  image: Image,
  paperclip: Paperclip,
  attach: Paperclip,
  clipboard: Clipboard,
  mail: Mail,
  email: Mail,
  phone: Phone,
  call: Phone,
  'message-square': MessageSquare,
  message: MessageSquare,
  inbox: Inbox,
  camera: Camera,
  palette: Palette,
  'more-vertical': MoreVertical,
  more: MoreVertical,
  'more-horizontal': MoreHorizontal,
  'layout-dashboard': LayoutDashboard,
  dashboard: LayoutDashboard,
  settings: Settings,
  list: List,
  'list-todo': ListTodo,
  tasks: ListTodo,
  globe: Globe,
  cookie: Cookie,
  users: Users,
  user: User,
  'user-plus': UserPlus,
  briefcase: Briefcase,
  receipt: Receipt,
  invoice: Receipt,
  'bar-chart': BarChart,
  analytics: BarChart,
  rocket: Rocket,
  launch: Rocket,
  activate: Rocket,
  workflow: GitBranch,
  'git-branch': GitBranch,
  package: Package,
  'book-open': BookOpen,
  knowledge: BookOpen,
  zap: Zap,
  'log-out': LogOut,
  logout: LogOut,
  'arrow-left': ArrowLeft,
  back: ArrowLeft,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  expand: ChevronDown,
  'chevron-up': ChevronUp,
  collapse: ChevronUp,
  'chevrons-left': ChevronsLeft,
  'chevrons-right': ChevronsRight,
  'external-link': ExternalLink,
  'sort-neutral': ChevronsUpDown,
  // Additional utility icons
  loader: Loader2,
  spinner: Loader2,
  loading: Loader2,
  calendar: Calendar,
  date: Calendar,
  schedule: Calendar,
  'dollar-sign': DollarSign,
  money: DollarSign,
  currency: DollarSign,
  link: Link,
  url: Link,
  'link-2': Link2,
  play: Play,
  start: Play,
  pause: Pause,
  stop: Pause,
  pin: Pin,
  pinned: Pin,
  tag: Tag,
  label: Tag,
  star: Star,
  favorite: Star,
  'star-off': StarOff,
  unfavorite: StarOff,
  alert: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  information: Info,
  hash: Hash,
  number: Hash,
  percent: Percent,
  percentage: Percent,
  lock: Lock,
  locked: Lock,
  secure: Lock,
  unlock: Unlock,
  unlocked: Unlock,
  share: Share2,
  'share-2': Share2,
  unshare: UserX,
  'user-x': UserX,
  revoke: UserX
};

/**
 * Get a Lucide icon component by name.
 */
export function getLucideIcon(name: string): LucideIcon | undefined {
  return ICON_COMPONENTS[name];
}

// ============================================
// ICON BUTTON COMPONENT
// ============================================

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  /** Action type from BUTTON_ACTIONS or icon name */
  action?: string;
  /** Direct icon name (alternative to action) */
  icon?: string;
  /** UI context for sizing */
  context?: UIContext;
  /** Button title (tooltip) */
  title?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Data ID for the row */
  dataId?: string | number;
  /** Button variant */
  variant?: ButtonVariant;
  /** Custom icon size override */
  iconSize?: IconSizeKey | number;
  /** Loading state */
  loading?: boolean;
}

/**
 * IconButton - Consistent icon button using factory system.
 *
 * @example
 * <IconButton action="view" onClick={() => handleView(id)} />
 * <IconButton action="edit" context="modal" dataId={row.id} />
 * <IconButton icon="refresh" loading={isLoading} />
 */
export function IconButton({
  action,
  icon,
  title,
  ariaLabel,
  dataId,
  variant,
  loading = false,
  disabled,
  className,
  ...props
}: IconButtonProps) {
  // Get action definition if action is provided
  const actionDef = action ? BUTTON_ACTIONS[action] : undefined;

  // Determine icon name
  const iconName = icon ?? actionDef?.icon;
  if (!iconName) {
    logger.warn('No icon specified. Provide \'action\' or \'icon\' prop.');
    return null;
  }

  // Get the Lucide icon component
  const IconComponent = getLucideIcon(iconName);
  if (!IconComponent) {
    logger.warn(`Unknown icon: ${iconName}`);
    return null;
  }

  // Icon size is controlled by CSS variables (--portal-btn-icon-inner-size)
  // No hardcoded sizes passed to icons

  // Resolve button properties
  const buttonTitle = title ?? actionDef?.title;
  const buttonAriaLabel = ariaLabel ?? actionDef?.ariaLabel ?? buttonTitle;
  const buttonVariant = variant ?? actionDef?.variant;

  // Build class names
  const classNames = cn(
    'icon-btn',
    buttonVariant && buttonVariant !== 'default' && `icon-btn-${buttonVariant}`,
    loading && 'loading',
    className
  );

  // Auto-add data-shortcut for global keyboard shortcut targeting
  const shortcutAttr = action === 'refresh' ? 'refresh' : undefined;

  return (
    <button
      type="button"
      className={classNames}
      title={buttonTitle}
      aria-label={buttonAriaLabel}
      disabled={disabled || loading}
      data-action={action}
      data-id={dataId}
      data-shortcut={shortcutAttr}
      {...props}
    >
      {/* Don't pass size for table context - let CSS control icon size */}
      <IconComponent
        aria-hidden="true"
        className={loading ? 'spinning' : undefined}
      />
    </button>
  );
}

// ============================================
// ACTION BUTTON COMPONENT
// ============================================

interface ActionButtonProps extends Omit<IconButtonProps, 'action'> {
  /** Action type from BUTTON_ACTIONS (required) */
  action: string;
}

/**
 * ActionButton - Shorthand for IconButton with required action.
 *
 * @example
 * <ActionButton action="view" onClick={() => handleView(id)} dataId={row.id} />
 */
export function ActionButton({ action, ...props }: ActionButtonProps) {
  return <IconButton action={action} {...props} />;
}

// ============================================
// TABLE ACTION BUTTON COMPONENT
// ============================================

interface TableActionButtonProps {
  /** Lucide icon element - will be cloned with size prop */
  icon: React.ReactElement;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
  /** Button title (tooltip) */
  title: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional className */
  className?: string;
  /** Data attributes for JS targeting */
  dataAction?: string;
  /** Data ID for the row */
  dataId?: string | number;
}

/**
 * TableActionButton - Legacy-compatible component for table row actions.
 * Icon sizing is controlled by CSS variables (--portal-btn-icon-inner-size).
 *
 * @deprecated Use IconButton with action prop instead
 */
export function TableActionButton({
  icon,
  onClick,
  title,
  ariaLabel,
  disabled = false,
  className,
  dataAction,
  dataId
}: TableActionButtonProps) {
  // Clone the icon element with aria-hidden only - CSS controls sizing
  const accessibleIcon = React.cloneElement(icon, {
    'aria-hidden': true
  } as React.Attributes & { 'aria-hidden': boolean });

  return (
    <button
      type="button"
      className={cn('icon-btn', className)}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      disabled={disabled}
      data-action={dataAction}
      data-id={dataId}
    >
      {accessibleIcon}
    </button>
  );
}

// ============================================
// TABLE ACTIONS WRAPPER
// ============================================

interface TableActionsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * TableActions - Wrapper for table action buttons.
 * Provides consistent flex layout with proper gap.
 */
export function TableActions({ children, className }: TableActionsProps) {
  return (
    <div className={cn('action-group', className)}>
      {children}
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export { ICON_COMPONENTS };
