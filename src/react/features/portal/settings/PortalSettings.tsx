/**
 * PortalSettings
 * Main settings view with tab-based navigation
 * Uses inline-edit pattern for fields
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { User, CreditCard, Bell } from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { ProfileForm } from './ProfileForm';
import { BillingForm } from './BillingForm';
import { NotificationsForm } from './NotificationsForm';

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

// Tab configuration
const TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell }
];

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
      const response = await fetch('/api/clients/me', {
        headers: buildHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      setProfile(data.client || data);

      // Set billing if available
      if (data.billing_address) {
        setBilling(data.billing_address);
      }

      // Set notification preferences if available
      if (data.notification_preferences) {
        setNotifications(prev => ({
          ...prev,
          ...data.notification_preferences
        }));
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [buildHeaders]);

  // Initial fetch - run only once on mount
  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update profile
  const handleProfileUpdate = useCallback(async (updates: Partial<ClientProfile>) => {
    try {
      const response = await fetch('/api/clients/me', {
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
      console.error('Error updating profile:', err);
      showNotificationRef.current?.('Failed to update profile', 'error');
      return false;
    }
  }, [buildHeaders]);

  // Update billing
  const handleBillingUpdate = useCallback(async (updates: BillingAddress) => {
    try {
      const response = await fetch('/api/clients/me/billing', {
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
      console.error('Error updating billing:', err);
      showNotificationRef.current?.('Failed to update billing address', 'error');
      return false;
    }
  }, [buildHeaders]);

  // Update notifications
  const handleNotificationsUpdate = useCallback(async (updates: NotificationPreferences) => {
    try {
      const response = await fetch('/api/clients/me', {
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
      console.error('Error updating notifications:', err);
      showNotificationRef.current?.('Failed to update notification preferences', 'error');
      return false;
    }
  }, [buildHeaders]);

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-state">
        <span className="loading-spinner"></span>
        <span>Loading settings...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button className="btn-secondary" onClick={fetchProfile}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="settings-section">
      {/* Tabs */}
      <div className="portal-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={isActive ? 'active' : ''}
            >
              <Icon />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="portal-tab-panel active">
        {activeTab === 'profile' && profile && (
          <ProfileForm
            profile={profile}
            onUpdate={handleProfileUpdate}
          />
        )}

        {activeTab === 'billing' && (
          <BillingForm
            billing={billing}
            onUpdate={handleBillingUpdate}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsForm
            preferences={notifications}
            onUpdate={handleNotificationsUpdate}
          />
        )}
      </div>
    </div>
  );
}
