/**
 * ===============================================
 * API TYPE DEFINITIONS — BARREL
 * ===============================================
 * Re-exports all API types from domain-specific modules.
 *
 * Domains:
 *   shared.ts     — Generic response wrappers, pagination, errors
 *   auth.ts       — Authentication request/response types
 *   contact.ts    — Contact form types
 *   intake.ts     — Client intake types
 *   leads.ts      — Lead CRUD + lead management (scoring, pipeline, tasks)
 *   projects.ts   — Project CRUD + project management (tasks, time, templates)
 *   clients.ts    — Client CRUD + CRM (contacts, activities, fields, health)
 *   messages.ts   — Messaging core + enhanced (reactions, mentions, search)
 *   invoices.ts   — Invoice CRUD + payment plans, scheduled, recurring, reminders
 *   files.ts      — File upload + file management (folders, versions, comments)
 *   admin.ts      — Admin dashboard types
 *   analytics.ts  — Analytics, reports, dashboards, KPIs, alerts
 */

export * from './shared.js';
export * from './auth.js';
export * from './contact.js';
export * from './intake.js';
export * from './leads.js';
export * from './projects.js';
export * from './clients.js';
export * from './messages.js';
export * from './invoices.js';
export * from './files.js';
export * from './admin.js';
export * from './analytics.js';
