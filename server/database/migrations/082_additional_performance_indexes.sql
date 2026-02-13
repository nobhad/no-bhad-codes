-- Migration 082: Additional Performance Indexes
-- Created: 2026-02-11
-- Description: Adds missing indexes for scheduled_invoices and invoice_reminders
--              to improve query performance for invoice scheduling and reminder systems

-- Index for scheduled_invoices queries filtering by status and date
CREATE INDEX IF NOT EXISTS idx_scheduled_invoices_status_trigger_date 
ON scheduled_invoices(status, trigger_type, scheduled_date);

-- Index for invoice_reminders foreign key lookups
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice_id 
ON invoice_reminders(invoice_id);
