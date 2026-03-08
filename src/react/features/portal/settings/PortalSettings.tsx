/**
 * PortalSettings
 * Thin view layer for settings with tab-based navigation.
 * All state and API logic lives in useSettingsData hook.
 */

import * as React from 'react';
import { TabPanel } from '@react/factories';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { useFadeIn } from '@react/hooks/useGsap';
import { ProfileForm } from './ProfileForm';
import { BillingForm } from './BillingForm';
import { NotificationsForm } from './NotificationsForm';
import { ContactsSection } from './ContactsSection';
import { useSettingsData } from './useSettingsData';
import type { PortalViewProps } from '../types';

// --- Exported types (consumed by hook and child components) ---

export interface ClientProfile {
  id: number;
  contact_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  created_at?: string;
}

export interface BillingAddress {
  street_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface NotificationPreferences {
  email_invoices: boolean;
  email_project_updates: boolean;
  email_messages: boolean;
  email_marketing: boolean;
}

export type SettingsTab = 'profile' | 'billing' | 'notifications';

export interface PortalSettingsProps extends PortalViewProps {}

/**
 * PortalSettings Component
 * Renders settings tabs; delegates all data logic to useSettingsData.
 */
export function PortalSettings({ getAuthToken, showNotification }: PortalSettingsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const {
    activeTab,
    isLoading,
    error,
    profile,
    billing,
    notifications,
    buildHeaders,
    fetchProfile,
    handleProfileUpdate,
    handleBillingUpdate,
    handleNotificationsUpdate
  } = useSettingsData({ getAuthToken, showNotification });

  if (isLoading) {
    return (
      <div ref={containerRef} className="section">
        <LoadingState message="Loading settings..." />
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className="section">
        <ErrorState message={error} onRetry={fetchProfile} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="section">
      <TabPanel tabId="profile" isActive={activeTab === 'profile'}>
        {profile && (
          <ProfileForm
            profile={profile}
            onUpdate={handleProfileUpdate}
          />
        )}

        {/* Contacts sub-section under profile */}
        <div className="mt-6 pt-6 border-t border-[var(--portal-border)]">
          <ContactsSection
            buildHeaders={buildHeaders}
            showNotification={showNotification}
          />
        </div>
      </TabPanel>

      <TabPanel tabId="billing" isActive={activeTab === 'billing'}>
        <BillingForm
          billing={billing}
          onUpdate={handleBillingUpdate}
        />
      </TabPanel>

      <TabPanel tabId="notifications" isActive={activeTab === 'notifications'}>
        <NotificationsForm
          preferences={notifications}
          onUpdate={handleNotificationsUpdate}
        />
      </TabPanel>
    </div>
  );
}
