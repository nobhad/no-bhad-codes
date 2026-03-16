/**
 * Admin Modals - Barrel Export
 * React replacements for the EJS admin-modals.ejs partial.
 */

export { DetailModal } from './DetailModal';
export type { DetailModalProps, DetailField } from './DetailModal';

export { AddClientModal } from './AddClientModal';
export type { AddClientModalProps, AddClientFormData } from './AddClientModal';

export { AddProjectModal } from './AddProjectModal';
export type {
  AddProjectModalProps,
  AddProjectFormData,
  NewClientData
} from './AddProjectModal';

export { EditClientInfoModal } from './EditClientInfoModal';
export type {
  EditClientInfoModalProps,
  EditClientInfoFormData
} from './EditClientInfoModal';

export { EditBillingModal } from './EditBillingModal';
export type { EditBillingModalProps, EditBillingFormData } from './EditBillingModal';

export { AdminModalsProvider } from './AdminModalsProvider';
export type { AdminModalsProviderProps } from './AdminModalsProvider';

export {
  CreateContactModal,
  CreateTaskModal,
  CreateEmailTemplateModal,
  CreateKBCategoryModal,
  CreateKBArticleModal,
  CreateContractModal,
  CreateDocumentRequestModal,
  CreateAdHocRequestModal,
  CreateDeliverableModal,
  CreateTimeEntryModal,
  CreateProposalModal
} from './CreateEntityModals';
