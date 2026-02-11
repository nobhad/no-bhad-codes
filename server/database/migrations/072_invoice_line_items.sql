-- =====================================================
-- Migration 072: Invoice Line Items Table
-- =====================================================
-- Phase 3.2 of Database Normalization
--
-- Purpose: Extract JSON line_items column from invoices table into a
-- proper relational table. This enables:
--   - Efficient querying/filtering by line item properties
--   - Proper foreign key relationships
--   - Individual line item updates without JSON parsing
--   - Better reporting and analytics on line items
--
-- Date: 2026-02-10

-- UP

-- =====================================================
-- SECTION 1: Create invoice_line_items table
-- =====================================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  -- Tax support (per-line)
  tax_rate DECIMAL(5,2),
  tax_amount DECIMAL(10,2),
  -- Discount support (per-line)
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Foreign key
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- =====================================================
-- SECTION 2: Performance indexes
-- =====================================================

-- Primary lookup: line items by invoice
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- Sort order for consistent display
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_order ON invoice_line_items(invoice_id, sort_order);

-- DOWN

DROP INDEX IF EXISTS idx_invoice_line_items_order;
DROP INDEX IF EXISTS idx_invoice_line_items_invoice;
DROP TABLE IF EXISTS invoice_line_items;
