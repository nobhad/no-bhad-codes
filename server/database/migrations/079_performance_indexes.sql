-- Migration: Add performance indexes for common queries

-- Index for invoice reminders by status and scheduled date
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_status_date
  ON invoice_reminders(status, scheduled_date);

-- Index for active recurring invoices by next generation date
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_active_next
  ON recurring_invoices(is_active, next_generation_date);
