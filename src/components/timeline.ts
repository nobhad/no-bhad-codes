/**
 * ===============================================
 * TIMELINE COMPONENT
 * ===============================================
 * @file src/components/timeline.ts
 *
 * Reusable activity timeline component.
 * Used for: Client activities, Project activities
 */

export interface TimelineEvent {
  id: number | string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  user?: string;
}

export interface TimelineConfig {
  containerId: string;
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
  emptyMessage?: string;
  showLoadMore?: boolean;
  onLoadMore?: () => Promise<void>;
}

// Event type icons mapping
const EVENT_ICONS: Record<string, string> = {
  contact_added: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>',
  contact_removed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" x2="16" y1="11" y2="11"/></svg>',
  tag_added: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>',
  tag_removed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><line x1="6" y1="6" x2="8" y2="8"/></svg>',
  note_added: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  email_sent: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  call_made: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>',
  meeting_scheduled: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
  project_created: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  invoice_created: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
  payment_received: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  status_changed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  default: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
};

/**
 * Get icon for event type
 */
function getEventIcon(type: string): string {
  return EVENT_ICONS[type] || EVENT_ICONS.default;
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create a timeline component
 */
export function createTimeline(config: TimelineConfig): {
  refresh: (events: TimelineEvent[]) => void;
  appendEvents: (events: TimelineEvent[]) => void;
  destroy: () => void;
} {
  const container = document.getElementById(config.containerId);
  if (!container) {
    console.error('[Timeline] Container not found:', config.containerId);
    return {
      refresh: () => {},
      appendEvents: () => {},
      destroy: () => {}
    };
  }

  let currentEvents = config.events;
  let isLoading = false;

  /**
   * Render an event
   */
  function renderEvent(event: TimelineEvent): string {
    return `
      <div class="timeline-event" data-event-id="${event.id}">
        <div class="timeline-event-icon">
          ${event.icon || getEventIcon(event.type)}
        </div>
        <div class="timeline-event-content">
          <div class="timeline-event-header">
            <span class="timeline-event-title">${escapeHtml(event.title)}</span>
            <span class="timeline-event-time">${formatRelativeTime(event.timestamp)}</span>
          </div>
          ${event.description ? `<div class="timeline-event-description">${escapeHtml(event.description)}</div>` : ''}
          ${event.user ? `<div class="timeline-event-user">by ${escapeHtml(event.user)}</div>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render the timeline
   */
  function render(): void {
    if (!container) return;
    container.className = 'timeline-container';

    if (currentEvents.length === 0) {
      container.innerHTML = `
        <div class="timeline-empty">
          ${config.emptyMessage || 'No activity yet'}
        </div>
      `;
      return;
    }

    let html = '<div class="timeline-events">';
    html += currentEvents.map(renderEvent).join('');
    html += '</div>';

    if (config.showLoadMore && config.onLoadMore) {
      html += `
        <div class="timeline-load-more">
          <button class="btn btn-secondary btn-sm" id="timeline-load-more-btn">
            Load More
          </button>
        </div>
      `;
    }

    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('.timeline-event').forEach(el => {
      if (config.onEventClick) {
        el.addEventListener('click', () => {
          const eventId = (el as HTMLElement).dataset.eventId;
          const event = currentEvents.find(e => String(e.id) === eventId);
          if (event) config.onEventClick!(event);
        });
        (el as HTMLElement).style.cursor = 'pointer';
      }
    });

    // Load more handler
    if (config.showLoadMore && config.onLoadMore) {
      const loadMoreBtn = container.querySelector('#timeline-load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
          if (isLoading) return;
          isLoading = true;
          loadMoreBtn.textContent = 'Loading...';
          (loadMoreBtn as HTMLButtonElement).disabled = true;

          try {
            await config.onLoadMore!();
          } finally {
            isLoading = false;
            loadMoreBtn.textContent = 'Load More';
            (loadMoreBtn as HTMLButtonElement).disabled = false;
          }
        });
      }
    }
  }

  /**
   * Refresh with new events
   */
  function refresh(events: TimelineEvent[]): void {
    currentEvents = events;
    render();
  }

  /**
   * Append events to existing list
   */
  function appendEvents(events: TimelineEvent[]): void {
    currentEvents = [...currentEvents, ...events];
    render();
  }

  /**
   * Destroy the component
   */
  function destroy(): void {
    if (!container) return;
    container.innerHTML = '';
    container.className = '';
  }

  // Initial render
  render();

  return { refresh, appendEvents, destroy };
}

/**
 * Get CSS for timeline
 */
export function getTimelineStyles(): string {
  return `
    .timeline-container {
      padding: var(--portal-spacing-md) 0;
    }

    .timeline-events {
      position: relative;
      padding-left: 28px;
    }

    .timeline-events::before {
      content: '';
      position: absolute;
      left: 7px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--portal-border);
    }

    .timeline-event {
      position: relative;
      padding-bottom: var(--portal-spacing-md);
      display: flex;
      gap: var(--portal-spacing-sm);
    }

    .timeline-event:last-child {
      padding-bottom: 0;
    }

    .timeline-event-icon {
      position: absolute;
      left: -28px;
      width: 16px;
      height: 16px;
      background: var(--portal-bg-medium);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--portal-text-secondary);
      z-index: 1;
    }

    .timeline-event-content {
      flex: 1;
      background: var(--portal-bg-dark);
      border-radius: var(--portal-radius-sm);
      padding: var(--portal-spacing-sm) var(--portal-spacing-md);
      border: 1px solid var(--portal-border);
    }

    .timeline-event-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--portal-spacing-sm);
      margin-bottom: 4px;
    }

    .timeline-event-title {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--portal-text-primary);
    }

    .timeline-event-time {
      font-size: 0.75rem;
      color: var(--portal-text-secondary);
      white-space: nowrap;
    }

    .timeline-event-description {
      font-size: 0.813rem;
      color: var(--portal-text-secondary);
      margin-top: 4px;
    }

    .timeline-event-user {
      font-size: 0.75rem;
      color: var(--portal-text-muted);
      margin-top: 4px;
    }

    .timeline-empty {
      text-align: center;
      padding: var(--portal-spacing-xl);
      color: var(--portal-text-secondary);
      font-size: 0.875rem;
    }

    .timeline-load-more {
      text-align: center;
      margin-top: var(--portal-spacing-md);
    }

    @media (max-width: 768px) {
      .timeline-events {
        padding-left: 24px;
      }

      .timeline-event-icon {
        left: -24px;
      }
    }
  `;
}
