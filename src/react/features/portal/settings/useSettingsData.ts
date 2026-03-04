/**
 * useSettingsData Hook
 * Encapsulates all state and API logic for portal settings:
 * profile fetching/updating, billing updates, notification preferences,
 * tab management, and EJS subtab event listening.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { createLogger } from '../../../../utils/logger';
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
  buildHeaders: () => Record<string, string>;
  fetchProfile: () => Promise<void>;
  handleProfileUpdate: (updates: Partial<ClientProfile>) => Promise<boolean>;
  handleBillingUpdate: (updates: BillingAddress) => Promise<boolean>;
  handleNotificationsUpdate: (updates: NotificationPreferences) => Promise<boolean>;
}

/**
 * Builds request headers, optionally including an auth Bearer token.
 */
const createBuildHeaders = (
  getAuthTokenRef: React.RefObject<(() => string | null) | undefined>
) => (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = getAuthTokenRef.current?.();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

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

  // Stable refs for callback props to avoid dependency churn
  const getAuthTokenRef = useRef(getAuthToken);
  const showNotificationRef = useRef(showNotification);

  useEffect(() => {
    getAuthTokenRef.current = getAuthToken;
    showNotificationRef.current = showNotification;
  }, [getAuthToken, showNotification]);

  const buildHeaders = useCallback(createBuildHeaders(getAuthTokenRef), []);

  // --- Fetch profile data ---
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
  }, [buildHeaders]);

  // Initial fetch on mount
  useEffect(() => {
    fetchProfile();
  }, []);

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

  const handleBillingUpdate = useCallback(async (updates: BillingAddress): Promise<boolean> => {
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

  const handleNotificationsUpdate = useCallback(async (updates: NotificationPreferences): Promise<boolean> => {
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

  return {
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
  };
}
