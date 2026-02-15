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

  // Pencil/Edit icon
  PENCIL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,

  // Cookie icon (consent)
  COOKIE: `<svg xmlns="${ICON_ATTRS.xmlns}" width="24" height="24" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" class="lucide lucide-cookie" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>`,

  // X/Close icon (small, for clearing inputs)
  X_SMALL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="14" height="14" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,

  // Search icon (small, for inline use)
  SEARCH_SMALL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="14" height="14" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`,

  // Chevron icons (navigation)
  CHEVRON_LEFT: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`,

  CHEVRON_RIGHT: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`,

  CHEVRONS_LEFT: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>`,

  CHEVRONS_RIGHT: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/></svg>`,

  // Archive icon
  ARCHIVE: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>`,

  // Download/Export icon
  DOWNLOAD: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,

  // Mail icon (reply via email)
  MAIL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,

  // User plus icon (convert to client)
  USER_PLUS: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>`,

  // Rotate ccw icon (restore)
  ROTATE_CCW: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,

  // Rocket icon (activate as project / launch)
  ROCKET: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,

  // Copy to clipboard (Lucide copy)
  COPY: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,

  // Bell icon (notifications/reminders)
  BELL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,

  // Edit icon (alias for PENCIL)
  EDIT: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,

  // Send icon
  SEND: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`,

  // Palette icon (brand colors)
  PALETTE: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>`,

  // File text icon (content)
  FILE_TEXT: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,

  // Camera icon (photos)
  CAMERA: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,

  // Clipboard icon
  CLIPBOARD: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,

  // Arrow left icon
  ARROW_LEFT: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,

  // Image/Logo icon
  LOGO: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,

  // Globe icon
  GLOBE: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,

  // External link icon
  EXTERNAL_LINK: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,

  // Refresh icon
  REFRESH: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,

  // Folder icon
  FOLDER: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,

  // Paperclip icon (attachments)
  PAPERCLIP: `<svg xmlns="${ICON_ATTRS.xmlns}" width="18" height="18" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`,

  // Chevron down icon
  CHEVRON_DOWN: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,

  // Chevron up icon
  CHEVRON_UP: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>`,

  // X icon (close)
  X: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,

  // More vertical (three dots)
  MORE_VERTICAL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`,

  // More horizontal (three dots)
  MORE_HORIZONTAL: `<svg xmlns="${ICON_ATTRS.xmlns}" width="16" height="16" viewBox="0 0 24 24" fill="${ICON_ATTRS.fill}" stroke="${ICON_ATTRS.stroke}" stroke-width="${ICON_ATTRS.strokeWidth}" stroke-linecap="${ICON_ATTRS.strokeLinecap}" stroke-linejoin="${ICON_ATTRS.strokeLinejoin}" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>`
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
