/**
 * ===============================================
 * ICON REGISTRY
 * ===============================================
 * @file src/factories/icons/icon-registry.ts
 *
 * Centralized registry of all SVG icon paths.
 * Icons use Lucide-style SVG with 24x24 viewBox.
 */

import type { IconDefinition, IconCategory } from '../types';

/**
 * Icon registry containing all available icons.
 * Each icon stores only the path data; the factory handles sizing and attributes.
 */
export const ICON_REGISTRY: Record<string, IconDefinition> = {
  // ============================================
  // NAVIGATION
  // ============================================
  eye: {
    path: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>',
    category: 'navigation',
    aliases: ['view', 'preview', 'show']
  },
  'eye-off': {
    path: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>',
    category: 'navigation',
    aliases: ['hide']
  },
  'arrow-left': {
    path: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    category: 'navigation',
    aliases: ['back']
  },
  'chevron-left': {
    path: '<path d="m15 18-6-6 6-6"/>',
    category: 'navigation'
  },
  'chevron-right': {
    path: '<path d="m9 18 6-6-6-6"/>',
    category: 'navigation'
  },
  'chevron-down': {
    path: '<path d="m6 9 6 6 6-6"/>',
    category: 'navigation'
  },
  'chevron-up': {
    path: '<path d="m18 15-6-6-6 6"/>',
    category: 'navigation'
  },
  'chevrons-left': {
    path: '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
    category: 'navigation'
  },
  'chevrons-right': {
    path: '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
    category: 'navigation'
  },
  'external-link': {
    path: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    category: 'navigation'
  },

  // ============================================
  // ACTIONS
  // ============================================
  edit: {
    path: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    category: 'action',
    aliases: ['pencil', 'modify']
  },
  trash: {
    path: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>',
    category: 'action',
    aliases: ['delete', 'remove']
  },
  plus: {
    path: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    category: 'action',
    aliases: ['add', 'create']
  },
  x: {
    path: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    category: 'action',
    aliases: ['close', 'cancel', 'remove']
  },
  copy: {
    path: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    category: 'action',
    aliases: ['clipboard-copy', 'duplicate']
  },
  download: {
    path: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    category: 'action',
    aliases: ['export']
  },
  upload: {
    path: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    category: 'action',
    aliases: ['import']
  },
  refresh: {
    path: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    category: 'action',
    aliases: ['reload', 'sync']
  },
  'rotate-ccw': {
    path: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    category: 'action',
    aliases: ['restore', 'undo']
  },
  archive: {
    path: '<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
    category: 'action'
  },
  send: {
    path: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    category: 'action'
  },
  search: {
    path: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    category: 'action'
  },
  filter: {
    path: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>',
    category: 'action'
  },

  // ============================================
  // STATUS
  // ============================================
  check: {
    path: '<polyline points="20 6 9 17 4 12"></polyline>',
    category: 'status',
    aliases: ['done', 'complete', 'success']
  },
  'circle-check': {
    path: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>',
    category: 'status',
    aliases: ['approve', 'verified']
  },
  'circle-x': {
    path: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    category: 'status',
    aliases: ['reject', 'declined']
  },
  'check-square': {
    path: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    category: 'status'
  },
  clock: {
    path: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    category: 'status',
    aliases: ['time', 'schedule', 'expire']
  },
  bell: {
    path: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    category: 'status',
    aliases: ['notification', 'remind', 'alert']
  },
  'help-circle': {
    path: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    category: 'status',
    aliases: ['question', 'info']
  },

  // ============================================
  // SORT
  // ============================================
  'sort-neutral': {
    path: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    category: 'interface'
  },
  'sort-asc': {
    path: '<path d="m7 9 5-5 5 5"/>',
    category: 'interface'
  },
  'sort-desc': {
    path: '<path d="m7 15 5 5 5-5"/>',
    category: 'interface'
  },

  // ============================================
  // FILES & DOCUMENTS
  // ============================================
  file: {
    path: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    category: 'file',
    aliases: ['document']
  },
  'file-text': {
    path: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
    category: 'file',
    aliases: ['document-text']
  },
  'file-signature': {
    path: '<path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L18 5.5"/><path d="M8 18h1"/><path d="M18.4 9.6a1.65 1.65 0 1 1 2.33 2.33l-7.25 7.24a2 2 0 0 1-.84.51l-2.28.61a.5.5 0 0 1-.61-.61l.61-2.28a2 2 0 0 1 .51-.84Z"/>',
    category: 'file',
    aliases: ['contract']
  },
  folder: {
    path: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    category: 'file'
  },
  image: {
    path: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    category: 'file',
    aliases: ['photo', 'picture']
  },
  paperclip: {
    path: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    category: 'file',
    aliases: ['attachment']
  },
  clipboard: {
    path: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    category: 'file'
  },

  // ============================================
  // COMMUNICATION
  // ============================================
  mail: {
    path: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    category: 'communication',
    aliases: ['email', 'envelope']
  },
  'message-square': {
    path: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    category: 'communication',
    aliases: ['chat', 'comment']
  },
  inbox: {
    path: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    category: 'communication'
  },
  phone: {
    path: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    category: 'communication',
    aliases: ['call', 'telephone']
  },

  // ============================================
  // MEDIA
  // ============================================
  camera: {
    path: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    category: 'media'
  },
  palette: {
    path: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>',
    category: 'media',
    aliases: ['colors', 'brand']
  },

  // ============================================
  // INTERFACE / LAYOUT
  // ============================================
  'more-vertical': {
    path: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
    category: 'interface',
    aliases: ['kebab', 'options']
  },
  'more-horizontal': {
    path: '<circle cx="12" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    category: 'interface',
    aliases: ['dots', 'options-horizontal']
  },
  'layout-dashboard': {
    path: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    category: 'interface',
    aliases: ['dashboard', 'grid']
  },
  settings: {
    path: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    category: 'interface',
    aliases: ['gear', 'cog']
  },
  list: {
    path: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    category: 'interface'
  },
  'list-todo': {
    path: '<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><line x1="13" y1="6" x2="21" y2="6"/><line x1="13" y1="12" x2="21" y2="12"/><line x1="13" y1="18" x2="21" y2="18"/>',
    category: 'interface',
    aliases: ['tasks', 'checklist']
  },
  globe: {
    path: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    category: 'interface',
    aliases: ['world', 'web']
  },
  cookie: {
    path: '<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/>',
    category: 'interface'
  },

  // ============================================
  // DATA & BUSINESS
  // ============================================
  users: {
    path: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    category: 'data',
    aliases: ['people', 'team']
  },
  user: {
    path: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    category: 'data',
    aliases: ['person', 'profile']
  },
  'user-plus': {
    path: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
    category: 'data',
    aliases: ['add-user', 'invite']
  },
  briefcase: {
    path: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    category: 'data',
    aliases: ['work', 'project']
  },
  receipt: {
    path: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    category: 'data',
    aliases: ['invoice', 'bill']
  },
  'bar-chart': {
    path: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    category: 'data',
    aliases: ['analytics', 'stats']
  },
  rocket: {
    path: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    category: 'data',
    aliases: ['launch', 'activate']
  },
  workflow: {
    path: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 9v6"/><path d="M18 9a9 9 0 0 0-9 0"/>',
    category: 'data',
    aliases: ['git-branch', 'process']
  },
  package: {
    path: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    category: 'data',
    aliases: ['deliverable', 'box']
  },
  'book-open': {
    path: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    category: 'data',
    aliases: ['knowledge', 'docs']
  },
  zap: {
    path: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    category: 'data',
    aliases: ['lightning', 'fast', 'power']
  },
  'log-out': {
    path: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    category: 'action',
    aliases: ['logout', 'signout']
  },

  // ============================================
  // ADDITIONAL UTILITY ICONS
  // ============================================
  loader: {
    path: '<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>',
    category: 'interface',
    aliases: ['spinner', 'loading']
  },
  calendar: {
    path: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
    category: 'data',
    aliases: ['date', 'schedule']
  },
  'dollar-sign': {
    path: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    category: 'data',
    aliases: ['money', 'currency', 'price']
  },
  link: {
    path: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    category: 'interface',
    aliases: ['url', 'hyperlink']
  },
  'link-2': {
    path: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
    category: 'interface',
    aliases: ['unlink']
  },
  play: {
    path: '<polygon points="6 3 20 12 6 21 6 3"/>',
    category: 'interface',
    aliases: ['start', 'begin']
  },
  pause: {
    path: '<rect height="16" width="4" x="6" y="4"/><rect height="16" width="4" x="14" y="4"/>',
    category: 'interface',
    aliases: ['stop']
  },
  pin: {
    path: '<line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>',
    category: 'interface',
    aliases: ['pinned', 'sticky']
  },
  tag: {
    path: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    category: 'data',
    aliases: ['label', 'category']
  },
  star: {
    path: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    category: 'interface',
    aliases: ['favorite', 'rating']
  },
  'star-off': {
    path: '<path d="M8.34 8.34 2 9.27l5 4.87L5.82 21 12 17.77 18.18 21l-.59-3.43"/><path d="M18.42 12.76 22 9.27l-6.91-1L12 2l-1.44 2.91"/><line x1="2" x2="22" y1="2" y2="22"/>',
    category: 'interface',
    aliases: ['unfavorite']
  },
  alert: {
    path: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>',
    category: 'status',
    aliases: ['warning', 'error']
  },
  info: {
    path: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    category: 'status',
    aliases: ['information']
  },
  hash: {
    path: '<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>',
    category: 'interface',
    aliases: ['number', 'pound']
  },
  percent: {
    path: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    category: 'data',
    aliases: ['percentage', 'discount']
  },
  lock: {
    path: '<rect height="11" width="18" rx="2" ry="2" x="3" y="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    category: 'interface',
    aliases: ['locked', 'secure']
  },
  unlock: {
    path: '<rect height="11" width="18" rx="2" ry="2" x="3" y="11"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    category: 'interface',
    aliases: ['unlocked']
  }
} as const;

/**
 * Get an icon definition by name, checking aliases.
 */
export function getIconDefinition(name: string): IconDefinition | undefined {
  // Direct lookup
  if (ICON_REGISTRY[name]) {
    return ICON_REGISTRY[name];
  }

  // Search aliases
  for (const [_key, def] of Object.entries(ICON_REGISTRY)) {
    if (def.aliases?.includes(name)) {
      return def;
    }
  }

  return undefined;
}

/**
 * Get all icons by category.
 */
export function getIconsByCategory(category: IconCategory): Record<string, IconDefinition> {
  return Object.fromEntries(
    Object.entries(ICON_REGISTRY).filter(([_, def]) => def.category === category)
  );
}

/**
 * Get all icon names.
 */
export function getAllIconNames(): string[] {
  return Object.keys(ICON_REGISTRY);
}

/**
 * Get all aliases for quick lookup.
 */
export function getAllAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [name, def] of Object.entries(ICON_REGISTRY)) {
    if (def.aliases) {
      for (const alias of def.aliases) {
        aliases[alias] = name;
      }
    }
  }
  return aliases;
}
