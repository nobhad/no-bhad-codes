/**
 * ===============================================
 * ENTITY SCHEMAS - CENTRAL EXPORTS
 * ===============================================
 * @file server/database/entities/index.ts
 *
 * Re-exports all entity schemas and mappers for centralized access.
 */

// =====================================================
// CLIENT ENTITIES
// =====================================================

export {
  // Row types
  type ContactRow,
  type ActivityRow,
  type CustomFieldRow,
  type CustomFieldValueRow,
  type TagRow,
  type ClientNoteRow,
  // Schemas
  clientContactSchema,
  clientActivitySchema,
  customFieldSchema,
  customFieldValueSchema,
  tagSchema,
  clientNoteSchema,
  // Mappers
  toContact,
  toActivity,
  toCustomField,
  toCustomFieldValue,
  toTag,
  toClientNote
} from './client.js';

// =====================================================
// LEAD ENTITIES
// =====================================================

export {
  // Row types
  type ScoringRuleRow,
  type PipelineStageRow,
  type LeadTaskRow,
  type LeadNoteRow,
  type LeadSourceRow,
  type ProjectRow,
  type DuplicateRow,
  // Schemas
  scoringRuleSchema,
  pipelineStageSchema,
  leadTaskSchema,
  leadNoteSchema,
  leadSourceSchema,
  leadSummarySchema,
  duplicateResultSchema,
  // Mappers
  toScoringRule,
  toPipelineStage,
  toLeadTask,
  toLeadNote,
  toLeadSource,
  toLeadSummary,
  toDuplicateResult
} from './lead.js';

// =====================================================
// PROJECT ENTITIES
// =====================================================

export {
  // Row types
  type TaskRow,
  type DependencyRow,
  type CommentRow,
  type ChecklistRow,
  type TimeEntryRow,
  type TemplateRow,
  // Schemas
  projectTaskSchema,
  taskDependencySchema,
  taskCommentSchema,
  checklistItemSchema,
  timeEntrySchema,
  projectTemplateSchema,
  // Mappers
  toProjectTask,
  toTaskDependency,
  toTaskComment,
  toChecklistItem,
  toTimeEntry,
  toProjectTemplate
} from './project.js';

// =====================================================
// CONTRACT ENTITIES
// =====================================================

export {
  // Types
  type ContractTemplateType,
  type ContractStatus,
  type ContractTemplate,
  type Contract,
  // Row types
  type ContractTemplateRow,
  type ContractRow,
  // Schemas
  contractTemplateSchema,
  contractSchema,
  // Mappers
  toContractTemplate,
  toContract
} from './contract.js';

// =====================================================
// PROPOSAL ENTITIES
// =====================================================

export {
  // Types
  type ProposalTemplate,
  type ProposalVersion,
  type ProposalSignature,
  type ProposalComment,
  type ProposalActivity,
  type ProposalCustomItem,
  type SignatureRequest,
  // Row types
  type ProposalTemplateRow,
  type ProposalVersionRow,
  type ProposalSignatureRow,
  type ProposalCommentRow,
  type ProposalActivityRow,
  type ProposalCustomItemRow,
  type SignatureRequestRow,
  // Schemas
  proposalTemplateSchema,
  proposalVersionSchema,
  proposalSignatureSchema,
  proposalCommentSchema,
  proposalActivitySchema,
  proposalCustomItemSchema,
  signatureRequestSchema,
  // Mappers
  toProposalTemplate,
  toProposalVersion,
  toProposalSignature,
  toProposalComment,
  toProposalActivity,
  toProposalCustomItem,
  toSignatureRequest
} from './proposal.js';

// =====================================================
// INVOICE ENTITIES
// =====================================================

