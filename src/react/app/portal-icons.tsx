/**
 * ===============================================
 * PORTAL ICONS
 * ===============================================
 * @file src/react/app/portal-icons.tsx
 *
 * Lucide React icon map for sidebar navigation.
 * Maps icon key strings from unified-navigation.ts
 * to actual Lucide React components.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Gauge,
  Folder,
  LineChart,
  Users,
  FileText,
  BarChart3,
  BookOpen,
  Settings,
  Briefcase,
  Receipt,
  CheckCircle,
  MessageCircle,
  ClipboardList,
  MessageSquare,
  Eye,
  HelpCircle,
  PanelLeft,
  LogOut,
  Package
} from 'lucide-react';

/**
 * Maps icon key strings (from unified-navigation ICON_KEYS)
 * to Lucide React icon components.
 */
export const SIDEBAR_ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  folder: Folder,
  lineChart: LineChart,
  users: Users,
  fileText: FileText,
  barChart: BarChart3,
  bookOpen: BookOpen,
  settings: Settings,
  briefcase: Briefcase,
  receipt: Receipt,
  checkCircle: CheckCircle,
  messageCircle: MessageCircle,
  clipboardList: ClipboardList,
  messageSquare: MessageSquare,
  eye: Eye,
  helpCircle: HelpCircle,
  settingsClient: Settings,
  panelLeft: PanelLeft,
  logOut: LogOut,
  logOutClient: LogOut,
  package: Package
};
