# Expense Tracking and Profitability

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

Track business expenses (per-project or general), calculate project profitability (revenue vs costs), and analyze expense breakdowns by category and time period.

## Architecture

### Database Tables (Migration 125)

- `expenses` — Expense records (project_id nullable, category, amount, vendor, date, billable, recurring, receipt, tax)

### API Endpoints (Admin)

- `GET /api/expenses` — List (filter by project, category, date range)
- `POST /api/expenses` — Create
- `GET /api/expenses/:id` — Single
- `PUT /api/expenses/:id` — Update
- `DELETE /api/expenses/:id` — Soft delete
- `GET /api/expenses/profitability/:projectId` — Project profitability
- `GET /api/expenses/profitability` — All projects profitability
- `GET /api/expenses/analytics` — Category + monthly breakdown
- `GET /api/expenses/analytics/export` — CSV download

### Profitability Calculation

Revenue = paid invoices + paid installments
Costs = project expenses + billable time (hours x hourly rate)
Profit = revenue - costs
Margin = (profit / revenue) x 100 (or 0 if no revenue)

### 12 Expense Categories

software, hosting, domain, stock_assets, subcontractor, hardware, travel, marketing, office, professional_services, subscription, other

## Key Files

- `server/services/expense-service.ts` — CRUD, profitability, analytics, CSV export
- `server/routes/expenses/admin.ts` — 9 admin endpoints
- `src/react/features/admin/expenses/ExpensesTable.tsx` — Admin table with create form and filters
- `server/database/migrations/125_expenses_and_profitability.sql` — Schema

## Change Log

### 2026-03-17 — Initial Implementation

- Full expense tracking with 12 categories, soft delete, recurring flag
- Project profitability calculation (revenue vs costs including time tracking)
- Expense analytics (by category, by month)
- CSV export
- Admin table with inline create form
