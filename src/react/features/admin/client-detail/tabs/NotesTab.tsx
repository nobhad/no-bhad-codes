import * as React from 'react';
import { useState, useCallback } from 'react';
import { StickyNote, Plus, Pin, Pencil, Trash2, X, Check } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import type { ClientNote } from '../../types';

interface NotesTabProps {
  notes: ClientNote[];
  onAddNote: (content: string) => Promise<boolean>;
  onUpdateNote: (noteId: number, content: string) => Promise<boolean>;
  onDeleteNote: (noteId: number) => Promise<boolean>;
  onTogglePin: (noteId: number, isPinned: boolean) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Format date
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

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
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Start adding
  const handleStartAdd = useCallback(() => {
    setNoteContent('');
    setEditingId(null);
    setIsAdding(true);
  }, []);

  // Start editing
  const handleStartEdit = useCallback((note: ClientNote) => {
    setNoteContent(note.content);
    setEditingId(note.id);
    setIsAdding(false);
  }, []);

  // Cancel
  const handleCancel = useCallback(() => {
    setNoteContent('');
    setEditingId(null);
    setIsAdding(false);
  }, []);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!noteContent.trim()) {
      showNotification?.('Note content is required', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingId) {
        const success = await onUpdateNote(editingId, noteContent.trim());
        if (success) {
          showNotification?.('Note updated', 'success');
          handleCancel();
        } else {
          showNotification?.('Failed to update note', 'error');
        }
      } else {
        const success = await onAddNote(noteContent.trim());
        if (success) {
          showNotification?.('Note added', 'success');
          handleCancel();
        } else {
          showNotification?.('Failed to add note', 'error');
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
      showNotification?.('Note deleted', 'success');
    } else {
      showNotification?.('Failed to delete note', 'error');
    }
    setNoteToDelete(null);
  }, [noteToDelete, onDeleteNote, showNotification]);

  // Toggle pin
  const handleTogglePin = useCallback(
    async (note: ClientNote) => {
      const success = await onTogglePin(note.id, !note.is_pinned);
      if (success) {
        showNotification?.(note.is_pinned ? 'Note unpinned' : 'Note pinned', 'success');
      } else {
        showNotification?.('Failed to update note', 'error');
      }
    },
    [onTogglePin, showNotification]
  );

  // Render note form
  const renderForm = () => (
    <div className="tw-panel tw-mb-4">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <h3 className="tw-heading" style={{ fontSize: '14px' }}>
          {editingId ? 'Edit Note' : 'New Note'}
        </h3>
        <button
          onClick={handleCancel}
          className="tw-btn-icon"
        >
          <X className="tw-h-4 tw-w-4" />
        </button>
      </div>

      <textarea
        value={noteContent}
        onChange={(e) => setNoteContent(e.target.value)}
        placeholder="Write a note..."
        rows={4}
        className="tw-textarea"
        autoFocus
      />

      <div className="tw-flex tw-justify-end tw-gap-2 tw-mt-3">
        <button className="tw-btn-ghost" onClick={handleCancel}>
          Cancel
        </button>
        <button
          className="tw-btn-primary"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          <Check className="tw-h-4 tw-w-4" />
          {isSubmitting ? 'Saving...' : (editingId ? 'Save' : 'Add Note')}
        </button>
      </div>
    </div>
  );

  // Render note card
  const renderNote = (note: ClientNote) => (
    <div
      key={note.id}
      className={cn(
        'tw-card tw-group',
        note.is_pinned && 'tw-border-white'
      )}
    >
      {/* Note header */}
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-2 tw-mb-2">
        <div className="tw-flex tw-items-center tw-gap-2">
          {note.is_pinned && (
            <Pin className="tw-h-3 tw-w-3 tw-text-white tw-fill-current" />
          )}
          <span className="tw-text-muted" style={{ fontSize: '12px' }}>
            {formatDate(note.created_at)}
            {note.updated_at !== note.created_at && ' (edited)'}
          </span>
        </div>

        <div className="tw-flex tw-items-center tw-gap-1 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity">
          <button
            onClick={() => handleTogglePin(note)}
            className={cn(
              'tw-btn-icon',
              note.is_pinned && 'tw-text-white'
            )}
            title={note.is_pinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="tw-h-3.5 tw-w-3.5" />
          </button>
          <button
            onClick={() => handleStartEdit(note)}
            className="tw-btn-icon"
            title="Edit"
          >
            <Pencil className="tw-h-3.5 tw-w-3.5" />
          </button>
          <button
            onClick={() => handleDeleteClick(note)}
            className="tw-btn-icon"
            title="Delete"
          >
            <Trash2 className="tw-h-3.5 tw-w-3.5" />
          </button>
        </div>
      </div>

      {/* Note content */}
      <p className="tw-text-muted" style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>
        {note.content}
      </p>

      {/* Note footer */}
      {note.created_by && (
        <div className="tw-mt-2 tw-pt-2" style={{ borderTop: '1px solid var(--portal-border-subtle)' }}>
          <span className="tw-text-muted" style={{ fontSize: '12px' }}>
            by {note.created_by}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="tw-section">
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <h2 className="tw-heading" style={{ fontSize: '18px' }}>
          Notes ({notes.length})
        </h2>
        {!isAdding && !editingId && (
          <button className="tw-btn-secondary" onClick={handleStartAdd}>
            <Plus className="tw-h-4 tw-w-4" />
            Add Note
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && renderForm()}

      {/* Notes List */}
      {notes.length === 0 && !isAdding ? (
        <div className="tw-empty-state">
          <StickyNote className="tw-h-12 tw-w-12 tw-mb-3" />
          <p>No notes yet</p>
          <p style={{ fontSize: '14px' }}>
            Add internal notes about this client
          </p>
        </div>
      ) : (
        <div className="tw-flex tw-flex-col tw-gap-4">
          {/* Pinned notes section */}
          {pinnedNotes.length > 0 && (
            <div>
              <h3 className="tw-label tw-mb-2">
                Pinned
              </h3>
              <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                {pinnedNotes.map(renderNote)}
              </div>
            </div>
          )}

          {/* Regular notes */}
          {unpinnedNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <h3 className="tw-label tw-mb-2">
                  Recent
                </h3>
              )}
              <div className="tw-grid tw-grid-cols-2 tw-gap-3">
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
