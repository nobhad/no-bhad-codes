/**
 * ===============================================
 * LINE ITEMS DATA MIGRATION SCRIPT
 * ===============================================
 * @file server/scripts/migrate-line-items.ts
 *
 * Migrates JSON line_items from invoices table to the new
 * invoice_line_items table.
 *
 * Run with: npx ts-node server/scripts/migrate-line-items.ts
 *
 * Phase 3.2 of Database Normalization (Migration 073)
 * Date: 2026-02-10
 */

import sqlite3 from 'sqlite3';

interface JsonLineItem {
  description: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  taxRate?: number;
  taxAmount?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
}

interface InvoiceRow {
  id: number;
  line_items: string | null;
}

interface MigrationStats {
  invoicesProcessed: number;
  lineItemsCreated: number;
  invoicesSkipped: number;
  errors: string[];
}

const DB_PATH = './data/client_portal.db';

async function migrateLineItems(): Promise<void> {
  console.log('\n========================================');
  console.log('  Invoice Line Items Migration');
  console.log('  Phase 3.2 - Database Normalization');
  console.log('========================================\n');

  const db = new sqlite3.Database(DB_PATH);

  // Promise wrappers for database methods
  const dbAll = (sql: string, params?: unknown[]): Promise<unknown[]> =>
    new Promise((resolve, reject) => {
      db.all(sql, params || [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

  const dbRun = (sql: string, params?: unknown[]): Promise<void> =>
    new Promise((resolve, reject) => {
      db.run(sql, params || [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  const dbGet = (sql: string, params?: unknown[]): Promise<unknown> =>
    new Promise((resolve, reject) => {
      db.get(sql, params || [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

  const stats: MigrationStats = {
    invoicesProcessed: 0,
    lineItemsCreated: 0,
    invoicesSkipped: 0,
    errors: []
  };

  try {
    // Check if invoice_line_items table exists
    const tableCheck = await dbGet(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_line_items'"
    ) as { name: string } | undefined;

    if (!tableCheck) {
      console.error('Error: invoice_line_items table does not exist.');
      console.error('Please run migration 072_invoice_line_items.sql first.\n');
      process.exit(1);
    }

    // Check if migration has already been run
    const existingCount = await dbGet(
      'SELECT COUNT(*) as count FROM invoice_line_items'
    ) as { count: number };

    if (existingCount.count > 0) {
      console.log(`Found ${existingCount.count} existing line items.`);
      console.log('Continuing migration for any unmigrated invoices...\n');
    }

    // Get all invoices with JSON line_items
    const invoices = await dbAll(
      'SELECT id, line_items FROM invoices WHERE line_items IS NOT NULL'
    ) as InvoiceRow[];

    console.log(`Found ${invoices.length} invoices with line_items to process.\n`);

    for (const invoice of invoices) {
      try {
        // Check if this invoice already has migrated line items
        const migrated = await dbGet(
          'SELECT COUNT(*) as count FROM invoice_line_items WHERE invoice_id = ?',
          [invoice.id]
        ) as { count: number };

        if (migrated.count > 0) {
          stats.invoicesSkipped++;
          continue;
        }

        // Parse JSON line items
        let lineItems: JsonLineItem[] = [];

        if (invoice.line_items) {
          try {
            lineItems = JSON.parse(invoice.line_items);
          } catch (parseErr) {
            stats.errors.push(`Invoice ${invoice.id}: Failed to parse JSON - ${parseErr}`);
            continue;
          }
        }

        if (!Array.isArray(lineItems) || lineItems.length === 0) {
          stats.invoicesSkipped++;
          continue;
        }

        // Insert line items into new table
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          const quantity = item.quantity ?? 1;
          const unitPrice = item.rate ?? 0;
          const amount = item.amount ?? (quantity * unitPrice);

          await dbRun(
            `INSERT INTO invoice_line_items (
              invoice_id, description, quantity, unit_price, amount,
              tax_rate, tax_amount, discount_type, discount_value, discount_amount,
              sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              invoice.id,
              item.description || 'Service',
              quantity,
              unitPrice,
              amount,
              item.taxRate ?? null,
              item.taxAmount ?? null,
              item.discountType ?? null,
              item.discountValue ?? null,
              item.discountAmount ?? null,
              i
            ]
          );

          stats.lineItemsCreated++;
        }

        stats.invoicesProcessed++;

        // Progress indicator
        if (stats.invoicesProcessed % 10 === 0) {
          process.stdout.write(`  Processed ${stats.invoicesProcessed} invoices...\r`);
        }
      } catch (err) {
        stats.errors.push(`Invoice ${invoice.id}: ${err}`);
      }
    }

    console.log('\n');

    // Verification
    console.log('----------------------------------------');
    console.log('  Verification');
    console.log('----------------------------------------\n');

    const jsonTotal = await dbGet(`
      SELECT SUM(
        CASE
          WHEN line_items IS NOT NULL AND line_items != '[]' AND line_items != ''
          THEN json_array_length(line_items)
          ELSE 0
        END
      ) as count
      FROM invoices
    `) as { count: number };

    const tableTotal = await dbGet(
      'SELECT COUNT(*) as count FROM invoice_line_items'
    ) as { count: number };

    console.log(`  JSON line items total: ${jsonTotal.count ?? 0}`);
    console.log(`  Table line items total: ${tableTotal.count}`);

    if ((jsonTotal.count ?? 0) === tableTotal.count) {
      console.log('  Status: VERIFIED - Counts match\n');
    } else {
      console.log('  Status: WARNING - Counts differ (may have empty arrays)\n');
    }

    // Summary
    console.log('----------------------------------------');
    console.log('  Migration Summary');
    console.log('----------------------------------------\n');
    console.log(`  Invoices processed: ${stats.invoicesProcessed}`);
    console.log(`  Line items created: ${stats.lineItemsCreated}`);
    console.log(`  Invoices skipped: ${stats.invoicesSkipped}`);
    console.log(`  Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n  Error details:');
      stats.errors.forEach((err) => console.log(`    - ${err}`));
    }

    console.log('\n========================================');
    console.log('  Migration Complete');
    console.log('========================================\n');
    console.log('  NOTE: The JSON line_items column has been');
    console.log('  preserved for 30-day rollback capability.');
    console.log('  It will be removed in migration 075.\n');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run migration
migrateLineItems().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
