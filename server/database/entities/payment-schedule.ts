/**
 * ===============================================
 * PAYMENT SCHEDULE ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/payment-schedule.ts
 *
 * Entity schemas and mappers for payment schedule installments.
 */

import { defineSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';
import type { PaymentInstallmentStatus, PaymentMethod } from '../../config/constants.js';

// =====================================================
// TYPES
// =====================================================

export interface PaymentInstallment {
  id: number;
  projectId: number;
  clientId: number;
  contractId: number | null;
  installmentNumber: number;
  label: string | null;
  amount: number;
  dueDate: string;
  status: PaymentInstallmentStatus;
  paidDate: string | null;
  paidAmount: number | null;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  invoiceId: number | null;
  notes: string | null;
  reminderSentAt: string | null;
  reminderCount: number;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  projectName?: string;
  clientName?: string;
}

// =====================================================
// ROW TYPE
// =====================================================

export interface PaymentInstallmentRow extends DatabaseRow {
  id: number;
  project_id: number;
  client_id: number;
  contract_id: number | null;
  installment_number: number;
  label: string | null;
  amount: number | string;
  due_date: string;
  status: string;
  paid_date: string | null;
  paid_amount: number | string | null;
  payment_method: string | null;
  payment_reference: string | null;
  invoice_id: number | null;
  notes: string | null;
  reminder_sent_at: string | null;
  reminder_count: number;
  created_at: string;
  updated_at: string;
  // Joined
  project_name?: string;
  client_name?: string;
}

// =====================================================
// COLUMN CONSTANT
// =====================================================

export const INSTALLMENT_COLUMNS = `
  psi.id, psi.project_id, psi.client_id, psi.contract_id,
  psi.installment_number, psi.label, psi.amount, psi.due_date,
  psi.status, psi.paid_date, psi.paid_amount, psi.payment_method,
  psi.payment_reference, psi.invoice_id, psi.notes,
  psi.reminder_sent_at, psi.reminder_count,
  psi.created_at, psi.updated_at
`.replace(/\s+/g, ' ').trim();

export const INSTALLMENT_COLUMNS_WITH_JOINS = `
  ${INSTALLMENT_COLUMNS},
  p.project_name, c.contact_name AS client_name
`.replace(/\s+/g, ' ').trim();

// =====================================================
// SCHEMA & MAPPER
// =====================================================

export const paymentInstallmentSchema = defineSchema<PaymentInstallment>({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  clientId: { column: 'client_id', type: 'number' },
  contractId: { column: 'contract_id', type: 'number?' },
  installmentNumber: { column: 'installment_number', type: 'number' },
  label: 'string?',
  amount: 'float',
  dueDate: { column: 'due_date', type: 'string' },
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as PaymentInstallmentStatus
  },
  paidDate: { column: 'paid_date', type: 'string?' },
  paidAmount: { column: 'paid_amount', type: 'float?' },
  paymentMethod: { column: 'payment_method', type: 'string?' },
  paymentReference: { column: 'payment_reference', type: 'string?' },
  invoiceId: { column: 'invoice_id', type: 'number?' },
  notes: 'string?',
  reminderSentAt: { column: 'reminder_sent_at', type: 'string?' },
  reminderCount: { column: 'reminder_count', type: 'number' },
  createdAt: { column: 'created_at', type: 'string' },
  updatedAt: { column: 'updated_at', type: 'string' },
  projectName: { column: 'project_name', type: 'string?' },
  clientName: { column: 'client_name', type: 'string?' }
});

export const toPaymentInstallment = createMapper<PaymentInstallmentRow, PaymentInstallment>(
  paymentInstallmentSchema
);
