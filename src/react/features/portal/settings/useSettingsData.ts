/**
 * useSettingsData Hook
 * Encapsulates all state and API logic for portal settings:
 * profile fetching/updating, billing updates, notification preferences,
 * tab management, and EJS subtab event listening.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { unwrapApiData, apiFetch } from '@/utils/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { createLogger } from '@/utils/logger';
import { usePortalFetch } from '@react/hooks/usePortalFetch';
import type {
  ClientProfile,
  BillingAddress,
  NotificationPreferences,
  SettingsTab
} from './PortalSettings';

const logger = createLogger('useSettingsData');

const SUBTAB_EVENT = 'settingsSubtabChange';
const VALID_TABS: readonly SettingsTab[] = ['profile', 'billing', 'notifications'] as const;

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email_invoices: true,
  email_project_updates: true,
  email_messages: true,
  email_marketing: false
};

interface UseSettingsDataOptions {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface UseSettingsDataReturn {
  activeTab: SettingsTab;
  isLoading: boolean;
  error: string | null;
  profile: ClientProfile | null;
  billing: BillingAddress;
  notifications: NotificationPreferences;
  portalFetch: <T>(url: string, options?: { method?: string; body?: unknown; headers?: Record<string, string>; unwrap?: boolean }) => Promise<T>;
  fetchProfile: () => Promise<void>;
  handleProfileUpdate: (updates: Partial<ClientProfile>) => Promise<boolean>;
  handleBillingUpdate: (updates: BillingAddress) => Promise<boolean>;
  handleNotificationsUpdate: (updates: NotificationPreferences) => Promise<boolean>;
}

/**
 * Checks whether a string is a valid settings tab.
 */
const isValidTab = (value: string): value is SettingsTab =>
  (VALID_TABS as readonly string[]).includes(value);

export function useSettingsData(options: UseSettingsDataOptions = {}): UseSettingsDataReturn {
  const { getAuthToken, showNotification } = options;

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [billing, setBilling] = useState<BillingAddress>({});
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);

  const { portalFetch } = usePortalFetch({ getAuthToken });

  // Stable ref for showNotification to avoid dependency churn
  const showNotificationRef = useRef(showNotification);

  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);

  // --- Fetch profile data ---
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch(API_ENDPOINTS.CLIENTS_ME);

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      const rawClient = (payload.client || payload) as Record<string, unknown>;
      setProfile(rawClient as unknown as ClientProfile);

      // Billing address
      const billingData = (rawClient.billing_address || payload.billing_address) as BillingAddress | undefined;
      if (billingData) {
        setBilling(billingData);
      }

      // Notification preferences
      const notifPrefs = (rawClient.notification_preferences || payload.notification_preferences) as NotificationPreferences | undefined;
      if (notifPrefs) {
        setNotifications(prev => ({ ...prev, ...notifPrefs }));
      }
    } catch (err) {
      logger.error('Error fetching profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Listen for EJS subtab changes
  useEffect(() => {
    const handler = (e: Event) => {
      const subtab = (e as CustomEvent).detail?.subtab;
      if (typeof subtab === 'string' && isValidTab(subtab)) {
        setActiveTab(subtab);
      }
    };
    window.addEventListener(SUBTAB_EVENT, handler);
    return () => window.removeEventListener(SUBTAB_EVENT, handler);
  }, []);

  // --- Update handlers ---
  const handleProfileUpdate = useCallback(async (updates: Partial<ClientProfile>): Promise<boolean> => {
    try {
      await portalFetch(API_ENDPOINTS.CLIENTS_ME, { method: 'PUT', body: updates });
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      showNotificationRef.current?.('Profile updated', 'success');
      return true;
    } catch (err) {
      logger.error('Error updating profile:', err);
      showNotificationRef.current?.('Failed to update profile', 'error');
      return false;
    }
  }, [portalFetch]);

  const handleBillingUpdate = useCallback(async (updates: BillingAddress): Promise<boolean> => {
    try {
      await portalFetch(API_ENDPOINTS.CLIENTS_ME_BILLING, { method: 'PUT', body: updates });
      setBilling(updates);
      showNotificationRef.current?.('Billing address updated', 'success');
      return true;
    } catch (err) {
      logger.error('Error updating billing:', err);
      showNotificationRef.current?.('Failed to update billing address', 'error');
      return false;
    }
  }, [portalFetch]);

  const handleNotificationsUpdate = useCallback(async (updates: NotificationPreferences): Promise<boolean> => {
    try {
      await portalFetch(API_ENDPOINTS.CLIENTS_ME, { method: 'PUT', body: { notification_preferences: updates } });
      setNotifications(updates);
      showNotificationRef.current?.('Notification preferences updated', 'success');
      return true;
    } catch (err) {
      logger.error('Error updating notifications:', err);
      showNotificationRef.current?.('Failed to update notification preferences', 'error');
      return false;
    }
  }, [portalFetch]);

  return {
    activeTab,
    isLoading,
    error,
    profile,
    billing,
    notifications,
    portalFetch,
    fetchProfile,
    handleProfileUpdate,
    handleBillingUpdate,
    handleNotificationsUpdate
  };
}
