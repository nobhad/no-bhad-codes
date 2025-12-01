/**
 * ===============================================
 * VALIDATION MIDDLEWARE TESTS
 * ===============================================
 * @file tests/unit/middleware/validation.test.ts
 *
 * Unit tests for the API validation middleware.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  ApiValidator,
  validateRequest,
  ValidationSchemas
} from '../../../server/middleware/validation.js';

// Mock logger
vi.mock('../../../server/services/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    logSecurity: vi.fn()
  }
}));

describe('ApiValidator', () => {
  let validator: ApiValidator;

  beforeEach(() => {
    validator = ApiValidator.getInstance();
  });

  describe('Basic Validation', () => {
    it('should validate required fields successfully', () => {
      const schema = {
        name: { type: 'required' as const },
        email: { type: 'required' as const }
      };

      const validData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const result = validator.validate(validData, schema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedData).toEqual(validData);
    });

    it('should fail validation for missing required fields', () => {
      const schema = {
        name: { type: 'required' as const },
        email: { type: 'required' as const }
      };

      const invalidData = {
        name: 'John Doe'
        // email missing
      };

      const result = validator.validate(invalidData, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('email');
      expect(result.errors[0].code).toBe('REQUIRED');
      expect(result.sanitizedData).toBeUndefined();
    });
  });

  describe('String Validation', () => {
    it('should validate string length constraints', () => {
      const schema = {
        name: { type: 'string' as const, minLength: 2, maxLength: 50 }
      };

      // Valid string
      let result = validator.validate({ name: 'John Doe' }, schema);
      expect(result.isValid).toBe(true);

      // Too short
      result = validator.validate({ name: 'J' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MIN_LENGTH');

      // Too long
      result = validator.validate({ name: 'A'.repeat(51) }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MAX_LENGTH');
    });

    it('should validate string patterns', () => {
      const schema = {
        username: {
          type: 'string' as const,
          pattern: /^[a-zA-Z0-9_]+$/
        }
      };

      // Valid username
      let result = validator.validate({ username: 'john_doe123' }, schema);
      expect(result.isValid).toBe(true);

      // Invalid username with spaces
      result = validator.validate({ username: 'john doe' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_PATTERN');
    });

    it('should validate allowed values', () => {
      const schema = {
        status: {
          type: 'string' as const,
          allowedValues: ['active', 'inactive', 'pending']
        }
      };

      // Valid value
      let result = validator.validate({ status: 'active' }, schema);
      expect(result.isValid).toBe(true);

      // Invalid value
      result = validator.validate({ status: 'unknown' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_VALUE');
    });

    it('should sanitize HTML content', () => {
      const schema = {
        message: { type: 'string' as const }
      };

      const maliciousData = {
        message: '<script>alert("xss")</script>Hello world'
      };

      const result = validator.validate(maliciousData, schema);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.message).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;Hello world'
      );
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      const schema = {
        email: { type: 'email' as const }
      };

      const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'user+tag@example.org'];

      validEmails.forEach((email) => {
        const result = validator.validate({ email }, schema);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const schema = {
        email: { type: 'email' as const }
      };

      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain'
      ];

      invalidEmails.forEach((email) => {
        const result = validator.validate({ email }, schema);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_EMAIL');
      });
    });

    it('should convert email to lowercase', () => {
      const schema = {
        email: { type: 'email' as const }
      };

      const result = validator.validate({ email: 'TEST@EXAMPLE.COM' }, schema);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.email).toBe('test@example.com');
    });

    it('should detect disposable email domains', () => {
      const schema = {
        email: { type: 'email' as const }
      };

      const result = validator.validate({ email: 'test@10minutemail.com' }, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('DISPOSABLE_EMAIL');
    });
  });

  describe('Number Validation', () => {
    it('should validate number ranges', () => {
      const schema = {
        age: { type: 'number' as const, min: 18, max: 100 }
      };

      // Valid number
      let result = validator.validate({ age: 25 }, schema);
      expect(result.isValid).toBe(true);

      // Below minimum
      result = validator.validate({ age: 16 }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MIN_VALUE');

      // Above maximum
      result = validator.validate({ age: 150 }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MAX_VALUE');
    });

    it('should convert string numbers', () => {
      const schema = {
        count: { type: 'number' as const }
      };

      const result = validator.validate({ count: '42' }, schema);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.count).toBe(42);
    });

    it('should reject invalid numbers', () => {
      const schema = {
        value: { type: 'number' as const }
      };

      const result = validator.validate({ value: 'not-a-number' }, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_NUMBER');
    });
  });

  describe('Boolean Validation', () => {
    it('should validate boolean values', () => {
      const schema = {
        active: { type: 'boolean' as const }
      };

      // Native boolean
      let result = validator.validate({ active: true }, schema);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.active).toBe(true);

      result = validator.validate({ active: false }, schema);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.active).toBe(false);
    });

    it('should convert string boolean representations', () => {
      const schema = {
        enabled: { type: 'boolean' as const }
      };

      const truthyValues = ['true', 'TRUE', '1'];
      const falsyValues = ['false', 'FALSE', '0'];

      truthyValues.forEach((value) => {
        const result = validator.validate({ enabled: value }, schema);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedData.enabled).toBe(true);
      });

      falsyValues.forEach((value) => {
        const result = validator.validate({ enabled: value }, schema);
        expect(result.isValid).toBe(true);
        expect(result.sanitizedData.enabled).toBe(false);
      });
    });

    it('should reject invalid boolean values', () => {
      const schema = {
        flag: { type: 'boolean' as const }
      };

      const result = validator.validate({ flag: 'maybe' }, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_BOOLEAN');
    });
  });

  describe('Array Validation', () => {
    it('should validate array length constraints', () => {
      const schema = {
        tags: { type: 'array' as const, minLength: 1, maxLength: 5 }
      };

      // Valid array
      let result = validator.validate({ tags: ['tag1', 'tag2'] }, schema);
      expect(result.isValid).toBe(true);

      // Too short
      result = validator.validate({ tags: [] }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MIN_ARRAY_LENGTH');

      // Too long
      result = validator.validate({ tags: ['1', '2', '3', '4', '5', '6'] }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MAX_ARRAY_LENGTH');
    });

    it('should reject non-array values', () => {
      const schema = {
        items: { type: 'array' as const }
      };

      const result = validator.validate({ items: 'not-an-array' }, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_ARRAY');
    });
  });

  describe('Custom Validation', () => {
    it('should apply custom validators', () => {
      const schema = {
        password: {
          type: 'custom' as const,
          customValidator: (value: string) => {
            return (
              (value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value)) ||
              'Password must be at least 8 characters with uppercase and number'
            );
          }
        }
      };

      // Valid password
      let result = validator.validate({ password: 'StrongPass123' }, schema);
      expect(result.isValid).toBe(true);

      // Invalid password
      result = validator.validate({ password: 'weak' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Password must be at least 8 characters');
    });

    it('should apply custom sanitizers', () => {
      const schema = {
        username: {
          type: 'custom' as const,
          customValidator: () => true,
          customSanitizer: (value: string) => value.toLowerCase().trim()
        }
      };

      const result = validator.validate({ username: '  JOHN_DOE  ' }, schema);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.username).toBe('john_doe');
    });
  });

  describe('Multiple Rules', () => {
    it('should apply multiple validation rules to the same field', () => {
      const schema = {
        email: [{ type: 'required' as const }, { type: 'email' as const }]
      };

      // Missing field
      let result = validator.validate({}, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('REQUIRED');

      // Invalid email format
      result = validator.validate({ email: 'invalid' }, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_EMAIL');

      // Valid
      result = validator.validate({ email: 'test@example.com' }, schema);
      expect(result.isValid).toBe(true);
    });
  });
});

describe('validateRequest Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      headers: {},
      ip: '127.0.0.1',
      path: '/test',
      method: 'POST'
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    mockNext = vi.fn() as unknown as NextFunction;
  });

  it('should validate request body and call next on success', async () => {
    const schema = {
      name: { type: 'required' as const },
      email: { type: 'email' as const }
    };

    mockReq.body = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    const middleware = validateRequest(schema);
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 400 error on validation failure', async () => {
    const schema = {
      name: { type: 'required' as const },
      email: { type: 'email' as const }
    };

    mockReq.body = {
      email: 'invalid-email'
      // name missing
    };

    const middleware = validateRequest(schema);
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      })
    );
  });

  it('should validate query parameters when enabled', async () => {
    const schema = {
      page: { type: 'number' as const, min: 1 }
    };

    mockReq.query = { page: '5' };

    const middleware = validateRequest(schema, { validateQuery: true, validateBody: false });
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.query.page).toBe(5); // Should be converted to number
  });

  it('should strip unknown fields when enabled', async () => {
    const schema = {
      name: { type: 'string' as const }
    };

    mockReq.body = {
      name: 'John Doe',
      unwantedField: 'should be removed'
    };

    const middleware = validateRequest(schema, { stripUnknownFields: true });
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.body).toEqual({ name: 'John Doe' });
    expect(mockReq.body.unwantedField).toBeUndefined();
  });
});

describe('ValidationSchemas', () => {
  let validator: ApiValidator;

  beforeEach(() => {
    validator = ApiValidator.getInstance();
  });

  describe('Contact Schema', () => {
    it('should validate complete contact form data', () => {
      const contactData = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Website Inquiry',
        message: 'I would like to know more about your services and how we can work together.'
      };

      const result = validator.validate(contactData, ValidationSchemas.contact);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect spam in contact messages', () => {
      const spamData = {
        name: 'Spammer',
        email: 'spam@example.com',
        message: 'BUY NOW! CLICK HERE for URGENT limited time offer!'
      };

      const result = validator.validate(spamData, ValidationSchemas.contact);

      expect(result.isValid).toBe(false);
      // Check that there's at least one error for the message field with spam in the message
      const messageError = result.errors.find(
        (e) => e.field === 'message' && e.message.toLowerCase().includes('spam')
      );
      expect(messageError).toBeDefined();
    });
  });

  describe('Client Intake Schema', () => {
    it('should validate complete intake form data', () => {
      const intakeData = {
        name: 'Jane Smith',
        email: 'jane@company.com',
        companyName: 'Smith Industries',
        projectType: 'business-site',
        budgetRange: '5k-10k',
        timeline: '1-3-months',
        description:
          'We need a professional business website to showcase our services and attract new customers.',
        features: ['contact-form', 'analytics', 'cms']
      };

      const result = validator.validate(intakeData, ValidationSchemas.clientIntake);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate project type constraints', () => {
      const invalidData = {
        name: 'Test User',
        email: 'test@example.com',
        projectType: 'invalid-type', // Not in allowed values
        budgetRange: '2k-5k',
        timeline: '1-3-months',
        description: 'Test description that meets minimum length requirements.'
      };

      const result = validator.validate(invalidData, ValidationSchemas.clientIntake);

      expect(result.isValid).toBe(false);
      // Check for error on projectType field with INVALID_VALUE code
      const projectTypeError = result.errors.find(
        (e) => e.field === 'projectType' && e.code === 'INVALID_VALUE'
      );
      expect(projectTypeError).toBeDefined();
    });
  });

  describe('User Schema', () => {
    it('should validate strong passwords', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'StrongPass123!'
      };

      const result = validator.validate(userData, ValidationSchemas.user);

      expect(result.isValid).toBe(true);
    });

    it('should reject weak passwords', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'weak'
      };

      const result = validator.validate(userData, ValidationSchemas.user);

      expect(result.isValid).toBe(false);
      // Check that there's at least one error for the password field
      const passwordError = result.errors.find((e) => e.field === 'password');
      expect(passwordError).toBeDefined();
    });
  });
});
