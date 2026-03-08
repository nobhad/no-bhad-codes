import * as React from 'react';
import { useState, useCallback } from 'react';
import { StickyNote, Plus, Pin, Pencil, Trash2, X, Check } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { PortalButton } from '@react/components/portal/PortalButton';
import { EmptyState } from '@react/components/portal/EmptyState';
import { useFormState } from '@react/hooks/useFormState';
import type { ClientNote } from '../../types';
import { formatRelativeTime } from '@/utils/format-utils';
import { NOTIFICATIONS } from '@/constants/notifications';

interface NotesTabProps {
  notes: ClientNote[];
  onAddNote: (content: string) => Promise<boolean>;
  onUpdateNote: (noteId: number, content: string) => Promise<boolean>;
  onDeleteNote: (noteId: number) => Promise<boolean>;
  onTogglePin: (noteId: number, isPinned: boolean) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/** Format date using shared relative time utility */
function formatNoteDate(dateString: string): string {
  return formatRelativeTime(dateString);
}

const EMPTY_NOTE = '';

/**
 * NotesTab
 * Internal notes for client
 */
export function NotesTab({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePin,
  showNotification
}: NotesTabProps) {
  const {
    isAdding,
    editingId,
    formData: noteContent,
    isSubmitting,
    startAdd: handleStartAdd,
    startEdit,
    cancelForm: handleCancel,
    setFormData: setNoteContent,
    setIsSubmitting,
    isFormOpen
  } = useFormState<string>({ initialData: EMPTY_NOTE });

  const deleteDialog = useConfirmDialog();
  const [noteToDelete, setNoteToDelete] = useState<ClientNote | null>(null);

  // Sort notes: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pinnedNotes = sortedNotes.filter((n) => n.is_pinned);
  const unpinnedNotes = sortedNotes.filter((n) => !n.is_pinned);

  // Start editing — maps ClientNote to string content
  const handleStartEdit = useCallback((note: ClientNote) => {
    startEdit(note.id, note.content);
  }, [startEdit]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!noteContent.trim()) {
      showNotification?.(NOTIFICATIONS.note.CONTENT_REQUIRED, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingId) {
        const success = await onUpdateNote(editingId, noteContent.trim());
        if (success) {
          showNotification?.(NOTIFICATIONS.note.UPDATED, 'success');
          handleCancel();
        } else {
          showNotification?.(NOTIFICATIONS.note.UPDATE_FAILED, 'error');
        }
      } else {
        const success = await onAddNote(noteContent.trim());
        if (success) {
          showNotification?.(NOTIFICATIONS.note.ADDED, 'success');
          handleCancel();
        } else {
          showNotification?.(NOTIFICATIONS.note.ADD_FAILED, 'error');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [noteContent, editingId, onAddNote, onUpdateNote, showNotification, handleCancel]);

  // Delete
  const handleDeleteClick = useCallback(
    (note: ClientNote) => {
      setNoteToDelete(note);
      deleteDialog.open();
    },
    [deleteDialog]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!noteToDelete) return;

    const success = await onDeleteNote(noteToDelete.id);
    if (success) {
      showNotification?.(NOTIFICATIONS.note.DELETED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.note.DELETE_FAILED, 'error');
    }
    setNoteToDelete(null);
  }, [noteToDelete, onDeleteNote, showNotification]);

  // Toggle pin
  const handleTogglePin = useCallback(
    async (note: ClientNote) => {
      const success = await onTogglePin(note.id, !note.is_pinned);
      if (success) {
        showNotification?.(note.is_pinned ? NOTIFICATIONS.note.UNPINNED : NOTIFICATIONS.note.PINNED, 'success');
      } else {
        showNotification?.(NOTIFICATIONS.note.PIN_FAILED, 'error');
      }
    },
    [onTogglePin, showNotification]
  );

  // Render note form
  const renderForm = () => (
    <div className="panel panel-form-spacing">
      <div className="panel-header-row--compact">
        <h3 className="heading text-sm">
          {editingId ? 'Edit Note' : 'New Note'}
        </h3>
        <button
          onClick={handleCancel}
          className="icon-btn"
          aria-label="Cancel editing"
        >
          <X className="icon-md" />
        </button>
      </div>

      <textarea
        value={noteContent}
        onChange={(e) => setNoteContent(e.target.value)}
        placeholder="Write a note..."
        rows={4}
        className="textarea"
        aria-label={editingId ? 'Edit note' : 'New note'}
        autoFocus
      />

      <div className="form-actions--compact">
        <PortalButton variant="ghost" onClick={handleCancel}>
          Cancel
        </PortalButton>
        <PortalButton
          onClick={handleSubmit}
          loading={isSubmitting}
          icon={<Check className="icon-md" />}
        >
          {editingId ? 'Save' : 'Add Note'}
        </PortalButton>
      </div>
    </div>
  );

  // Render note card
  const renderNote = (note: ClientNote) => (
    <div
      key={note.id}
      className={cn(
        'portal-card group',
        note.is_pinned && 'border-primary-accent'
      )}
    >
      {/* Note header */}
      <div className="note-card-header">
        <div className="note-meta">
          {note.is_pinned && (
            <Pin className="icon-xs active-primary" />
          )}
          <span className="text-muted text-xs">
            {formatNoteDate(note.created_at)}
            {note.updated_at !== note.created_at && ' (edited)'}
          </span>
        </div>

        <div className="note-actions">
          <button
            onClick={() => handleTogglePin(note)}
            className={cn(
              'btn-icon',
              note.is_pinned && 'active-primary'
            )}
            title={note.is_pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="icon-sm" />
          </button>
          <button
            onClick={() => handleStartEdit(note)}
            className="icon-btn"
            title="Edit"
            aria-label="Edit note"
          >
            <Pencil className="icon-sm" />
          </button>
          <button
            onClick={() => handleDeleteClick(note)}
            className="icon-btn"
            title="Delete"
            aria-label="Delete note"
          >
            <Trash2 className="icon-sm" />
          </button>
        </div>
      </div>

      {/* Note content */}
      <p className="text-muted text-sm note-content">
        {note.content}
      </p>

      {/* Note footer */}
      {note.created_by && (
        <div className="note-footer">
          <span className="text-muted text-xs">
            by {note.created_by}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="section">
      {/* Header */}
      <div className="tab-section-header">
        <h2 className="heading text-lg">
          Notes ({notes.length})
        </h2>
        {!isFormOpen && (
          <PortalButton variant="secondary" onClick={handleStartAdd} icon={<Plus className="icon-md" />}>
            Add Note
          </PortalButton>
        )}
      </div>

      {/* Add/Edit Form */}
      {isFormOpen && renderForm()}

      {/* Notes List */}
      {notes.length === 0 && !isFormOpen ? (
        <EmptyState
          icon={<StickyNote className="icon-lg" />}
          message="No notes yet. Add internal notes about this client."
        />
      ) : (
        <div className="detail-list--spaced">
          {/* Pinned notes section */}
          {pinnedNotes.length > 0 && (
            <div>
              <h3 className="label section-label-block">
                Pinned
              </h3>
              <div className="card-grid-2col--compact">
                {pinnedNotes.map(renderNote)}
              </div>
            </div>
          )}

          {/* Regular notes */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <h3 className="label section-label-block">
                  Recent
                </h3>
              )}
              <div className="card-grid-2col--compact">
                {unpinnedNotes.map(renderNote)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
