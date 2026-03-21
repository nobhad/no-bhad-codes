/**
 * Shared types for useProjectDetail sub-hooks
 */

import type {
  Project,
  ProjectMilestone,
  ProjectFile,
  Invoice,
  Message,
  MessageReaction
} from '@react/features/admin/types';
import type { ProjectTaskResponse } from '@/types/api';

/** Auth token getter function signature */
export type AuthTokenGetter = (() => string | null) | undefined;

/** Options passed to all project-detail sub-hooks */
export interface ProjectDetailHookOptions {
  projectId: number;
  getAuthToken?: () => string | null;
}

/** Options for the top-level useProjectDetail hook */
export interface UseProjectDetailOptions extends ProjectDetailHookOptions {
  /** Whether to fetch immediately on mount */
  autoFetch?: boolean;
}

/** Aggregate data shape for the project detail */
export interface ProjectDetailData {
  project: Project | null;
  milestones: ProjectMilestone[];
  tasks: ProjectTaskResponse[];
  files: ProjectFile[];
  invoices: Invoice[];
  messages: Message[];
}

/** Full return type of useProjectDetail */
export interface UseProjectDetailReturn {
  /** Project data */
  project: Project | null;
  /** Project milestones */
  milestones: ProjectMilestone[];
  /** Project tasks (linked to milestones) */
  tasks: ProjectTaskResponse[];
  /** Project files */
  files: ProjectFile[];
  /** Project invoices */
  invoices: Invoice[];
  /** Project messages */
  messages: Message[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Computed progress percentage */
  progress: number;
  /** Outstanding balance */
  outstandingBalance: number;
  /** Total paid amount */
  totalPaid: number;
  /** Refetch all data */
  refetch: () => Promise<void>;
  /** Update project */
  updateProject: (updates: Partial<Project>) => Promise<boolean>;
  /** Add milestone */
  addMilestone: (milestone: Omit<ProjectMilestone, 'id' | 'project_id'>) => Promise<boolean>;
  /** Update milestone */
  updateMilestone: (id: number, updates: Partial<ProjectMilestone>) => Promise<boolean>;
  /** Delete milestone */
  deleteMilestone: (id: number) => Promise<boolean>;
  /** Toggle milestone completion */
  toggleMilestoneComplete: (id: number) => Promise<boolean>;
  /** Toggle individual deliverable completion */
  toggleDeliverable: (milestoneId: number, deliverableIndex: number) => Promise<boolean>;
  /** Toggle task completion status */
  toggleTaskComplete: (taskId: number) => Promise<boolean>;
  /** Assign a task to a milestone */
  assignTaskToMilestone: (taskId: number, milestoneId: number) => Promise<boolean>;
  /** Upload file */
  uploadFile: (file: File, category?: string) => Promise<boolean>;
  /** Delete file */
  deleteFile: (id: number) => Promise<boolean>;
  /** Toggle file sharing */
  toggleFileSharing: (id: number) => Promise<boolean>;
  /** Update file category */
  updateCategory: (id: number, category: string) => Promise<boolean>;
  /** Send invoice */
  sendInvoice: (id: number) => Promise<boolean>;
  /** Mark invoice as paid */
  markAsPaid: (id: number) => Promise<boolean>;
  /** Delete invoice */
  deleteInvoice: (id: number) => Promise<boolean>;
  /** Download invoice PDF */
  downloadPdf: (id: number) => Promise<void>;
  /** Load messages */
  loadMessages: () => Promise<void>;
  /** Send message */
  sendMessage: (content: string) => Promise<boolean>;
  /** Edit message */
  editMessage: (messageId: number, content: string) => Promise<boolean>;
  /** Reaction groups keyed by message ID */
  reactions: Record<number, MessageReaction[]>;
  /** Toggle emoji reaction on a message */
  toggleReaction: (messageId: number, emoji: string) => Promise<boolean>;
}
