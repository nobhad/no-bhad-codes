/**
 * ===============================================
 * ENVIRONMENT CONFIGURATION SERVICE
 * ===============================================
 * @file server/config/environment.ts
 *
 * Validates environment variables and provides
 * typed configuration access throughout the app.
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

/**
 * Configuration schema type definitions
 */
interface ConfigSchemaItem {
  required?: boolean;
  default?: any;
  type?: 'boolean' | 'number' | 'email' | 'url';
  values?: readonly string[];
  minLength?: number;
  min?: number;
  max?: number;
}

interface ConfigSchema {
  [key: string]: ConfigSchemaItem;
}

/**
 * Application configuration interface
 */
export interface AppConfig {
  // Application settings
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  FRONTEND_URL: string;
  API_BASE_URL: string;

  // Database
  DATABASE_PATH: string;
  DATABASE_BACKUP_PATH: string;
  DATABASE_ENABLE_WAL: boolean;
  DATABASE_BUSY_TIMEOUT: number;

  // Authentication
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_TOKEN_SECRET: string;
  REFRESH_TOKEN_EXPIRES_IN: string;
  BCRYPT_ROUNDS: number;
  SESSION_SECRET: string;

  // Admin
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;

  // Business Info (for invoices, PDFs, emails)
  BUSINESS_NAME: string;
  BUSINESS_OWNER: string;
  BUSINESS_CONTACT: string;
  BUSINESS_TAGLINE: string;
  BUSINESS_EMAIL: string;
  BUSINESS_WEBSITE: string;
  VENMO_HANDLE: string;
  ZELLE_EMAIL: string;
  PAYPAL_EMAIL: string;

  // Email
  EMAIL_ENABLED: boolean;
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  FROM_EMAIL?: string;
  ADMIN_NOTIFICATION_EMAIL?: string;

  // File uploads
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_TYPES: string;
  UPLOAD_DIR: string;
  TEMP_DIR: string;

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  RATE_LIMIT_LOGIN_MAX: number;
  RATE_LIMIT_CONTACT_MAX: number;

  // Feature flags
  ENABLE_REGISTRATION: boolean;
  ENABLE_PASSWORD_RESET: boolean;
  ENABLE_EMAIL_VERIFICATION: boolean;
  ENABLE_2FA: boolean;
  ENABLE_API_DOCS: boolean;
  MAINTENANCE_MODE: boolean;

  // Logging
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  LOG_FILE: string;
  LOG_MAX_SIZE: string;
  LOG_MAX_FILES: string;
  LOG_ERROR_FILE: string;

  // CORS
  CORS_ORIGIN: string;
  CORS_CREDENTIALS: boolean;
  CORS_METHODS: string;
  CORS_HEADERS: string;

  // Development
  DEV_AUTO_LOGIN: boolean;
  DEV_MOCK_DATA: boolean;
  DEV_VERBOSE_LOGGING: boolean;
  DEV_HOT_RELOAD: boolean;

  // Production
  FORCE_SSL: boolean;
  TRUST_PROXY: boolean;
  HELMET_ENABLED: boolean;
  CLUSTER_WORKERS: string;

  // OpenTelemetry
  OTEL_ENABLED: boolean;
  OTEL_SERVICE_NAME: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_DEBUG: boolean;
}

/**
 * Configuration validation schema
 */
