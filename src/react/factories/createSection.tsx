/**
 * ===============================================
 * SECTION FACTORY
 * ===============================================
 * @file src/react/factories/createSection.tsx
 *
 * Reusable container/wrapper components for consistent
 * layout patterns across admin and client portals.
 *
 * Established patterns:
 * - Section: Main bordered container (.portal-section)
 * - Panel: Card-style content block (.overview-panel)
 * - ContentStack: Vertical flex container
 * - ContentRow: Horizontal flex container
 * - Grid: Responsive grid layouts
 *
 * @see src/styles/shared/portal-cards.css
 * @see src/styles/shared/portal-layout.css
 * @see src/styles/admin/overview-layout.css
 */

import * as React from 'react';
import { cn } from '@react/lib/utils';
import type { LucideIcon } from 'lucide-react';

// ============================================
// SECTION COMPONENT
// ============================================

export interface SectionProps {
  /** Section content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Section title */
  title?: string;
  /** Title icon */
  icon?: LucideIcon;
  /** Header actions (buttons, etc.) */
  actions?: React.ReactNode;
  /** Whether to show border */
  bordered?: boolean;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Section ID for accessibility */
  id?: string;
  /** Ref forwarding */
  ref?: React.Ref<HTMLElement>;
}

/**
 * Section - Main container with optional border, title, and actions.
 *
 * Uses .portal-section CSS class for consistent styling across portals.
 *
 * @example
 * <Section title="User Information" icon={User} bordered>
 *   <form>...</form>
 * </Section>
 *
 * @example
 * <Section title="Recent Activity" actions={<Button>View All</Button>}>
 *   <ActivityFeed items={activities} />
 * </Section>
 */
export const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    {
      children,
      className,
      title,
      icon: Icon,
      actions,
      bordered = true,
      padding = 'md',
      id
    },
    ref
  ) => {
    const paddingClass = {
      none: '',
      sm: 'section-padding-sm',
      md: 'section-padding-md',
      lg: 'section-padding-lg'
    }[padding];

    return (
      <section
        ref={ref}
        id={id}
        className={cn(
          bordered && 'portal-section',
          paddingClass,
          className
        )}
      >
        {(title || actions) && (
          <div className="data-table-header">
            {title && (
              <h3>
                {Icon && <Icon className="icon-sm" />}
                <span className="title-full">{title}</span>
              </h3>
            )}
            {actions && <div className="data-table-actions">{actions}</div>}
          </div>
        )}
        <div className="section-content">{children}</div>
      </section>
    );
  }
);

Section.displayName = 'Section';

// ============================================
// PANEL COMPONENT
// ============================================

export interface PanelProps {
  /** Panel content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Panel title */
  title?: string;
  /** Title icon */
  icon?: LucideIcon;
  /** Header actions */
  actions?: React.ReactNode;
  /** Compact body (no padding, scrollable) */
  compact?: boolean;
  /** Panel variant */
  variant?: 'default' | 'stat' | 'activity';
}

/**
 * Panel - Card-style content block.
 *
 * Uses .overview-panel CSS class for admin-style cards.
 *
 * @example
 * <Panel title="Revenue" icon={DollarSign}>
 *   <span className="stat-value">$12,450</span>
 * </Panel>
 *
 * @example
 * <Panel title="Recent Messages" compact>
 *   <MessageList messages={messages} />
 * </Panel>
 */
