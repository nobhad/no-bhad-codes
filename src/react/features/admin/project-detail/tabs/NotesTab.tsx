import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { Save, StickyNote } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import type { Project } from '../../types';

interface NotesTabProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => Promise<boolean>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * NotesTab
 * Internal admin notes for project
 */
export function NotesTab({
  project,
  onUpdateProject,
  showNotification
}: NotesTabProps) {
  const [notes, setNotes] = useState(project.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset notes when project changes
  useEffect(() => {
    setNotes(project.notes || '');
    setHasChanges(false);
  }, [project.notes]);

  // Track changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setNotes(newValue);
    setHasChanges(newValue !== (project.notes || ''));
  }, [project.notes]);

  // Save notes
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const success = await onUpdateProject({ notes });
    setIsSaving(false);

    if (success) {
      setHasChanges(false);
      showNotification?.('Notes saved', 'success');
    } else {
      showNotification?.('Failed to save notes', 'error');
    }
  }, [notes, onUpdateProject, showNotification]);

  // Handle keyboard shortcut (Ctrl/Cmd + S)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) {
          handleSave();
        }
      }
    },
    [hasChanges, handleSave]
  );

  return (
    <div className="tw-section">
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <div className="tw-flex tw-items-center tw-gap-2">
          <StickyNote className="icon-lg" />
          <h3 className="tw-heading ">
            Internal Notes
          </h3>
          <span className="tw-text-muted tw-text-sm">
            (Only visible to admins)
          </span>
        </div>

        <div className="tw-flex tw-items-center tw-gap-2">
          {hasChanges && (
            <span className="tw-text-muted tw-text-sm">Unsaved changes</span>
          )}
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save className="icon-md" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Notes Editor */}
      <div className="tw-panel notes-panel">
        <textarea
          value={notes}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Add internal notes about this project..."
          rows={15}
          className="tw-textarea notes-textarea"
        />
      </div>

      {/* Keyboard shortcut hint */}
      <div className="tw-text-muted notes-hint">
        Press <kbd className="tw-badge msgtab-kbd">Cmd+S</kbd> or{' '}
        <kbd className="tw-badge msgtab-kbd">Ctrl+S</kbd> to save
      </div>
    </div>
  );
}
