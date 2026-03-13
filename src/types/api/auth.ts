/**
 * ===============================================
 * API TYPES — AUTH
 * ===============================================
 */

// ============================================
// Authentication API Types
// ============================================

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Admin login request payload
 */
export interface AdminLoginRequest {
  password: string;
}

/**
 * Login response data
 */
export interface LoginResponse {
  message: string;
  user: AuthUserResponse;
  expiresIn: string;
}

/**
 * User data returned from authentication
 */
export interface AuthUserResponse {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
  status: string;
  role?: 'admin' | 'client';
}

/**
 * Magic link request payload
 */
export interface MagicLinkRequest {
  email: string;
}

/**
 * Magic link verification payload
 */
export interface MagicLinkVerifyRequest {
  token: string;
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
  success: boolean;
  expiresIn?: string;
}
