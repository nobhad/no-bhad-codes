/**
 * NotificationsForm
 * Notification preferences form for client portal settings
 * Uses inline-toggle pattern: toggle to save immediately
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Bell, FileText, FolderKanban, MessageSquare, Megaphone, Loader2 } from 'lucide-react';
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
  loading?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled, loading }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || loading}
      onClick={() => onChange(!checked)}
      className={cn('notification-toggle', checked && 'is-checked')}
    >
      {loading ? (
        <span className="toggle-loading">
          <Loader2 />
        </span>
      ) : (
        <span className="toggle-thumb" />
      )}
    </button>
  );
}

/**
 * NotificationsForm Component
 * Toggles save immediately on change
 */
export function NotificationsForm({ preferences, onUpdate }: NotificationsFormProps) {
  // Track which toggle is currently saving
  const [savingKey, setSavingKey] = useState<keyof NotificationPreferences | null>(null);

  // Handle toggle change - saves immediately
  const handleToggle = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    setSavingKey(key);

    const updatedPreferences: NotificationPreferences = {
      ...preferences,
      [key]: value
    };

    await onUpdate(updatedPreferences);

    setSavingKey(null);
  }, [preferences, onUpdate]);

  return (
    <div className="settings-form-section">
      {/* Notification Preferences Section */}
      <div className="portal-section">
        <div className="section-header">
          <Bell className="section-icon"  />
          <h3 className="section-title">
            Email Notifications
          </h3>
        </div>

        <p className="section-description">
          Choose which email notifications you would like to receive.
        </p>

        <div className="notification-options">
          {NOTIFICATION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isChecked = preferences[option.key];
            const isLoading = savingKey === option.key;

            return (
              <div
                key={option.key}
                className={cn('notification-option', isChecked && 'is-active')}
              >
                <div className="notification-option-content">
                  <div className={cn('notification-option-icon', isChecked && 'is-active')}>
                    <Icon  />
                  </div>
                  <div className="notification-option-text">
                    <span className="notification-option-label">
                      {option.label}
                    </span>
                    <span className="notification-option-description">
                      {option.description}
                    </span>
                  </div>
                </div>
                <ToggleSwitch
                  checked={isChecked}
                  onChange={(value) => handleToggle(option.key, value)}
                  loading={isLoading}
                  disabled={savingKey !== null && savingKey !== option.key}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Note */}
      <div className="notification-note">
        <p>
          <strong>Note:</strong> Some critical notifications
          (such as security alerts and payment confirmations) cannot be disabled and will always be sent.
        </p>
      </div>
    </div>
  );
}
