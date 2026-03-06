/**
 * AdminModalsProvider
 * Bridges vanilla JS admin-dashboard with React modal components.
 *
 * Listens for custom events dispatched from vanilla JS to open modals,
 * and dispatches custom events back when forms are submitted so
 * vanilla JS can refresh data without tight coupling.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { DetailModal } from './DetailModal';
import { AddClientModal } from './AddClientModal';
import { AddProjectModal } from './AddProjectModal';
import { EditClientInfoModal } from './EditClientInfoModal';
import { EditBillingModal } from './EditBillingModal';
import type { DetailField } from './DetailModal';
import type { AddClientFormData } from './AddClientModal';
import type { AddProjectFormData } from './AddProjectModal';
import type { EditClientInfoFormData } from './EditClientInfoModal';
import type { EditBillingFormData } from './EditBillingModal';
import type { ModalDropdownOption } from '@react/components/portal/ModalDropdown';
import type { BaseMountOptions } from '@react/factories';

// ============================================
// TYPES
// ============================================

/** Props for the provider, extending base mount options */
export interface AdminModalsProviderProps extends BaseMountOptions {}

/** Detail modal event payload */
interface DetailModalPayload {
  title: string;
  fields: DetailField[];
  message?: string;
  statusBadge?: React.ReactNode;
}

/** Add project event payload with dropdown options */
interface AddProjectPayload {
  clientOptions: ModalDropdownOption[];
  projectTypeOptions: ModalDropdownOption[];
  budgetOptions: ModalDropdownOption[];
  timelineOptions: ModalDropdownOption[];
}

/** Edit client info event payload with initial data and status options */
interface EditClientInfoPayload {
  initialData: Partial<EditClientInfoFormData>;
  statusOptions: ModalDropdownOption[];
}

/** Edit billing event payload with initial data */
interface EditBillingPayload {
  initialData: Partial<EditBillingFormData>;
}

// ============================================
// CUSTOM EVENT NAMES
// ============================================

/** Events dispatched FROM vanilla JS to open modals */
const OPEN_EVENTS = {
  DETAIL: 'admin:open-detail-modal',
  ADD_CLIENT: 'admin:open-add-client',
  ADD_PROJECT: 'admin:open-add-project',
  EDIT_CLIENT_INFO: 'admin:open-edit-client-info',
  EDIT_BILLING: 'admin:open-edit-billing'
} as const;

/** Events dispatched TO vanilla JS when forms are submitted */
const SUBMIT_EVENTS = {
  CLIENT_ADDED: 'admin:client-added',
  PROJECT_ADDED: 'admin:project-added',
  CLIENT_INFO_UPDATED: 'admin:client-info-updated',
  BILLING_UPDATED: 'admin:billing-updated'
} as const;

// ============================================
// HELPERS
// ============================================

