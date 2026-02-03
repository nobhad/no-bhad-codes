/**
 * ===============================================
 * RECENT ACTIVITY (REUSABLE)
 * ===============================================
 * @file src/components/recent-activity.ts
 *
 * Renders the .recent-activity block (h3 + ul). Use in admin and client
 * portal so markup is shared (shared CSS: portal-cards.css).
 */

export interface RecentActivityItem {
  text: string;
  date?: string;
}

/**
 * Create the .recent-activity DOM. Mount into a tab or content area.
 * @param items List of activity items
 * @param title Section title (default "Recent Activity")
 * @param listId Optional ID for the list (e.g. for live updates)
 */
export function createRecentActivity(
  items: RecentActivityItem[],
  title: string = 'Recent Activity',
  listId?: string
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'recent-activity portal-shadow';

  const h3 = document.createElement('h3');
  h3.textContent = title;
  wrap.appendChild(h3);

  const ul = document.createElement('ul');
  ul.className = 'activity-list';
  if (listId) ul.id = listId;
  ul.setAttribute('aria-live', 'polite');
  ul.setAttribute('aria-atomic', 'false');

  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item.date ? `${item.text} — ${item.date}` : item.text;
    ul.appendChild(li);
  });

  wrap.appendChild(ul);
  return wrap;
}