const configSchema: ConfigSchema = {
  // Application settings
  NODE_ENV: {
    required: true,
    default: 'development',
    values: ['development', 'production', 'test'],
  },
  PORT: { required: true, default: 4001, type: 'number' },
  FRONTEND_URL: { required: true, default: 'http://localhost:4000', type: 'url' },
  API_BASE_URL: { required: false, default: 'http://localhost:4001', type: 'url' },

  // Database
  DATABASE_PATH: { required: true, default: './data/client_portal.db' },
  DATABASE_BACKUP_PATH: { required: false, default: './data/backups' },
  DATABASE_ENABLE_WAL: { required: false, default: true, type: 'boolean' },
  DATABASE_BUSY_TIMEOUT: { required: false, default: 5000, type: 'number' },

  // Authentication
  JWT_SECRET: { required: true, minLength: 32 },
  JWT_EXPIRES_IN: { required: false, default: '7d' },
  REFRESH_TOKEN_SECRET: { required: false, minLength: 32 },
  REFRESH_TOKEN_EXPIRES_IN: { required: false, default: '30d' },
  BCRYPT_ROUNDS: { required: false, default: 10, type: 'number', min: 8, max: 15 },
  SESSION_SECRET: { required: false, minLength: 32 },

  // Admin
  ADMIN_EMAIL: { required: true, type: 'email' },
  ADMIN_PASSWORD: { required: true, minLength: 8 },

  // Business Info (for invoices, PDFs, emails) - MUST be set in .env
  // No hardcoded defaults - these must come from environment
  BUSINESS_NAME: { required: true },
  BUSINESS_OWNER: { required: false }, // Falls back to BUSINESS_CONTACT in business.ts
  BUSINESS_CONTACT: { required: false },
  BUSINESS_TAGLINE: { required: false },
  BUSINESS_EMAIL: { required: true, type: 'email' },
  BUSINESS_WEBSITE: { required: false },
  VENMO_HANDLE: { required: false },
  ZELLE_EMAIL: { required: false, type: 'email' },
  PAYPAL_EMAIL: { required: false, type: 'email' },

  // Email
  EMAIL_ENABLED: { required: false, default: false, type: 'boolean' },
  SMTP_HOST: { required: false },
  SMTP_PORT: { required: false, default: 587, type: 'number' },
  SMTP_SECURE: { required: false, default: false, type: 'boolean' },
  SMTP_USER: { required: false, type: 'email' },
  SMTP_PASS: { required: false },
  FROM_EMAIL: { required: false, type: 'email' },
  ADMIN_NOTIFICATION_EMAIL: { required: false, type: 'email' },

  // File uploads
  MAX_FILE_SIZE: { required: false, default: 10485760, type: 'number' },
  ALLOWED_FILE_TYPES: { required: false, default: 'jpeg,jpg,png,pdf,doc,docx,txt,zip,rar' },
  UPLOAD_DIR: { required: false, default: './uploads' },
  TEMP_DIR: { required: false, default: './temp' },

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: { required: false, default: 900000, type: 'number' },
  RATE_LIMIT_MAX_REQUESTS: { required: false, default: 100, type: 'number' },
  RATE_LIMIT_LOGIN_MAX: { required: false, default: 5, type: 'number' },
  RATE_LIMIT_CONTACT_MAX: { required: false, default: 3, type: 'number' },

  // Feature flags
  ENABLE_REGISTRATION: { required: false, default: true, type: 'boolean' },
  ENABLE_PASSWORD_RESET: { required: false, default: true, type: 'boolean' },
  ENABLE_EMAIL_VERIFICATION: { required: false, default: false, type: 'boolean' },
  ENABLE_2FA: { required: false, default: false, type: 'boolean' },
  ENABLE_API_DOCS: { required: false, default: true, type: 'boolean' },
  MAINTENANCE_MODE: { required: false, default: false, type: 'boolean' },

  // Logging
  LOG_LEVEL: { required: false, default: 'info', values: ['error', 'warn', 'info', 'debug'] },
  LOG_FILE: { required: false, default: './logs/app.log' },
  LOG_MAX_SIZE: { required: false, default: '10m' },
  LOG_MAX_FILES: { required: false, default: '14d' },
  LOG_ERROR_FILE: { required: false, default: './logs/error.log' },

  // CORS
  CORS_ORIGIN: { required: false, default: 'http://localhost:3000' },
  CORS_CREDENTIALS: { required: false, default: true, type: 'boolean' },
  CORS_METHODS: { required: false, default: 'GET,POST,PUT,DELETE,OPTIONS' },
  CORS_HEADERS: { required: false, default: 'Content-Type,Authorization,X-Requested-With' },

  // Development
  DEV_AUTO_LOGIN: { required: false, default: false, type: 'boolean' },
  DEV_MOCK_DATA: { required: false, default: false, type: 'boolean' },
  DEV_VERBOSE_LOGGING: { required: false, default: true, type: 'boolean' },
  DEV_HOT_RELOAD: { required: false, default: true, type: 'boolean' },

  // Production
  FORCE_SSL: { required: false, default: false, type: 'boolean' },
  TRUST_PROXY: { required: false, default: false, type: 'boolean' },
  HELMET_ENABLED: { required: false, default: true, type: 'boolean' },
  CLUSTER_WORKERS: { required: false, default: 'auto' },

  // OpenTelemetry
  OTEL_ENABLED: { required: false, default: true, type: 'boolean' },
  OTEL_SERVICE_NAME: { required: false, default: 'client-portal' },
  OTEL_EXPORTER_OTLP_ENDPOINT: { required: false },
  OTEL_DEBUG: { required: false, default: false, type: 'boolean' },
};

/**
 * Validation errors collection
 */
const validationErrors: string[] = [];

/**
 * Validated configuration object
 */
const config: Partial<AppConfig> = {};

/**
 * Type conversion and validation functions
 */
const validators: Record<string, (value: any) => any> = {
  boolean: (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    throw new Error('Invalid boolean value');
  },

  number: (value) => {
    const num = Number(value);
    if (isNaN(num)) throw new Error('Invalid number value');
    return num;
  },

  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) throw new Error('Invalid email format');
    return value;
  },

  url: (value) => {
    try {
      new URL(value);
      return value;
    } catch {
      throw new Error('Invalid URL format');
    }
  },
};

/**
 * Validate a single configuration value
 */