/** Dispatch a custom event with optional detail payload */
function dispatchAdminEvent<T>(eventName: string, detail?: T): void {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

// ============================================
// COMPONENT
// ============================================

export function AdminModalsProvider(_props: AdminModalsProviderProps) {
  // ----- Detail Modal State -----
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<DetailModalPayload>({
    title: 'Details',
    fields: []
  });

  // ----- Add Client Modal State -----
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addClientLoading, setAddClientLoading] = useState(false);

  // ----- Add Project Modal State -----
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addProjectLoading, setAddProjectLoading] = useState(false);
  const [addProjectPayload, setAddProjectPayload] = useState<AddProjectPayload>({
    clientOptions: [],
    projectTypeOptions: [],
    budgetOptions: [],
    timelineOptions: []
  });

  // ----- Edit Client Info Modal State -----
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editClientLoading, setEditClientLoading] = useState(false);
  const [editClientPayload, setEditClientPayload] = useState<EditClientInfoPayload>({
    initialData: {},
    statusOptions: []
  });

  // ----- Edit Billing Modal State -----
  const [editBillingOpen, setEditBillingOpen] = useState(false);
  const [editBillingLoading, setEditBillingLoading] = useState(false);
  const [editBillingPayload, setEditBillingPayload] = useState<EditBillingPayload>({
    initialData: {}
  });

  // ============================================
  // EVENT LISTENERS (vanilla JS -> React)
  // ============================================

  useEffect(() => {
    const handleOpenDetail = (e: Event) => {
      const detail = (e as CustomEvent<DetailModalPayload>).detail;
      setDetailData(detail);
      setDetailOpen(true);
    };

    const handleOpenAddClient = () => {
      setAddClientOpen(true);
    };

    const handleOpenAddProject = (e: Event) => {
      const detail = (e as CustomEvent<AddProjectPayload>).detail;
      setAddProjectPayload(detail);
      setAddProjectOpen(true);
    };

    const handleOpenEditClientInfo = (e: Event) => {
      const detail = (e as CustomEvent<EditClientInfoPayload>).detail;
      setEditClientPayload(detail);
      setEditClientOpen(true);
    };

    const handleOpenEditBilling = (e: Event) => {
      const detail = (e as CustomEvent<EditBillingPayload>).detail;
      setEditBillingPayload(detail);
      setEditBillingOpen(true);
    };

    window.addEventListener(OPEN_EVENTS.DETAIL, handleOpenDetail);
    window.addEventListener(OPEN_EVENTS.ADD_CLIENT, handleOpenAddClient);
    window.addEventListener(OPEN_EVENTS.ADD_PROJECT, handleOpenAddProject);
    window.addEventListener(OPEN_EVENTS.EDIT_CLIENT_INFO, handleOpenEditClientInfo);
    window.addEventListener(OPEN_EVENTS.EDIT_BILLING, handleOpenEditBilling);

    return () => {
      window.removeEventListener(OPEN_EVENTS.DETAIL, handleOpenDetail);
      window.removeEventListener(OPEN_EVENTS.ADD_CLIENT, handleOpenAddClient);
      window.removeEventListener(OPEN_EVENTS.ADD_PROJECT, handleOpenAddProject);
      window.removeEventListener(OPEN_EVENTS.EDIT_CLIENT_INFO, handleOpenEditClientInfo);
      window.removeEventListener(OPEN_EVENTS.EDIT_BILLING, handleOpenEditBilling);
    };
  }, []);

  // ============================================
  // SUBMIT HANDLERS (React -> vanilla JS)
  // ============================================

  const handleAddClientSubmit = useCallback(async (data: AddClientFormData) => {
    setAddClientLoading(true);
    try {
      dispatchAdminEvent(SUBMIT_EVENTS.CLIENT_ADDED, data);
      setAddClientOpen(false);
    } finally {
      setAddClientLoading(false);
    }
  }, []);

  const handleAddProjectSubmit = useCallback(async (data: AddProjectFormData) => {
    setAddProjectLoading(true);
    try {
      dispatchAdminEvent(SUBMIT_EVENTS.PROJECT_ADDED, data);
      setAddProjectOpen(false);
    } finally {
      setAddProjectLoading(false);
    }
  }, []);

  const handleEditClientInfoSubmit = useCallback(async (data: EditClientInfoFormData) => {
    setEditClientLoading(true);
    try {
      dispatchAdminEvent(SUBMIT_EVENTS.CLIENT_INFO_UPDATED, data);
      setEditClientOpen(false);
    } finally {
      setEditClientLoading(false);
    }
  }, []);

  const handleEditBillingSubmit = useCallback(async (data: EditBillingFormData) => {
    setEditBillingLoading(true);
    try {
      dispatchAdminEvent(SUBMIT_EVENTS.BILLING_UPDATED, data);
      setEditBillingOpen(false);
    } finally {
      setEditBillingLoading(false);
    }
  }, []);

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      <DetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detailData.title}
        fields={detailData.fields}
        message={detailData.message}
        statusBadge={detailData.statusBadge}
      />

      <AddClientModal
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
        onSubmit={handleAddClientSubmit}
        loading={addClientLoading}
      />

      <AddProjectModal
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        onSubmit={handleAddProjectSubmit}
        clientOptions={addProjectPayload.clientOptions}
        projectTypeOptions={addProjectPayload.projectTypeOptions}
        budgetOptions={addProjectPayload.budgetOptions}
        timelineOptions={addProjectPayload.timelineOptions}
        loading={addProjectLoading}
      />

      <EditClientInfoModal
        open={editClientOpen}
        onOpenChange={setEditClientOpen}
        onSubmit={handleEditClientInfoSubmit}
        initialData={editClientPayload.initialData}
        statusOptions={editClientPayload.statusOptions}
        loading={editClientLoading}
      />

      <EditBillingModal
        open={editBillingOpen}
        onOpenChange={setEditBillingOpen}
        onSubmit={handleEditBillingSubmit}
        initialData={editBillingPayload.initialData}
        loading={editBillingLoading}
      />
    </>
  );
}
