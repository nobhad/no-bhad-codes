/**
 * ===============================================
 * SVG ICON CONSTANTS
 * ===============================================
 * @file src/constants/icons.ts
 *
 * Centralized SVG icons to eliminate duplication
 * across the codebase. All icons use Lucide icon style.
 */

/**
 * Standard SVG attributes for consistency
 */
const ICON_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const;

/**
 * Password visibility toggle icons
 */
export const ICONS = {
  // Eye icon (show password)
  EYE: `<svg xmlns="${ICON_ATTRS.xmlns}" width="20" height="20" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,

  // Eye-off icon (hide password)
  EYE_OFF: `<svg xmlns="${ICON_ATTRS.xmlns}" width="20" height="20" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,

  // Close/X icon
  CLOSE: `<svg xmlns="${ICON_ATTRS.xmlns}" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,

  // Dropdown caret (chevron down)
  CARET_DOWN: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" class="custom-dropdown-caret" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,

  // Trash icon (delete)
  TRASH: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,

  // Image icon (file type)
  IMAGE: `<svg xmlns="${ICON_ATTRS.xmlns}" width="24" height="24" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,

  // Document icon (file type)
  DOCUMENT: `<svg xmlns="${ICON_ATTRS.xmlns}" width="24" height="24" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,

  // File icon (generic)
  FILE: `<svg xmlns="${ICON_ATTRS.xmlns}" width="24" height="24" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,

  // Upload icon
  UPLOAD: `<svg xmlns="${ICON_ATTRS.xmlns}" width="48" height="48" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,

  // Filter icon
  FILTER: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`,

  // Search icon
  SEARCH: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,

  // Sort icons
  SORT_NEUTRAL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="14" height="14" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" class="sort-neutral" aria-hidden="true"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`,

  SORT_ASC: `<svg xmlns="${ICON_ATTRS.xmlns}" width="14" height="14" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" class="sort-asc" aria-hidden="true"><path d="m7 9 5-5 5 5"/></svg>`,

  SORT_DESC: `<svg xmlns="${ICON_ATTRS.xmlns}" width="14" height="14" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" class="sort-desc" aria-hidden="true"><path d="m7 15 5 5 5-5"/></svg>`,

  // Check icon
  CHECK: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`,

  // Plus icon
  PLUS: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,

  // Cookie icon (consent)
  COOKIE: `<svg xmlns="${ICON_ATTRS.xmlns}" width="24" height="24" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" class="lucide lucide-cookie" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>`,

  // X/Close icon (small, for clearing inputs)
  X_SMALL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="14" height="14" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,

  // Search icon (small, for inline use)
  SEARCH_SMALL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="14" height="14" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`
} as const;

/**
 * Helper to get an icon with custom size
 */
export function getIcon(
  iconKey: keyof typeof ICONS,
  size?: { width: number; height: number }
): string {
  let icon: string = ICONS[iconKey];
  if (size) {
    icon = icon
      .replace(/width="\d+"/, `width="${size.width}"`)
      .replace(/height="\d+"/, `height="${size.height}"`);
  }
  return icon;
}

/**
 * Accessible icon wrapper with screen reader text
 */
export function getAccessibleIcon(
  iconKey: keyof typeof ICONS,
  srText: string,
  size?: { width: number; height: number }
): string {
  const icon = getIcon(iconKey, size);
  return `<span class="sr-only">${srText}</span>${icon}`;
}

export default ICONS;