function validateConfigValue(key: string, schema: ConfigSchemaItem): void {
  const envValue = process.env[key];
  const { required, default: defaultValue, type, values, minLength, min, max } = schema;

  // Handle missing values
  if (!envValue || envValue.trim() === '') {
    if (required && defaultValue === undefined) {
      validationErrors.push(`Missing required environment variable: ${key}`);
      return;
    }

    // Use default value if provided
    if (defaultValue !== undefined) {
      (config as any)[key] = defaultValue;
      return;
    }

    // Optional value with no default
    return;
  }

  let value = envValue.trim();

  try {
    // Type conversion
    if (type && validators[type]) {
      value = validators[type](value);
    }

    // Value validation
    if (values && !values.includes(value)) {
      throw new Error(`Value must be one of: ${values.join(', ')}`);
    }

    // String length validation
    if (minLength && typeof value === 'string' && value.length < minLength) {
      throw new Error(`Minimum length is ${minLength} characters`);
    }

    // Number range validation
    if (typeof value === 'number') {
      if (min !== undefined && value < min) {
        throw new Error(`Minimum value is ${min}`);
      }
      if (max !== undefined && value > max) {
        throw new Error(`Maximum value is ${max}`);
      }
    }

    (config as any)[key] = value;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    validationErrors.push(`Invalid ${key}: ${errorMessage}`);
  }
}

/**
 * Validate all configuration values
 */
function validateConfig(): void {
  validationErrors.length = 0;

  for (const [key, schema] of Object.entries(configSchema)) {
    validateConfigValue(key, schema);
  }

  if (validationErrors.length > 0) {
    console.error('❌ Environment Configuration Errors:');
    validationErrors.forEach((error) => console.error(`   ${error}`));
    console.error('\n💡 Please check your .env file and ensure all required variables are set.');
    console.error('📄 See .env.example for reference configuration.');

    if (config.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing with partial configuration in development mode...\n');
    }
  }
}

/**
 * Generate automatic configuration based on environment
 */
function generateDerivedConfig(): void {
  // Auto-generate secrets in development if not provided
  // Use crypto.randomBytes for cryptographically secure random generation
  if ((config as any).NODE_ENV === 'development') {
    if (!(config as any).JWT_SECRET || (config as any).JWT_SECRET.includes('change-this')) {
      (config as any).JWT_SECRET = `dev-jwt-secret-${crypto.randomBytes(32).toString('hex')}`;
      console.warn('⚠️  Using auto-generated JWT_SECRET for development');
    }

    if (
      !(config as any).REFRESH_TOKEN_SECRET ||
      (config as any).REFRESH_TOKEN_SECRET.includes('change-this')
    ) {
      (config as any).REFRESH_TOKEN_SECRET =
        `dev-refresh-secret-${crypto.randomBytes(32).toString('hex')}`;
    }

    if (!(config as any).SESSION_SECRET || (config as any).SESSION_SECRET.includes('change-this')) {
      (config as any).SESSION_SECRET =
        `dev-session-secret-${crypto.randomBytes(32).toString('hex')}`;
    }
  }

  // Derive API base URL from port if not set
  if (!(config as any).API_BASE_URL && (config as any).NODE_ENV === 'development') {
    (config as any).API_BASE_URL = `http://localhost:${(config as any).PORT}`;
  }

  // Email validation - require email config if enabled
  if ((config as any).EMAIL_ENABLED) {
    const emailRequiredFields = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL'];
    const missingEmailFields = emailRequiredFields.filter((field) => !(config as any)[field]);

    if (missingEmailFields.length > 0) {
      console.warn(`⚠️  EMAIL_ENABLED is true but missing: ${missingEmailFields.join(', ')}`);
      console.warn('   Email functionality will be disabled.');
      (config as any).EMAIL_ENABLED = false;
    }
  }

  // Ensure directories exist
  const directories = [
    (config as any).UPLOAD_DIR,
    (config as any).TEMP_DIR,
    (config as any).DATABASE_PATH ? path.dirname((config as any).DATABASE_PATH) : undefined,
    (config as any).DATABASE_BACKUP_PATH,
    (config as any).LOG_FILE ? path.dirname((config as any).LOG_FILE) : undefined,
    (config as any).LOG_ERROR_FILE ? path.dirname((config as any).LOG_ERROR_FILE) : undefined,
  ].filter(Boolean) as string[];

  directories.forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Could not create directory ${dir}: ${errorMessage}`);
    }
  });
}

/**
 * Get configuration summary for logging
 */
function getConfigSummary(): object {
  const summary = {
    environment: (config as any).NODE_ENV,
    port: (config as any).PORT,
    database: (config as any).DATABASE_PATH,
    emailEnabled: (config as any).EMAIL_ENABLED,
    features: {
      registration: (config as any).ENABLE_REGISTRATION,
      passwordReset: (config as any).ENABLE_PASSWORD_RESET,
      emailVerification: (config as any).ENABLE_EMAIL_VERIFICATION,
      twoFactor: (config as any).ENABLE_2FA,
      apiDocs: (config as any).ENABLE_API_DOCS,
    },
    maintenanceMode: (config as any).MAINTENANCE_MODE,
  };

  return summary;
}

/**
 * Initialize configuration
 */
function initializeConfig(): AppConfig {
  console.log('🔧 Initializing environment configuration...');

  validateConfig();
  generateDerivedConfig();

  const summary = getConfigSummary();
  console.log('✅ Configuration loaded:', JSON.stringify(summary, null, 2));

  return config as AppConfig;
}

// Initialize configuration immediately
const finalConfig = initializeConfig();

// Export configuration object
export default finalConfig as AppConfig;

// Export validation function for testing
export { validateConfig, getConfigSummary };
