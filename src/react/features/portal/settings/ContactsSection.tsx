/**
 * ContactsSection
 * Client contact management within portal settings
 * CRUD operations for client's own contacts
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { EmptyState, LoadingState } from '@react/components/portal/EmptyState';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('ContactsSection');

interface ClientContact {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  department: string | null;
  role: string;
  is_primary: boolean;
  notes: string | null;
}

interface ContactsSectionProps {
  portalFetch: <T>(url: string, options?: { method?: string; body?: unknown; headers?: Record<string, string>; unwrap?: boolean }) => Promise<T>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const EMPTY_FORM: Omit<ClientContact, 'id' | 'is_primary'> = {
  first_name: '',
  last_name: '',
  email: null,
  phone: null,
  title: null,
  department: null,
  role: 'general',
  notes: null
};

export function ContactsSection({ portalFetch, showNotification }: ContactsSectionProps) {
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await portalFetch<{ contacts?: ClientContact[] }>(API_ENDPOINTS.CLIENTS_ME_CONTACTS);
      setContacts(result.contacts || []);
    } catch (err) {
      logger.error('Error fetching contacts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [portalFetch]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleAdd = useCallback(async () => {
    if (!formData.first_name || !formData.last_name) {
      showNotification?.('First and last name are required', 'error');
      return;
    }

    try {
      const result = await portalFetch<{ contact?: ClientContact }>(
        API_ENDPOINTS.CLIENTS_ME_CONTACTS,
        { method: 'POST', body: formData }
      );
      if (result.contact) {
        setContacts(prev => [...prev, result.contact!]);
      }
      setShowAddForm(false);
      setFormData(EMPTY_FORM);
      showNotification?.('Contact added', 'success');
    } catch (err) {
      logger.error('Error adding contact:', err);
      showNotification?.('Failed to add contact', 'error');
    }
  }, [formData, portalFetch, showNotification]);

  const handleUpdate = useCallback(async (contactId: number) => {
    try {
      const result = await portalFetch<{ contact?: ClientContact }>(
        buildEndpoint.clientMeContact(contactId),
        { method: 'PUT', body: formData }
      );
      if (result.contact) {
        setContacts(prev => prev.map(c => c.id === contactId ? result.contact! : c));
      }
      setEditingId(null);
      setFormData(EMPTY_FORM);
      showNotification?.('Contact updated', 'success');
    } catch (err) {
      logger.error('Error updating contact:', err);
      showNotification?.('Failed to update contact', 'error');
    }
  }, [formData, portalFetch, showNotification]);

  const handleDelete = useCallback(async (contactId: number) => {
    try {
      await portalFetch(buildEndpoint.clientMeContact(contactId), { method: 'DELETE' });
      setContacts(prev => prev.filter(c => c.id !== contactId));
      showNotification?.('Contact deleted', 'success');
    } catch (err) {
      logger.error('Error deleting contact:', err);
      showNotification?.('Failed to delete contact', 'error');
    }
  }, [portalFetch, showNotification]);

  const startEdit = (contact: ClientContact) => {
    setEditingId(contact.id);
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      department: contact.department,
      role: contact.role,
      notes: contact.notes
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData(EMPTY_FORM);
  };

  if (isLoading) {
    return <LoadingState message="Loading contacts..." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="heading text-base m-0">Contacts</h3>
        {!showAddForm && (
          <button
            className="btn-secondary text-sm"
            onClick={() => { setShowAddForm(true); setEditingId(null); setFormData(EMPTY_FORM); }}
          >
            <Plus className="icon-xs" />
            Add Contact
          </button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <ContactForm
          formData={formData}
          setFormData={setFormData}
          onSave={handleAdd}
          onCancel={cancelEdit}
        />
      )}

      {/* Contact List */}
      {contacts.length === 0 && !showAddForm ? (
        <EmptyState
          icon={<Users className="icon-lg" />}
          message="No contacts added yet"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((contact) => (
            editingId === contact.id ? (
              <ContactForm
                key={contact.id}
                formData={formData}
                setFormData={setFormData}
                onSave={() => handleUpdate(contact.id)}
                onCancel={cancelEdit}
              />
            ) : (
              <div key={contact.id} className="portal-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-primary text-sm font-medium">
                      {contact.first_name} {contact.last_name}
                      {contact.is_primary && (
                        <span className="badge ml-2">Primary</span>
                      )}
                    </span>
                    <div className="flex items-center gap-3 text-muted text-xs flex-wrap">
                      {contact.email && <span>{contact.email}</span>}
                      {contact.phone && <span>{contact.phone}</span>}
                      {contact.title && <span>{contact.title}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="btn-ghost p-1"
                      onClick={() => startEdit(contact)}
                      title="Edit"
                    >
                      <Edit2 className="icon-xs" />
                    </button>
                    <button
                      className="btn-ghost p-1"
                      onClick={() => handleDelete(contact.id)}
                      title="Delete"
                    >
                      <Trash2 className="icon-xs" />
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Inline contact form for add/edit
 */
function ContactForm({
  formData,
  setFormData,
  onSave,
  onCancel
}: {
  formData: typeof EMPTY_FORM;
  setFormData: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const updateField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value || null }));
  };

  return (
    <div className="portal-card flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label text-xs mb-1 block">First Name *</label>
          <input
            className="form-input w-full"
            value={formData.first_name}
            onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
            placeholder="First name"
          />
        </div>
        <div>
          <label className="label text-xs mb-1 block">Last Name *</label>
          <input
            className="form-input w-full"
            value={formData.last_name}
            onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
            placeholder="Last name"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label text-xs mb-1 block">Email</label>
          <input
            className="form-input w-full"
            type="email"
            value={formData.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="Email address"
          />
        </div>
        <div>
          <label className="label text-xs mb-1 block">Phone</label>
          <input
            className="form-input w-full"
            value={formData.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="Phone number"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label text-xs mb-1 block">Title</label>
          <input
            className="form-input w-full"
            value={formData.title || ''}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Job title"
          />
        </div>
        <div>
          <label className="label text-xs mb-1 block">Role</label>
          <select
            className="form-input w-full"
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
          >
            <option value="general">General</option>
            <option value="primary">Primary</option>
            <option value="billing">Billing</option>
            <option value="technical">Technical</option>
            <option value="decision_maker">Decision Maker</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost text-sm" onClick={onCancel}>
          <X className="icon-xs" />
          Cancel
        </button>
        <button className="btn-primary text-sm" onClick={onSave}>
          <Check className="icon-xs" />
          Save
        </button>
      </div>
    </div>
  );
}