export function Panel({
  children,
  className,
  title,
  icon: Icon,
  actions,
  compact = false,
  variant = 'default'
}: PanelProps) {
  const variantClass = {
    default: 'overview-panel',
    stat: 'overview-panel overview-stat-card',
    activity: 'overview-panel activity-panel'
  }[variant];

  return (
    <div className={cn(variantClass, className)}>
      {(title || actions) && (
        <div className="overview-panel-header">
          <div className="overview-panel-title">
            {Icon && <Icon />}
            <span>{title}</span>
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      <div
        className={cn(
          'overview-panel-body',
          compact && 'overview-panel-body--compact'
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// CONTENT STACK (VERTICAL FLEX)
// ============================================

export interface ContentStackProps {
  /** Stack content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Gap size */
  gap?: 'none' | 'sm' | 'md' | 'lg';
  /** As element type */
  as?: 'div' | 'section' | 'article';
}

/**
 * ContentStack - Vertical flex container with gap.
 *
 * Uses .portal-content-stack for consistent vertical layouts.
 *
 * @example
 * <ContentStack gap="md">
 *   <Section>...</Section>
 *   <Section>...</Section>
 * </ContentStack>
 */
export function ContentStack({
  children,
  className,
  gap = 'md',
  as: Component = 'div'
}: ContentStackProps) {
  const gapClass = {
    none: 'gap-0',
    sm: 'gap-sm',
    md: 'gap-md',
    lg: 'gap-lg'
  }[gap];

  return (
    <Component className={cn('portal-content-stack', gapClass, className)}>
      {children}
    </Component>
  );
}

// ============================================
// CONTENT ROW (HORIZONTAL FLEX)
// ============================================

export interface ContentRowProps {
  /** Row content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Gap size */
  gap?: 'none' | 'sm' | 'md' | 'lg';
  /** Alignment */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Justify */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  /** Wrap content */
  wrap?: boolean;
}

/**
 * ContentRow - Horizontal flex container.
 *
 * @example
 * <ContentRow gap="sm" align="center" justify="between">
 *   <h2>Title</h2>
 *   <Button>Action</Button>
 * </ContentRow>
 */
export function ContentRow({
  children,
  className,
  gap = 'md',
  align = 'center',
  justify = 'start',
  wrap = false
}: ContentRowProps) {
  const gapClass = {
    none: 'gap-0',
    sm: 'gap-sm',
    md: 'gap-md',
    lg: 'gap-lg'
  }[gap];

  const alignClass = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  }[align];

  const justifyClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around'
  }[justify];

  return (
    <div
      className={cn(
        'portal-content-row',
        gapClass,
        alignClass,
        justifyClass,
        wrap && 'flex-wrap',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// GRID COMPONENT
// ============================================

export interface GridProps {
  /** Grid content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Number of columns */
  cols?: 1 | 2 | 3 | 4;
  /** Gap size */
  gap?: 'none' | 'sm' | 'md' | 'lg';
  /** Responsive column behavior */
  responsive?: boolean;
}

/**
 * Grid - Responsive grid layout.
 *
 * Uses .portal-grid-* classes for consistent grid layouts.
 *
 * @example
 * <Grid cols={3} gap="md" responsive>
 *   <StatCard label="Users" value={1234} />
 *   <StatCard label="Revenue" value="$45K" />
 *   <StatCard label="Orders" value={89} />
 * </Grid>
 */
export function Grid({
  children,
  className,
  cols = 2,
  gap = 'md',
  responsive = true
}: GridProps) {
  const colClass = {
    1: 'portal-grid-1',
    2: 'portal-grid-2',
    3: 'portal-grid-3',
    4: 'portal-grid-4'
  }[cols];

  const gapClass = {
    none: 'gap-0',
    sm: 'gap-sm',
    md: 'gap-md',
    lg: 'gap-lg'
  }[gap];

  return (
    <div
      className={cn(
        colClass,
        gapClass,
        responsive && 'grid-responsive',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// TWO COLUMN LAYOUT
// ============================================

export interface TwoColumnProps {
  /** Main column content */
  main: React.ReactNode;
  /** Aside column content */
  aside: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Aside position */
  asidePosition?: 'left' | 'right';
  /** Aside width */
  asideWidth?: 'narrow' | 'medium' | 'wide';
}

/**
 * TwoColumn - Two-column layout with main content and aside.
 *
 * Uses .overview-grid pattern for admin-style layouts.
 *
 * @example
 * <TwoColumn
 *   main={<ProjectDetails project={project} />}
 *   aside={<ProjectSidebar project={project} />}
 *   asideWidth="medium"
 * />
 */
export function TwoColumn({
  main,
  aside,
  className,
  asidePosition = 'right',
  asideWidth = 'medium'
}: TwoColumnProps) {
  const widthClass = {
    narrow: 'aside-narrow',
    medium: 'aside-medium',
    wide: 'aside-wide'
  }[asideWidth];

  return (
    <div
      className={cn(
        'overview-grid',
        widthClass,
        asidePosition === 'left' && 'aside-left',
        className
      )}
    >
      {asidePosition === 'left' && (
        <div className="overview-col-aside">{aside}</div>
      )}
      <div className="overview-col-main">{main}</div>
      {asidePosition === 'right' && (
        <div className="overview-col-aside">{aside}</div>
      )}
    </div>
  );
}

// ============================================
// PAGE HEADER
// ============================================

export interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Title icon */
  icon?: LucideIcon;
  /** Header actions */
  actions?: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Breadcrumbs */
  breadcrumbs?: React.ReactNode;
}

/**
 * PageHeader - Consistent page header with title, subtitle, and actions.
 *
 * @example
 * <PageHeader
 *   title="Projects"
 *   subtitle="Manage your active projects"
 *   icon={FolderKanban}
 *   actions={<Button>New Project</Button>}
 * />
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  className,
  breadcrumbs
}: PageHeaderProps) {
  return (
    <header className={cn('page-header', className)}>
      {breadcrumbs && <nav className="page-breadcrumbs">{breadcrumbs}</nav>}
      <div className="page-header-content">
        <div className="page-title-group">
          {Icon && <Icon className="page-title-icon" />}
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </header>
  );
}

// ============================================
// DETAIL VIEW LAYOUT
// ============================================

export interface DetailViewProps {
  /** Detail view content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Layout variant */
  variant?: 'default' | 'compact' | 'wide';
  /** Ref forwarding */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * DetailView - Container for detail pages (project detail, client detail).
 *
 * Uses consistent padding and spacing for detail views.
 *
 * @example
 * <DetailView ref={containerRef}>
 *   <PageHeader title={project.name} />
 *   <Tabs tabs={TABS} initialTab="overview">
 *     {tabContent}
 *   </Tabs>
 * </DetailView>
 */
export const DetailView = React.forwardRef<HTMLDivElement, DetailViewProps>(
  ({ children, className, variant = 'default' }, ref) => {
    const variantClass = {
      default: 'detail-view',
      compact: 'detail-view detail-view--compact',
      wide: 'detail-view detail-view--wide'
    }[variant];

    return (
      <div ref={ref} className={cn(variantClass, className)}>
        {children}
      </div>
    );
  }
);

DetailView.displayName = 'DetailView';

// ============================================
// EXPORTS
// ============================================

export const SectionComponents = {
  Section,
  Panel,
  ContentStack,
  ContentRow,
  Grid,
  TwoColumn,
  PageHeader,
  DetailView
};

export default SectionComponents;
