/**
 * ===============================================
 * UNIT TESTS - USER SERVICE
 * ===============================================
 * @file tests/unit/services/user-service.test.ts
 *
 * Tests for user service including:
 * - User lookup by email and name
 * - User retrieval by ID and email
 * - Active/all user listing
 * - User creation and getOrCreate
 * - User activation/deactivation
 * - Cache behavior
 * - Transition helper methods (buildAssignedToParams, buildAssignedToSet, buildUserColumnSet)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import after mocks
import { userService } from '../../../server/services/user-service';

const mockUserRow = {
  id: 1,
  email: 'alice@example.com',
  display_name: 'Alice Smith',
  role: 'admin',
  avatar_url: null,
  is_active: 1,
  last_active_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

const mappedUser = {
  id: 1,
  email: 'alice@example.com',
  display_name: 'Alice Smith',
  role: 'admin',
  avatar_url: null,
  is_active: true,
  last_active_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

describe('UserService - getUserIdByEmail', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    userService.clearCache();
  });

  it('returns null for null input', async () => {
    const result = await userService.getUserIdByEmail(null);
    expect(result).toBeNull();
    expect(mockDb.get).not.toHaveBeenCalled();
  });

  it('returns null for undefined input', async () => {
    const result = await userService.getUserIdByEmail(undefined);
    expect(result).toBeNull();
  });

  it('returns user id when user exists', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1 });

    const result = await userService.getUserIdByEmail('Alice@Example.COM');

    expect(result).toBe(1);
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(email) = ?'),
      ['alice@example.com']
    );
  });

  it('returns null when user not found in db', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await userService.getUserIdByEmail('notfound@example.com');

    expect(result).toBeNull();
  });

  it('uses cache for repeated lookups', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 5 });

    const first = await userService.getUserIdByEmail('cached@example.com');
    const second = await userService.getUserIdByEmail('cached@example.com');

    expect(first).toBe(5);
    expect(second).toBe(5);
    expect(mockDb.get).toHaveBeenCalledTimes(1); // only one DB call
  });
});

describe('UserService - getUserIdByEmailOrName', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
    userService.clearCache();
  });

  it('returns null for null input', async () => {
    const result = await userService.getUserIdByEmailOrName(null);
    expect(result).toBeNull();
  });

  it('tries email lookup first when identifier contains @', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 3 }); // email lookup

    const result = await userService.getUserIdByEmailOrName('bob@example.com');

    expect(result).toBe(3);
    // Should have been called with email lookup
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(email) = ?'),
      ['bob@example.com']
    );
  });

  it('falls through to name lookup when email not found', async () => {
    mockDb.get
      .mockResolvedValueOnce(undefined) // email lookup returns nothing
      .mockResolvedValueOnce({ id: 7 }); // name lookup

    const result = await userService.getUserIdByEmailOrName('unknown@example.com');

    expect(result).toBe(7);
  });

  it('performs display_name lookup for non-email identifiers', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 9 });

    const result = await userService.getUserIdByEmailOrName('Alice Smith');

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(display_name) = ?'),
      ['alice smith', 'alice smith']
    );
    expect(result).toBe(9);
  });

  it('returns null when name not found', async () => {
    mockDb.get.mockResolvedValueOnce(undefined);

    const result = await userService.getUserIdByEmailOrName('Nobody Here');

    expect(result).toBeNull();
  });
});

describe('UserService - getUserById', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    userService.clearCache();
  });

  it('returns mapped user when found', async () => {
    mockDb.get.mockResolvedValueOnce(mockUserRow);

    const result = await userService.getUserById(1);

    expect(result).toMatchObject(mappedUser);
  });

  it('returns null when user not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const result = await userService.getUserById(999);

    expect(result).toBeNull();
  });

  it('coerces is_active integer to boolean', async () => {
    mockDb.get.mockResolvedValueOnce({ ...mockUserRow, is_active: 0 });

    const result = await userService.getUserById(2);

    expect(result?.is_active).toBe(false);
  });
});

describe('UserService - getUserByEmail', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    userService.clearCache();
  });

  it('returns mapped user when found', async () => {
    mockDb.get.mockResolvedValueOnce(mockUserRow);

    const result = await userService.getUserByEmail('Alice@Example.com');

    expect(result).toMatchObject(mappedUser);
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(email) = ?'),
      ['alice@example.com']
    );
  });

  it('returns null when email not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const result = await userService.getUserByEmail('nobody@example.com');

    expect(result).toBeNull();
  });
});

describe('UserService - getActiveUsers', () => {
  beforeEach(() => {
    mockDb.all.mockReset();
    userService.clearCache();
  });

  it('returns all active users', async () => {
    mockDb.all.mockResolvedValueOnce([mockUserRow]);

    const result = await userService.getActiveUsers();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject(mappedUser);
    const callArg = mockDb.all.mock.calls[0][0] as string;
    expect(callArg).toContain('is_active = 1');
  });

  it('returns empty array when no active users', async () => {
    mockDb.all.mockResolvedValueOnce([]);

    const result = await userService.getActiveUsers();

    expect(result).toHaveLength(0);
  });
});

describe('UserService - getAllUsers', () => {
  beforeEach(() => {
    mockDb.all.mockReset();
    userService.clearCache();
  });

  it('returns all users including inactive', async () => {
    const inactiveRow = { ...mockUserRow, id: 2, is_active: 0 };
    mockDb.all.mockResolvedValueOnce([mockUserRow, inactiveRow]);

    const result = await userService.getAllUsers();

    expect(result).toHaveLength(2);
    expect(result[1].is_active).toBe(false);
  });
});

describe('UserService - createUser', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    userService.clearCache();
  });

  it('creates a user and returns it', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(mockUserRow);

    const result = await userService.createUser({
      email: 'Alice@Example.COM',
      displayName: 'Alice Smith',
      role: 'admin'
    });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['alice@example.com', 'Alice Smith', 'admin', null])
    );
    expect(result).toMatchObject(mappedUser);
  });

  it('defaults role to team_member when not specified', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });
    mockDb.get.mockResolvedValueOnce({ ...mockUserRow, id: 2, role: 'team_member' });

    await userService.createUser({ email: 'bob@example.com', displayName: 'Bob' });

    const runArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(runArgs[2]).toBe('team_member');
  });

  it('throws when getUserById returns null after insert', async () => {
    mockDb.run.mockResolvedValueOnce({ lastID: 1 });
    mockDb.get.mockResolvedValueOnce(null); // getUserById returns null

    await expect(
      userService.createUser({ email: 'fail@example.com', displayName: 'Fail' })
    ).rejects.toThrow('Failed to create user');
  });
});

describe('UserService - getOrCreateUser', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    userService.clearCache();
  });

  it('returns existing user when found', async () => {
    mockDb.get.mockResolvedValueOnce(mockUserRow);

    const result = await userService.getOrCreateUser('alice@example.com', 'Alice');

    expect(result).toMatchObject(mappedUser);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('creates user when not found', async () => {
    mockDb.get.mockResolvedValueOnce(null);   // getUserByEmail - not found
    mockDb.run.mockResolvedValueOnce({ lastID: 2 });
    mockDb.get.mockResolvedValueOnce({ ...mockUserRow, id: 2 });

    const result = await userService.getOrCreateUser('new@example.com', 'New Person');

    expect(result.id).toBe(2);
    expect(mockDb.run).toHaveBeenCalled();
  });

  it('uses email username as displayName when displayName is not provided', async () => {
    mockDb.get.mockResolvedValueOnce(null);   // getUserByEmail
    mockDb.run.mockResolvedValueOnce({ lastID: 3 });
    mockDb.get.mockResolvedValueOnce({ ...mockUserRow, id: 3, display_name: 'noname' });

    await userService.getOrCreateUser('noname@example.com');

    const runArgs = mockDb.run.mock.calls[0][1] as unknown[];
    expect(runArgs[1]).toBe('noname'); // email.split('@')[0]
  });
});

describe('UserService - updateLastActive', () => {
  beforeEach(() => {
    mockDb.run.mockReset();
    userService.clearCache();
  });

  it('updates last_active_at for the user', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    await userService.updateLastActive(1);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('last_active_at = CURRENT_TIMESTAMP'),
      [1]
    );
  });
});

describe('UserService - deactivateUser', () => {
  beforeEach(() => {
    mockDb.run.mockReset();
    userService.clearCache();
  });

  it('sets is_active to 0 and clears cache', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    await userService.deactivateUser(1);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('is_active = 0'),
      [1]
    );
  });
});

describe('UserService - reactivateUser', () => {
  beforeEach(() => {
    mockDb.run.mockReset();
    userService.clearCache();
  });

  it('sets is_active to 1 and clears cache', async () => {
    mockDb.run.mockResolvedValueOnce({ changes: 1 });

    await userService.reactivateUser(1);

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('is_active = 1'),
      [1]
    );
  });
});

describe('UserService - transition helpers', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.run.mockReset();
    userService.clearCache();
  });

  describe('buildAssignedToParams', () => {
    it('returns columns, placeholders and values with resolved userId', async () => {
      mockDb.get.mockResolvedValueOnce({ id: 4 }); // getUserIdByEmail

      const result = await userService.buildAssignedToParams('alice@example.com');

      expect(result.columns).toBe('assigned_to, assigned_to_user_id');
      expect(result.placeholders).toBe('?, ?');
      expect(result.values).toEqual(['alice@example.com', 4]);
    });

    it('returns null userId when email not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const result = await userService.buildAssignedToParams('ghost@example.com');

      expect(result.values).toEqual(['ghost@example.com', null]);
    });

    it('returns null email and null userId for null input', async () => {
      const result = await userService.buildAssignedToParams(null);

      expect(result.values).toEqual([null, null]);
      expect(mockDb.get).not.toHaveBeenCalled();
    });
  });

  describe('buildAssignedToSet', () => {
    it('returns setClause and values with resolved userId', async () => {
      mockDb.get.mockResolvedValueOnce({ id: 7 });

      const result = await userService.buildAssignedToSet('bob@example.com');

      expect(result.setClause).toBe('assigned_to = ?, assigned_to_user_id = ?');
      expect(result.values).toEqual(['bob@example.com', 7]);
    });

    it('handles null email', async () => {
      const result = await userService.buildAssignedToSet(null);

      expect(result.values).toEqual([null, null]);
    });
  });

  describe('buildUserColumnSet', () => {
    it('returns correct setClause and values for named columns', async () => {
      mockDb.get.mockResolvedValueOnce({ id: 11 });

      const result = await userService.buildUserColumnSet(
        'created_by',
        'created_by_user_id',
        'charlie@example.com'
      );

      expect(result.setClause).toBe('created_by = ?, created_by_user_id = ?');
      expect(result.values).toEqual(['charlie@example.com', 11]);
    });

    it('handles null identifier', async () => {
      const result = await userService.buildUserColumnSet('col', 'col_id', null);

      expect(result.values).toEqual([null, null]);
    });
  });
});
