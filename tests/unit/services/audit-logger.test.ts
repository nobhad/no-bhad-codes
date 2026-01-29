/**
 * ===============================================
 * AUDIT LOGGER SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/audit-logger.test.ts
 *
 * Unit tests for audit logger service.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request } from 'express';
import { auditLogger } from '../../../server/services/audit-logger';
import { getDatabase } from '../../../server/database/init';

// Mock database
const mockDb = {
  run: vi.fn().mockResolvedValue({ lastID: 1 }),
  all: vi.fn().mockResolvedValue([]),
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

// Mock console methods
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Audit Logger Service', () => {
  let mockReq: Partial<Request>;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'POST',
      get: vi.fn().mockReturnValue('test-agent'),
      socket: { remoteAddress: '127.0.0.1' },
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  describe('logCreate', () => {
    it('should log a create action', async () => {
      const result = await auditLogger.logCreate('client', '123', 'Test Client', { name: 'Test' }, mockReq as Request);

      expect(result).toBe(true);
      expect(mockDb.run).toHaveBeenCalled();
      const callArgs = mockDb.run.mock.calls[0];
      expect(callArgs[0]).toContain('INSERT INTO audit_logs');
      expect(callArgs[1][3]).toBe('create'); // action is at index 3
      expect(callArgs[1][4]).toBe('client'); // entity_type is at index 4
    });

    it('should include user context from request', async () => {
      (mockReq as any).user = { id: 1, email: 'user@example.com', role: 'admin' };
      
      await auditLogger.logCreate('project', '456', 'Test Project', {}, mockReq as Request);

      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[0]).toBe(1); // userId
      expect(callArgs[1]).toBe('user@example.com'); // userEmail
      expect(callArgs[2]).toBe('admin'); // userType
    });

    it('should sanitize sensitive fields', async () => {
      const newValue = { name: 'Test', password: 'secret123', token: 'abc123' };
      await auditLogger.logCreate('client', '123', 'Test', newValue);

      const callArgs = mockDb.run.mock.calls[0][1];
      const newValueJson = JSON.parse(callArgs[8] as string); // new_value
      expect(newValueJson.password).toBe('[REDACTED]');
      expect(newValueJson.token).toBe('[REDACTED]');
    });
  });

  describe('logUpdate', () => {
    it('should log an update action', async () => {
      const oldValue = { name: 'Old Name' };
      const newValue = { name: 'New Name' };
      
      const result = await auditLogger.logUpdate('client', '123', 'Test Client', oldValue, newValue, mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('update'); // action is at index 3
    });

    it('should calculate changes between old and new values', async () => {
      const oldValue = { name: 'Old', status: 'active' };
      const newValue = { name: 'New', status: 'inactive' };
      
      await auditLogger.logUpdate('client', '123', 'Test', oldValue, newValue);

      const callArgs = mockDb.run.mock.calls[0][1];
      const changes = JSON.parse(callArgs[9] as string); // changes
      expect(changes.name).toEqual({ from: 'Old', to: 'New' });
      expect(changes.status).toEqual({ from: 'active', to: 'inactive' });
    });

    it('should redact sensitive fields in changes', async () => {
      const oldValue = { password: 'oldpass' };
      const newValue = { password: 'newpass' };
      
      await auditLogger.logUpdate('client', '123', 'Test', oldValue, newValue);

      const callArgs = mockDb.run.mock.calls[0][1];
      const changes = JSON.parse(callArgs[9] as string);
      expect(changes.password).toEqual({ from: '[REDACTED]', to: '[REDACTED]' });
    });
  });

  describe('logDelete', () => {
    it('should log a delete action', async () => {
      const oldValue = { name: 'Test Client' };
      const result = await auditLogger.logDelete('client', '123', 'Test Client', oldValue, mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('delete'); // action is at index 3
    });
  });

  describe('logLogin', () => {
    it('should log a successful login', async () => {
      const result = await auditLogger.logLogin(1, 'user@example.com', 'admin', mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('login'); // action is at index 3
      expect(callArgs[4]).toBe('session'); // entity_type is at index 4
    });
  });

  describe('logLoginFailed', () => {
    it('should log a failed login attempt', async () => {
      const result = await auditLogger.logLoginFailed('user@example.com', mockReq as Request, 'Invalid password');

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('login_failed'); // action is at index 3
    });

    it('should include reason in metadata', async () => {
      await auditLogger.logLoginFailed('user@example.com', mockReq as Request, 'Invalid password');

      const callArgs = mockDb.run.mock.calls[0][1];
      const metadata = JSON.parse(callArgs[14] as string); // metadata
      expect(metadata.reason).toBe('Invalid password');
    });
  });

  describe('logLogout', () => {
    it('should log a logout', async () => {
      const result = await auditLogger.logLogout(1, 'user@example.com', 'client', mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('logout'); // action is at index 3
    });
  });

  describe('logStatusChange', () => {
    it('should log a status change', async () => {
      const result = await auditLogger.logStatusChange('project', '123', 'Test Project', 'draft', 'published', mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('status_change'); // action is at index 3
    });
  });

  describe('logUpload', () => {
    it('should log a file upload', async () => {
      const result = await auditLogger.logUpload('file-123', 'document.pdf', mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('upload'); // action is at index 3
      expect(callArgs[4]).toBe('file'); // entity_type is at index 4
    });
  });

  describe('logDownload', () => {
    it('should log a file download', async () => {
      const result = await auditLogger.logDownload('file-123', 'document.pdf', mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('download'); // action is at index 3
    });
  });

  describe('logMessageSent', () => {
    it('should log a message sent', async () => {
      const result = await auditLogger.logMessageSent('msg-123', 'Test Subject', mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('send_message'); // action is at index 3
    });
  });

  describe('logEmailSent', () => {
    it('should log an email sent', async () => {
      const result = await auditLogger.logEmailSent('recipient@example.com', 'Test Email', mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('send_email'); // action is at index 3
    });

    it('should include recipient in metadata', async () => {
      await auditLogger.logEmailSent('recipient@example.com', 'Test Email', mockReq as Request);

      const callArgs = mockDb.run.mock.calls[0][1];
      const metadata = JSON.parse(callArgs[14]);
      expect(metadata.recipient).toBe('recipient@example.com');
    });
  });

  describe('logPasswordReset', () => {
    it('should log a password reset request', async () => {
      const result = await auditLogger.logPasswordReset(1, 'user@example.com', mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('password_reset'); // action is at index 3
    });
  });

  describe('logView', () => {
    it('should log a view action', async () => {
      const result = await auditLogger.logView('project', '123', 'Test Project', mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('view'); // action is at index 3
    });
  });

  describe('logExport', () => {
    it('should log an export operation', async () => {
      const result = await auditLogger.logExport('client', 'csv', 100, mockReq as Request);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('export'); // action is at index 3
    });

    it('should include format and record count in metadata', async () => {
      await auditLogger.logExport('client', 'csv', 100, mockReq as Request);

      const callArgs = mockDb.run.mock.calls[0][1];
      const metadata = JSON.parse(callArgs[14]);
      expect(metadata.format).toBe('csv');
      expect(metadata.recordCount).toBe(100);
    });
  });

  describe('log (generic)', () => {
    it('should log a custom audit entry', async () => {
      const entry = {
        action: 'custom_action',
        entityType: 'custom',
        entityId: '123',
        entityName: 'Custom Entity',
      };

      const result = await auditLogger.log(entry);

      expect(result).toBe(true);
      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[3]).toBe('custom_action'); // action is at index 3
    });
  });

  describe('query', () => {
    it('should query audit logs without filters', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, action: 'create', entity_type: 'client', old_value: '{}', new_value: '{}', changes: null, metadata: null },
      ]);

      const result = await auditLogger.query({});

      expect(result).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should filter by userId', async () => {
      await auditLogger.query({ userId: 1 });

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('user_id = ?');
      expect(callArgs[1]).toContain(1);
    });

    it('should filter by userEmail', async () => {
      await auditLogger.query({ userEmail: 'user@example.com' });

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('user_email = ?');
      expect(callArgs[1]).toContain('user@example.com');
    });

    it('should filter by action', async () => {
      await auditLogger.query({ action: 'create' });

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('action = ?');
      expect(callArgs[1]).toContain('create');
    });

    it('should filter by entityType', async () => {
      await auditLogger.query({ entityType: 'client' });

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('entity_type = ?');
      expect(callArgs[1]).toContain('client');
    });

    it('should filter by entityId', async () => {
      await auditLogger.query({ entityId: '123' });

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('entity_id = ?');
      expect(callArgs[1]).toContain('123');
    });

    it('should filter by date range', async () => {
      await auditLogger.query({ startDate: '2024-01-01', endDate: '2024-12-31' });

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[0]).toContain('created_at >= ?');
      expect(callArgs[0]).toContain('created_at <= ?');
    });

    it('should apply limit and offset', async () => {
      await auditLogger.query({ limit: 50, offset: 10 });

      const callArgs = mockDb.all.mock.calls[0];
      expect(callArgs[1]).toContain(50);
      expect(callArgs[1]).toContain(10);
    });

    it('should parse JSON fields in results', async () => {
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          old_value: '{"name":"Old"}',
          new_value: '{"name":"New"}',
          changes: '{"name":{"from":"Old","to":"New"}}',
          metadata: '{"key":"value"}',
        },
      ]);

      const result = await auditLogger.query({});

      expect(result[0].old_value).toEqual({ name: 'Old' });
      expect(result[0].new_value).toEqual({ name: 'New' });
      expect(result[0].changes).toEqual({ name: { from: 'Old', to: 'New' } });
      expect(result[0].metadata).toEqual({ key: 'value' });
    });

    it('should handle null JSON fields', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, old_value: null, new_value: null, changes: null, metadata: null },
      ]);

      const result = await auditLogger.query({});

      expect(result[0].old_value).toBeNull();
      expect(result[0].new_value).toBeNull();
      expect(result[0].changes).toBeNull();
      expect(result[0].metadata).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database error');
      mockDb.run.mockRejectedValueOnce(dbError);

      const result = await auditLogger.logCreate('client', '123', 'Test');

      expect(result).toBe(false);
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should not throw errors on database failures', async () => {
      mockDb.run.mockRejectedValue(new Error('Database error'));

      await expect(auditLogger.logCreate('client', '123', 'Test')).resolves.toBe(false);
    });
  });

  describe('request context extraction', () => {
    it('should extract IP address from request', async () => {
      await auditLogger.logCreate('client', '123', 'Test', {}, mockReq as Request);

      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[10]).toBe('127.0.0.1'); // ip_address is at index 10
    });

    it('should extract user agent from request', async () => {
      await auditLogger.logCreate('client', '123', 'Test', {}, mockReq as Request);

      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[11]).toBe('test-agent'); // user_agent is at index 11
    });

    it('should extract request path and method', async () => {
      await auditLogger.logCreate('client', '123', 'Test', {}, mockReq as Request);

      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[12]).toBe('/api/test'); // request_path is at index 12
      expect(callArgs[13]).toBe('POST'); // request_method is at index 13
    });

    it('should handle IPv6 addresses', async () => {
      mockReq.ip = '::ffff:127.0.0.1';
      await auditLogger.logCreate('client', '123', 'Test', {}, mockReq as Request);

      const callArgs = mockDb.run.mock.calls[0][1];
      expect(callArgs[10]).toBe('127.0.0.1'); // Should strip ::ffff: prefix, ip_address is at index 10
    });
  });
});
