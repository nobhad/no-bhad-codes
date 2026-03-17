/**
 * ===============================================
 * ONBOARDING CHECKLIST TYPES
 * ===============================================
 * @file src/react/features/portal/onboarding-checklist/types.ts
 */

export interface OnboardingStep {
  id: number;
  checklistId: number;
  stepType: string;
  label: string;
  description: string | null;
  stepOrder: number;
  status: 'pending' | 'completed';
  entityType: string | null;
  entityId: number | null;
  autoDetect: boolean;
  navigateTab: string | null;
  navigateEntityId: number | null;
  completedAt: string | null;
}

export interface OnboardingChecklist {
  id: number;
  projectId: number;
  clientId: number;
  status: 'active' | 'completed' | 'dismissed';
  welcomeText: string | null;
  createdAt: string;
  completedAt: string | null;
  steps: OnboardingStep[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
}

export interface OnboardingCardProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}
