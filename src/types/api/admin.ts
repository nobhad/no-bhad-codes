/**
 * ===============================================
 * API TYPES — ADMIN
 * ===============================================
 */

// ============================================
// Admin Dashboard API Types
// ============================================

/**
 * Sidebar counts response
 */
export interface SidebarCountsResponse {
  success: boolean;
  leads: number;
  messages: number;
}

/**
 * System health response
 */
export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceHealth>;
  uptime: number;
  version: string;
}

/**
 * Individual service health
 */
export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  message?: string;
  lastCheck?: string;
}
