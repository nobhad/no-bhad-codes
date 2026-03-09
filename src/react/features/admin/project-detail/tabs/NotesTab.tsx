import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { StickyNote } from 'lucide-react';
import { IconButton } from '@react/factories';
import type { Project } from '../../types';
import { NOTIFICATIONS } from '@/constants/notifications';
import { isKeyCombo } from '@/constants/keyboard';

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
      showNotification?.(NOTIFICATIONS.project.NOTES_SAVED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.project.NOTES_SAVE_FAILED, 'error');
    }
  }, [notes, onUpdateProject, showNotification]);

  // Handle keyboard shortcut (Ctrl/Cmd + S)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isKeyCombo(e, 's', 'cmd')) {
        e.preventDefault();
        if (hasChanges) {
          handleSave();
        }
      }
    },
    [hasChanges, handleSave]
  );

  return (
    <div className="section tab-section">
      {/* Header */}
      <div className="layout-row-between">
        <div className="layout-row gap-2">
          <StickyNote className="icon-lg" />
          <h3 className="heading">
            Internal Notes
          </h3>
          <span className="text-muted pd-hint">
            (Only visible to admins)
          </span>
        </div>

        <div className="layout-row gap-2">
          {hasChanges && (
            <span className="text-muted pd-hint">Unsaved changes</span>
          )}
          <IconButton
            action="save"
            onClick={handleSave}
            disabled={!hasChanges}
            loading={isSaving}
            title="Save"
          />
        </div>
      </div>

      {/* Notes Editor */}
      <div className="panel notes-panel">
        <textarea
          value={notes}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Add internal notes about this project..."
          rows={15}
          className="textarea notes-textarea" aria-label="Internal project notes"
        />
      </div>

      {/* Keyboard shortcut hint */}
      <div className="text-muted notes-hint">
        Press <kbd className="badge msgtab-kbd">Cmd+S</kbd> or{' '}
        <kbd className="badge msgtab-kbd">Ctrl+S</kbd> to save
      </div>
    </div>
  );
}
