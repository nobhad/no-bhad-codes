/**
 * PortalSettings
 * Main settings view with tab-based navigation
 * Uses inline-edit pattern for fields
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { TabPanel } from '@react/factories';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { useFadeIn } from '@react/hooks/useGsap';
import { ProfileForm } from './ProfileForm';
import { BillingForm } from './BillingForm';
import { NotificationsForm } from './NotificationsForm';
import { ContactsSection } from './ContactsSection';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalSettings');

// Types
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

export interface PortalSettingsProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Tab types
type SettingsTab = 'profile' | 'billing' | 'notifications';

/**
 * PortalSettings Component
 */
export function PortalSettings({
  getAuthToken,
  showNotification
}: PortalSettingsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [billing, setBilling] = useState<BillingAddress>({});
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email_invoices: true,
    email_project_updates: true,
    email_messages: true,
    email_marketing: false
  });

  // Use refs for callback props to avoid dependency issues
  const getAuthTokenRef = useRef(getAuthToken);
  const showNotificationRef = useRef(showNotification);

  useEffect(() => {
    getAuthTokenRef.current = getAuthToken;
    showNotificationRef.current = showNotification;
  }, [getAuthToken, showNotification]);

  // Build headers with auth token
  const buildHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const token = getAuthTokenRef.current?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.CLIENTS_ME, {
        headers: buildHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      const rawClient = (payload.client || payload) as Record<string, unknown>;
      setProfile(rawClient as unknown as ClientProfile);

      // Set billing if available
      if (rawClient.billing_address) {
        setBilling(rawClient.billing_address as BillingAddress);
      } else if (payload.billing_address) {
        setBilling(payload.billing_address as BillingAddress);
      }

      // Set notification preferences if available
      const notifPrefs = (rawClient.notification_preferences || payload.notification_preferences) as NotificationPreferences | undefined;
      if (notifPrefs) {
        setNotifications(prev => ({
          ...prev,
          ...notifPrefs
        }));
      }
    } catch (err) {
      logger.error('Error fetching profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [buildHeaders]);

  // Initial fetch - run only once on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  // Listen for EJS subtab changes (subtabs are rendered server-side)
  useEffect(() => {
    const handler = (e: Event) => {
      const subtab = (e as CustomEvent).detail?.subtab;
      if (subtab === 'profile' || subtab === 'billing' || subtab === 'notifications') {
        setActiveTab(subtab);
      }
    };
    window.addEventListener('settingsSubtabChange', handler);
    return () => window.removeEventListener('settingsSubtabChange', handler);
  }, []);

  // Update profile
  const handleProfileUpdate = useCallback(async (updates: Partial<ClientProfile>) => {
    try {
      const response = await fetch(API_ENDPOINTS.CLIENTS_ME, {
        method: 'PUT',
        headers: buildHeaders(),
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      showNotificationRef.current?.('Profile updated', 'success');
      return true;
    } catch (err) {
      logger.error('Error updating profile:', err);
      showNotificationRef.current?.('Failed to update profile', 'error');
      return false;
    }
  }, [buildHeaders]);

  // Update billing
  const handleBillingUpdate = useCallback(async (updates: BillingAddress) => {
    try {
      const response = await fetch(API_ENDPOINTS.CLIENTS_ME_BILLING, {
        method: 'PUT',
        headers: buildHeaders(),
        credentials: 'include',
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update billing');
      }

      setBilling(updates);
      showNotificationRef.current?.('Billing address updated', 'success');
      return true;
    } catch (err) {
      logger.error('Error updating billing:', err);
      showNotificationRef.current?.('Failed to update billing address', 'error');
      return false;
    }
  }, [buildHeaders]);

  // Update notifications
  const handleNotificationsUpdate = useCallback(async (updates: NotificationPreferences) => {
    try {
      const response = await fetch(API_ENDPOINTS.CLIENTS_ME, {
        method: 'PUT',
        headers: buildHeaders(),
        credentials: 'include',
        body: JSON.stringify({ notification_preferences: updates })
      });

      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }

      setNotifications(updates);
      showNotificationRef.current?.('Notification preferences updated', 'success');
      return true;
    } catch (err) {
      logger.error('Error updating notifications:', err);
      showNotificationRef.current?.('Failed to update notification preferences', 'error');
      return false;
    }
  }, [buildHeaders]);

  return (
    <div ref={containerRef} className="tw-section">
      {isLoading ? (
        <LoadingState message="Loading settings..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProfile} />
      ) : (
        <>
          <TabPanel tabId="profile" isActive={activeTab === 'profile'}>
            {profile && (
              <ProfileForm
                profile={profile}
                onUpdate={handleProfileUpdate}
              />
            )}

            {/* Contacts sub-section under profile */}
            <div className="tw-mt-6 tw-pt-6 tw-border-t tw-border-[var(--portal-border)]">
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
        </>
      )}
    </div>
  );
}
