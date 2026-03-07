import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  FolderKanban,
  StickyNote,
  MoreHorizontal,
  Pencil,
  Mail,
  Archive,
  Trash2
} from 'lucide-react';
import { IconButton, TabList, TabPanel } from '@react/factories';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
  PortalDropdownSeparator
} from '@react/components/portal/PortalDropdown';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useClientDetail } from '@react/hooks/useClientDetail';
import { useFadeIn } from '@react/hooks/useGsap';
import { OverviewTab } from './tabs/OverviewTab';
import { ContactsTab } from './tabs/ContactsTab';
import { ActivityTab } from './tabs/ActivityTab';
import { ProjectsTab } from './tabs/ProjectsTab';
import { NotesTab } from './tabs/NotesTab';
import type { ClientDetailTab, ClientStatus } from '../types';
import { CLIENT_STATUS_CONFIG, CLIENT_TYPE_LABELS } from '../types';
import { buildEndpoint } from '../../../../constants/api-endpoints';

interface ClientDetailProps {
  /** Client ID to display */
  clientId: number;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback to go back to clients list */
  onBack?: () => void;
  /** Callback to edit client */
  onEdit?: (clientId: number) => void;
  /** Callback to view project */
  onViewProject?: (projectId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Tab icon components mapping
const TAB_ICONS: Record<ClientDetailTab, React.ElementType> = {
  overview: LayoutDashboard,
  contacts: Users,
  activity: Clock,
  projects: FolderKanban,
  notes: StickyNote
};

// Tab configuration
const TABS: Array<{ id: ClientDetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'activity', label: 'Activity' },
  { id: 'projects', label: 'Projects' },
  { id: 'notes', label: 'Notes' }
];

/**
 * ClientDetail
 * Main client detail view with tabbed interface
 */
export function ClientDetail({
  clientId,
  getAuthToken,
  onBack,
  onEdit,
  onViewProject,
  showNotification
}: ClientDetailProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [activeTab, setActiveTab] = useState<ClientDetailTab>('overview');

  // Client data
  const {
    client,
    health,
    contacts,
    activities,
    notes,
    stats,
    projects,
    tags,
    availableTags,
    isLoading,
    error,
    refetch,
    updateClient,
    addContact,
    updateContact,
    deleteContact,
    addNote,
    updateNote,
    deleteNote,
    toggleNotePin: _toggleNotePin,
    addTag,
    removeTag,
    sendInvitation
  } = useClientDetail({ clientId, getAuthToken });

  // Dialogs
  const deleteDialog = useConfirmDialog();
  const archiveDialog = useConfirmDialog();

  // Handle status change
  const handleStatusChange = useCallback(
    async (newStatus: ClientStatus) => {
      const success = await updateClient({ status: newStatus });
      if (success) {
        showNotification?.(`Status updated to ${CLIENT_STATUS_CONFIG[newStatus].label}`, 'success');
      } else {
        showNotification?.('Failed to update status', 'error');
      }
    },
    [updateClient, showNotification]
  );

  // Handle archive
  const handleArchive = useCallback(async () => {
    const success = await updateClient({ status: 'inactive' });
    if (success) {
      showNotification?.('Client archived', 'success');
      onBack?.();
    } else {
      showNotification?.('Failed to archive client', 'error');
    }
  }, [updateClient, showNotification, onBack]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    try {
      const token = getAuthToken?.();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(buildEndpoint.client(clientId), {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      if (response.ok) {
        showNotification?.('Client deleted', 'success');
        onBack?.();
      } else {
        showNotification?.('Failed to delete client', 'error');
      }
    } catch {
      showNotification?.('Failed to delete client', 'error');
    }
  }, [clientId, getAuthToken, showNotification, onBack]);

  // Handle send invitation
  const handleSendInvitation = useCallback(async () => {
    const success = await sendInvitation();
    if (success) {
      showNotification?.('Invitation sent', 'success');
    } else {
      showNotification?.('Failed to send invitation', 'error');
    }
  }, [sendInvitation, showNotification]);

  // Get display name
  const getDisplayName = () => {
    if (!client) return 'Client';
    if (client.client_type === 'business') {
      return client.company_name || client.contact_name || 'Client';
    }
    return client.contact_name || client.company_name || 'Client';
  };

  // Loading state
  if (isLoading && !client) {
    return (
      <div className="loading-state">
        <span className="loading-spinner" />
        <span>Loading client...</span>
      </div>
    );
  }

  // Error state
  if (error && !client) {
    return (
      <div className="portal-card">
        <div className="error-state">
          <p>{error}</p>
          <button className="btn-secondary" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No client found
  if (!client) {
    return (
      <div className="portal-card">
        <div className="empty-state">
          <Users className="icon-xl" />
          <span>Client not found</span>
          <button className="btn-secondary" onClick={onBack}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-section">
      {/* Header */}
      <div className="detail-title-row">
        <div className="detail-title-group">
          {/* Back Button */}
          <IconButton action="back" onClick={onBack} title="Back to clients" />

          {/* Client Info */}
          <div className="detail-info">
            <div className="detail-name-row">
              <h1 className="detail-title">
                {getDisplayName()}
              </h1>
              <PortalDropdown>
                <PortalDropdownTrigger asChild>
                  <button className="btn-unstyled">
                    <span className="tw-badge">
                      {CLIENT_STATUS_CONFIG[client.status]?.label || client.status}
                    </span>
                  </button>
                </PortalDropdownTrigger>
                <PortalDropdownContent>
                  {Object.entries(CLIENT_STATUS_CONFIG)
                    .filter(([status]) => status !== client.status)
                    .map(([status, config]) => (
                      <PortalDropdownItem
                        key={status}
                        onClick={() => handleStatusChange(status as ClientStatus)}
                      >
                        <span className="tw-badge">{config.label}</span>
                      </PortalDropdownItem>
                    ))}
                </PortalDropdownContent>
              </PortalDropdown>
            </div>

            <div className="detail-meta">
              {client.email && (
                <span className="meta-value">{client.email}</span>
              )}
              {client.client_type && (
                <span className="meta-item">
                  <span className="field-label">Type:</span>{' '}
                  <span className="meta-value">
                    {CLIENT_TYPE_LABELS[client.client_type] || client.client_type}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="detail-actions">
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />

          {!client.invitation_sent_at && (
            <button className="btn-secondary" onClick={handleSendInvitation}>
              <Mail className="icon-md" />
              Send Invite
            </button>
          )}

          <button className="btn-secondary" onClick={() => onEdit?.(clientId)}>
            <Pencil className="icon-md" />
            Edit
          </button>

          <PortalDropdown>
            <PortalDropdownTrigger asChild>
              <button className="icon-btn">
                <MoreHorizontal className="icon-lg" />
              </button>
            </PortalDropdownTrigger>
            <PortalDropdownContent align="end">
              <PortalDropdownItem onClick={() => onEdit?.(clientId)}>
                <Pencil className="icon-sm" />
                Edit Client
              </PortalDropdownItem>
              <PortalDropdownItem onClick={archiveDialog.open}>
                <Archive className="icon-sm" />
                Archive Client
              </PortalDropdownItem>
              <PortalDropdownSeparator />
              <PortalDropdownItem
                onClick={deleteDialog.open}
                className="danger"
              >
                <Trash2 className="icon-sm" />
                Delete Client
              </PortalDropdownItem>
            </PortalDropdownContent>
          </PortalDropdown>
        </div>
      </div>

      {/* Tabs */}
      <TabList
        tabs={TABS}
        tabIcons={TAB_ICONS}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ariaLabel="Client detail tabs"
      />

      {/* Tab Content */}
      <TabPanel tabId="overview" isActive={activeTab === 'overview'}>
        <OverviewTab
          client={client}
          health={health}
          stats={stats}
          tags={tags}
          availableTags={availableTags}
          onUpdateClient={updateClient}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="contacts" isActive={activeTab === 'contacts'}>
        <ContactsTab
          contacts={contacts}
          onAddContact={addContact}
          onUpdateContact={updateContact}
          onDeleteContact={deleteContact}
          showNotification={showNotification}
        />
      </TabPanel>

      <TabPanel tabId="activity" isActive={activeTab === 'activity'}>
        <ActivityTab activities={activities} />
      </TabPanel>

      <TabPanel tabId="projects" isActive={activeTab === 'projects'}>
        <ProjectsTab projects={projects} onViewProject={onViewProject} />
      </TabPanel>

      <TabPanel tabId="notes" isActive={activeTab === 'notes'}>
        <NotesTab
          notes={notes}
          onAddNote={addNote}
          onUpdateNote={(noteId, content) => updateNote(noteId, { content })}
          onDeleteNote={deleteNote}
          onTogglePin={(noteId, isPinned) => updateNote(noteId, { is_pinned: isPinned })}
          showNotification={showNotification}
        />
      </TabPanel>

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={archiveDialog.isOpen}
        onOpenChange={archiveDialog.setIsOpen}
        title="Archive Client"
        description="Are you sure you want to archive this client? You can restore them later."
        confirmText="Archive"
        cancelText="Cancel"
        onConfirm={handleArchive}
        variant="warning"
        loading={archiveDialog.isLoading}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Client"
        description="Are you sure you want to delete this client? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