export {
  // Types (re-exported from invoice-types.ts)
  type Invoice,
  type InvoiceRow,
  type PaymentTermsPreset,
  type PaymentTermsPresetRow,
  type InvoicePayment,
  type InvoicePaymentRow,
  type PaymentPlanTemplate,
  type PaymentPlanTemplateRow,
  type ScheduledInvoice,
  type ScheduledInvoiceRow,
  type RecurringInvoice,
  type RecurringInvoiceRow,
  type InvoiceReminder,
  type InvoiceReminderRow,
  type InvoiceCredit,
  type InvoiceCreditRow,
  type InvoiceStatus,
  type InvoiceType,
  type DiscountType,
  type LateFeeType,
  type ReminderType,
  // Typed row interfaces
  type TypedInvoiceRow,
  type TypedPaymentTermsPresetRow,
  type TypedInvoicePaymentRow,
  type TypedPaymentPlanTemplateRow,
  type TypedScheduledInvoiceRow,
  type TypedRecurringInvoiceRow,
  type TypedInvoiceReminderRow,
  type TypedInvoiceCreditRow,
  // Schemas
  paymentTermsPresetSchema,
  invoicePaymentSchema,
  paymentPlanTemplateSchema,
  scheduledInvoiceSchema,
  recurringInvoiceSchema,
  invoiceReminderSchema,
  invoiceCreditSchema,
  invoiceSchema,
  // Mappers
  toPaymentTermsPreset,
  toInvoicePayment,
  toPaymentPlanTemplate,
  toScheduledInvoice,
  toRecurringInvoice,
  toInvoiceReminder,
  toInvoiceCredit,
  toInvoice
} from './invoice.js';

// =====================================================
// MESSAGE ENTITIES
// =====================================================

export {
  // Types
  type Mention,
  type Reaction,
  type Subscription,
  type ReadReceipt,
  type PinnedMessage,
  // Row types
  type MentionRow,
  type ReactionRow,
  type SubscriptionRow,
  type ReadReceiptRow,
  type PinnedMessageRow,
  // Schemas
  mentionSchema,
  reactionSchema,
  subscriptionSchema,
  readReceiptSchema,
  pinnedMessageSchema,
  // Mappers
  toMention,
  toReaction,
  toSubscription,
  toReadReceipt,
  toPinnedMessage
} from './message.js';

// =====================================================
// SETTINGS ENTITIES
// =====================================================

export {
  // Types
  type SettingType,
  type SystemSetting,
  // Row types
  type SettingRow,
  // Schemas
  systemSettingSchema,
  // Mappers
  toSystemSetting
} from './settings.js';

// =====================================================
// AD HOC REQUEST ENTITIES
// =====================================================

// =====================================================
// PAYMENT SCHEDULE ENTITIES
// =====================================================

export {
  // Types
  type PaymentInstallment,
  // Row types
  type PaymentInstallmentRow,
  // Column constants
  INSTALLMENT_COLUMNS,
  INSTALLMENT_COLUMNS_WITH_JOINS,
  // Schemas
  paymentInstallmentSchema,
  // Mappers
  toPaymentInstallment
} from './payment-schedule.js';

// =====================================================
// CONTENT REQUEST ENTITIES
// =====================================================

export {
  // Types
  type ContentChecklist,
  type ContentItem,
  type ContentRequestTemplate,
  type ContentRequestTemplateItem,
  type CompletionStats,
  // Row types
  type ContentChecklistRow,
  type ContentItemRow,
  type ContentRequestTemplateRow,
  // Column constants
  CHECKLIST_COLUMNS,
  CHECKLIST_COLUMNS_WITH_JOINS,
  ITEM_COLUMNS,
  TEMPLATE_COLUMNS as CONTENT_TEMPLATE_COLUMNS,
  // Schemas
  contentChecklistSchema,
  contentItemSchema,
  contentRequestTemplateSchema,
  // Mappers
  toContentChecklist,
  toContentItem,
  toContentRequestTemplate
} from './content-request.js';

// =====================================================
// AD HOC REQUEST ENTITIES
// =====================================================

export {
  // Types
  type AdHocRequestStatus,
  type AdHocRequestType,
  type AdHocRequestPriority,
  type AdHocRequestUrgency,
  type AdHocRequest,
  // Row types
  type AdHocRequestRow,
  // Schemas
  adHocRequestSchema,
  // Mappers
  toAdHocRequest
} from './ad-hoc-request.js';
