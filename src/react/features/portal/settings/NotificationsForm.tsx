/**
 * NotificationsForm
 * Notification preferences form for client portal settings
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Bell, FileText, FolderKanban, MessageSquare, Megaphone, Save, Loader2 } from 'lucide-react';
import { cn } from '@react/lib/utils';
import type { NotificationPreferences } from './PortalSettings';

interface NotificationsFormProps {
  preferences: NotificationPreferences;
  onUpdate: (updates: NotificationPreferences) => Promise<boolean>;
}

// Notification option configuration
interface NotificationOption {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: React.ElementType;
}

const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    key: 'email_invoices',
    label: 'Invoice Notifications',
    description: 'Receive emails when new invoices are sent or payment reminders are due',
    icon: FileText
  },
  {
    key: 'email_project_updates',
    label: 'Project Updates',
    description: 'Get notified about milestones, status changes, and project progress',
    icon: FolderKanban
  },
  {
    key: 'email_messages',
    label: 'Messages',
    description: 'Receive email notifications when you have new messages',
    icon: MessageSquare
  },
  {
    key: 'email_marketing',
    label: 'Marketing & Announcements',
    description: 'Stay updated with news, tips, and special offers',
    icon: Megaphone
  }
];

/**
 * Toggle Switch Component - Brutalist style (square, no rounded)
 */
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'tw-relative tw-inline-flex tw-h-5 tw-w-9 tw-shrink-0 tw-cursor-pointer tw-border tw-border-white tw-transition-colors',
        'focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-white focus:tw-ring-offset-2 focus:tw-ring-offset-black',
        'disabled:tw-cursor-not-allowed disabled:tw-opacity-50',
        checked ? 'tw-bg-white' : 'tw-bg-transparent'
      )}
    >
      <span
        className={cn(
          'tw-pointer-events-none tw-inline-block tw-h-4 tw-w-4 tw-shadow tw-ring-0 tw-transition-transform',
          checked ? 'tw-translate-x-4 tw-bg-black' : 'tw-translate-x-0 tw-bg-white'
        )}
      />
    </button>
  );
}

/**
 * NotificationsForm Component
 */
export function NotificationsForm({ preferences, onUpdate }: NotificationsFormProps) {
  // Form state
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences>(preferences);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Handle toggle change
  const handleToggle = useCallback((key: keyof NotificationPreferences, value: boolean) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: value
    }));
    setIsDirty(true);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);

    const success = await onUpdate(localPreferences);

    setIsSaving(false);

    if (success) {
      setIsDirty(false);
    }
  }, [localPreferences, onUpdate]);

  // Check if form has unsaved changes
  const hasChanges = isDirty && (
    localPreferences.email_invoices !== preferences.email_invoices ||
    localPreferences.email_project_updates !== preferences.email_project_updates ||
    localPreferences.email_messages !== preferences.email_messages ||
    localPreferences.email_marketing !== preferences.email_marketing
  );

  return (
    <form onSubmit={handleSubmit} className="tw-section">
      {/* Notification Preferences Section */}
      <div className="tw-panel">
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-4">
          <Bell className="tw-h-4 tw-w-4 tw-text-[rgba(255,255,255,0.46)]" />
          <h3 className="tw-section-title tw-m-0">
            Email Notifications
          </h3>
        </div>

        <p className="tw-text-muted tw-text-[14px] tw-mb-4">
          Choose which email notifications you would like to receive.
        </p>

        <div className="tw-flex tw-flex-col tw-gap-4">
          {NOTIFICATION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isChecked = localPreferences[option.key];

            return (
              <div
                key={option.key}
                className={cn(
                  'tw-flex tw-items-start tw-justify-between tw-gap-4 tw-p-3',
                  'tw-bg-transparent tw-border tw-border-[rgba(255,255,255,0.2)]',
                  'tw-transition-colors',
                  isChecked && 'tw-border-white'
                )}
              >
                <div className="tw-flex tw-items-start tw-gap-3">
                  <div className={cn(
                    'tw-flex tw-items-center tw-justify-center tw-w-8 tw-h-8',
                    'tw-border tw-border-[rgba(255,255,255,0.3)]',
                    isChecked ? 'tw-bg-white tw-text-black' : 'tw-bg-transparent'
                  )}>
                    <Icon className="tw-h-4 tw-w-4" />
                  </div>
                  <div className="tw-flex tw-flex-col tw-gap-0.5">
                    <span className="tw-text-[14px] tw-font-mono tw-text-white">
                      {option.label}
                    </span>
                    <span className="tw-text-[12px] tw-text-[rgba(255,255,255,0.46)]">
                      {option.description}
                    </span>
                  </div>
                </div>
                <ToggleSwitch
                  checked={isChecked}
                  onChange={(value) => handleToggle(option.key, value)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Note */}
      <div className="tw-card">
        <p className="tw-text-[14px] tw-text-[rgba(255,255,255,0.46)] tw-m-0 tw-font-mono">
          <strong className="tw-text-white">Note:</strong> Some critical notifications
          (such as security alerts and payment confirmations) cannot be disabled and will always be sent.
        </p>
      </div>

      {/* Save Button */}
      <div className="tw-flex tw-justify-end">
        <button
          type="submit"
          className="tw-btn-primary"
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" />
          ) : (
            <Save className="tw-h-4 tw-w-4" />
          )}
          Save Preferences
        </button>
      </div>
    </form>
  );
}
