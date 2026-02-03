/**
 * ===============================================
 * BREADCRUMBS (REUSABLE)
 * ===============================================
 * @file src/components/breadcrumbs.ts
 *
 * Renders breadcrumb navigation. Use in admin and client portal
 * so breadcrumbs look and behave the same everywhere.
 */

export interface BreadcrumbItem {
  label: string;
  href: boolean;
  onClick?: () => void;
}

/**
 * Render breadcrumbs into a container (e.g. #breadcrumb-list).
 * Container should be a <ul> or element that will hold list items.
 */
export function renderBreadcrumbs(
  container: HTMLElement,
  items: BreadcrumbItem[]
): void {
  container.innerHTML = '';

  items.forEach((crumb, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'breadcrumb-item';

    if (crumb.href && crumb.onClick) {
      const link = document.createElement('button');
      link.className = 'breadcrumb-link';
      link.type = 'button';
      link.textContent = crumb.label;
      link.onclick = crumb.onClick;
      listItem.appendChild(link);
    } else {
      const span = document.createElement('span');
      span.className = 'breadcrumb-current';
      span.textContent = crumb.label;
      listItem.appendChild(span);
    }

    container.appendChild(listItem);

    if (index < items.length - 1) {
      const separator = document.createElement('li');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '>';
      container.appendChild(separator);
    }
  });
}
