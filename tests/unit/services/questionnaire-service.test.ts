/**
 * ===============================================
 * UNIT TESTS - QUESTIONNAIRE SERVICE
 * ===============================================
 * @file tests/unit/services/questionnaire-service.test.ts
 *
 * Tests for questionnaire management including:
 * - Questionnaire CRUD
 * - Response management
 * - Progress tracking and submission
 * - Stats
 * - JSON export
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(1),
    getUserIdByEmailOrName: vi.fn().mockResolvedValue(1)
  }
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../server/config/business', () => ({
  BUSINESS_INFO: {
    name: 'Test Business',
    owner: 'Test Owner',
    tagline: 'Test Tagline',
    email: 'test@business.com',
    website: 'https://test.com',
    contact: 'Test Owner',
    venmoHandle: '@testbiz',
    paypalEmail: 'paypal@test.com'
  },
  getPdfLogoBytes: vi.fn().mockReturnValue(null)
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: vi.fn().mockResolvedValue({
      addPage: vi.fn().mockReturnValue({
        getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
        drawText: vi.fn(),
        drawLine: vi.fn(),
        drawImage: vi.fn()
      }),
      setTitle: vi.fn(),
      setAuthor: vi.fn(),
      setSubject: vi.fn(),
      setCreator: vi.fn(),
      embedFont: vi.fn().mockResolvedValue({
        widthOfTextAtSize: vi.fn().mockReturnValue(100)
      }),
      embedPng: vi.fn(),
      getPages: vi.fn().mockReturnValue([
        {
          drawLine: vi.fn(),
          drawText: vi.fn()
        }
      ]),
      save: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
    })
  },
  StandardFonts: {
    Helvetica: 'Helvetica',
    HelveticaBold: 'HelveticaBold'
  },
  rgb: vi.fn().mockReturnValue({ r: 0, g: 0, b: 0 })
}));

vi.mock('fs', () => {
  const writeFileSyncMock = vi.fn();
  const mkdirSyncMock = vi.fn();
  const existsSyncMock = vi.fn().mockReturnValue(true);
  return {
    default: {
      writeFileSync: writeFileSyncMock,
      mkdirSync: mkdirSyncMock,
      existsSync: existsSyncMock
    },
    writeFileSync: writeFileSyncMock,
    mkdirSync: mkdirSyncMock,
    existsSync: existsSyncMock
  };
});

vi.mock('path', () => {
  const joinMock = vi.fn((...args: string[]) => args.join('/'));
  return {
    default: { join: joinMock },
    join: joinMock
  };
});

vi.mock('../../../server/utils/safe-json', () => ({
  parseIfString: vi.fn((val: unknown) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  })
}));

// Import service after mocks
import { questionnaireService } from '../../../server/services/questionnaire-service';

// ============================================================
// Row builders
// ============================================================

const makeQuestionnaireRow = (overrides = {}) => ({
  id: 1,
  name: 'Client Onboarding',
  description: 'Initial onboarding questionnaire',
  project_type: 'website',
  questions: JSON.stringify([
    { id: 'q1', type: 'text', question: 'What is your business name?', required: true }
  ]),
  is_active: 1,
  auto_send_on_project_create: 0,
  display_order: 1,
  created_by: 'admin@test.com',
  created_by_user_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeResponseRow = (overrides = {}) => ({
  id: 1,
  questionnaire_id: 1,
  client_id: 5,
  project_id: 10,
  answers: JSON.stringify({ q1: 'Acme Corp' }),
  status: 'pending',
  started_at: null,
  completed_at: null,
  due_date: '2026-04-01',
  reminder_count: 0,
  reminder_sent_at: null,
  exported_file_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  questionnaire_name: 'Client Onboarding',
  questionnaire_description: 'Initial onboarding questionnaire',
  client_name: 'Acme Corp',
  project_name: 'Website Redesign',
  ...overrides
});

describe('QuestionnaireService', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  // =====================================================
  // QUESTIONNAIRE CRUD
  // =====================================================

  describe('createQuestionnaire', () => {
    it('creates a questionnaire and returns it', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      const result = await questionnaireService.createQuestionnaire({
        name: 'Client Onboarding',
        description: 'Initial onboarding questionnaire',
        project_type: 'website',
        questions: [{ id: 'q1', type: 'text', question: 'Business name?', required: true }],
        is_active: true,
        created_by: 'admin@test.com'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO questionnaires'),
        expect.arrayContaining(['Client Onboarding', 'Initial onboarding questionnaire'])
      );
      expect(result.name).toBe('Client Onboarding');
      expect(result.is_active).toBe(true);
    });

    it('defaults is_active to true when not specified', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow({ id: 2 }));

      await questionnaireService.createQuestionnaire({
        name: 'Survey',
        questions: [{ id: 'q1', type: 'text', question: 'Question?' }]
      });

      const [, params] = mockDb.run.mock.calls[0];
      // is_active defaults to 1
      expect(params[4]).toBe(1);
    });

    it('sets auto_send_on_project_create to 0 when not specified', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 3 });
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow({ id: 3, auto_send_on_project_create: 0 }));

      await questionnaireService.createQuestionnaire({
        name: 'Survey',
        questions: []
      });

      const [, params] = mockDb.run.mock.calls[0];
      expect(params[5]).toBe(0);
    });
  });

  describe('getQuestionnaire', () => {
    it('returns questionnaire when found', async () => {
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      const result = await questionnaireService.getQuestionnaire(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.name).toBe('Client Onboarding');
      expect(result!.is_active).toBe(true);
      expect(result!.auto_send_on_project_create).toBe(false);
    });

    it('returns null when questionnaire not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await questionnaireService.getQuestionnaire(999);

      expect(result).toBeNull();
    });
  });

  describe('getQuestionnaires', () => {
    it('returns all questionnaires', async () => {
      mockDb.all.mockResolvedValueOnce([
        makeQuestionnaireRow({ id: 1 }),
        makeQuestionnaireRow({ id: 2, name: 'Exit Survey' })
      ]);

      const result = await questionnaireService.getQuestionnaires();

      expect(result).toHaveLength(2);
    });

    it('filters by project type', async () => {
      mockDb.all.mockResolvedValueOnce([makeQuestionnaireRow()]);

      await questionnaireService.getQuestionnaires('website');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND (project_type = ? OR project_type IS NULL)'),
        expect.arrayContaining(['website'])
      );
    });

    it('filters to active-only when activeOnly is true', async () => {
      mockDb.all.mockResolvedValueOnce([makeQuestionnaireRow()]);

      await questionnaireService.getQuestionnaires(undefined, true);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND is_active = 1'),
        []
      );
    });

    it('applies both project type and active filters', async () => {
      mockDb.all.mockResolvedValueOnce([makeQuestionnaireRow()]);

      await questionnaireService.getQuestionnaires('ecommerce', true);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND is_active = 1'),
        ['ecommerce']
      );
    });

    it('returns empty array when none found', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await questionnaireService.getQuestionnaires();

      expect(result).toEqual([]);
    });
  });

  describe('updateQuestionnaire', () => {
    it('updates an existing questionnaire', async () => {
      // getQuestionnaire (existing)
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());
      // run update
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      // getQuestionnaire (after update)
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow({ name: 'Updated Name', is_active: 0 }));

      const result = await questionnaireService.updateQuestionnaire(1, {
        name: 'Updated Name',
        is_active: false
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE questionnaires'),
        expect.any(Array)
      );
      expect(result).not.toBeNull();
    });

    it('returns null when questionnaire not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await questionnaireService.updateQuestionnaire(999, { name: 'New' });

      expect(result).toBeNull();
    });

    it('preserves existing values for unspecified fields', async () => {
      const existing = makeQuestionnaireRow();
      mockDb.get.mockResolvedValueOnce(existing);
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(existing);

      await questionnaireService.updateQuestionnaire(1, { name: 'New Name' });

      const [, params] = mockDb.run.mock.calls[0];
      // Description should be preserved from existing
      expect(params[1]).toBe(existing.description);
    });
  });

  describe('deleteQuestionnaire', () => {
    it('deletes a questionnaire', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await questionnaireService.deleteQuestionnaire(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM questionnaires WHERE id = ?',
        [1]
      );
    });
  });

  // =====================================================
  // RESPONSE MANAGEMENT
  // =====================================================

  describe('sendQuestionnaire', () => {
    it('creates a questionnaire response', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(makeResponseRow());

      const result = await questionnaireService.sendQuestionnaire({
        questionnaire_id: 1,
        client_id: 5,
        project_id: 10,
        due_date: '2026-04-01'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO questionnaire_responses'),
        [1, 5, 10, '2026-04-01']
      );
      expect(result.status).toBe('pending');
    });

    it('sends without project_id or due_date', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ id: 2, project_id: null, due_date: null }));

      await questionnaireService.sendQuestionnaire({
        questionnaire_id: 1,
        client_id: 5
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO questionnaire_responses'),
        [1, 5, null, null]
      );
    });
  });

  describe('sendQuestionnaireForProjectType', () => {
    it('sends auto-send questionnaires and skips already-sent ones', async () => {
      // getQuestionnaires
      mockDb.all.mockResolvedValueOnce([
        makeQuestionnaireRow({ id: 1, auto_send_on_project_create: 1 }), // should be sent
        makeQuestionnaireRow({ id: 2, auto_send_on_project_create: 1 }) // already sent
      ]);

      // getClientResponseForQuestionnaire for questionnaire 1 (not sent yet)
      mockDb.get.mockResolvedValueOnce(null);
      // sendQuestionnaire for questionnaire 1
      mockDb.run.mockResolvedValueOnce({ lastID: 10 });
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ id: 10, questionnaire_id: 1 }));

      // getClientResponseForQuestionnaire for questionnaire 2 (already sent)
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ id: 5, questionnaire_id: 2 }));

      const result = await questionnaireService.sendQuestionnaireForProjectType(5, 10, 'website');

      // Only 1 was sent (questionnaire 2 was skipped as already existing)
      expect(result).toHaveLength(1);
      expect(result[0].questionnaire_id).toBe(1);
    });

    it('returns empty array when no auto-send questionnaires', async () => {
      mockDb.all.mockResolvedValueOnce([
        makeQuestionnaireRow({ auto_send_on_project_create: 0 })
      ]);

      const result = await questionnaireService.sendQuestionnaireForProjectType(5, 10, 'website');

      expect(result).toEqual([]);
    });

    it('returns empty array when no questionnaires for project type', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await questionnaireService.sendQuestionnaireForProjectType(5, 10, 'unknown');

      expect(result).toEqual([]);
    });
  });

  describe('getResponse', () => {
    it('returns response when found', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow());

      const result = await questionnaireService.getResponse(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.status).toBe('pending');
    });

    it('returns null when not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await questionnaireService.getResponse(999);

      expect(result).toBeNull();
    });

    it('parses answers from JSON string', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ answers: JSON.stringify({ q1: 'Test' }) }));

      const result = await questionnaireService.getResponse(1);

      expect(result!.answers).toEqual({ q1: 'Test' });
    });
  });

  describe('getClientResponses', () => {
    it('returns all responses for a client', async () => {
      mockDb.all.mockResolvedValueOnce([makeResponseRow(), makeResponseRow({ id: 2 })]);

      const result = await questionnaireService.getClientResponses(5);

      expect(result).toHaveLength(2);
    });

    it('filters by status', async () => {
      mockDb.all.mockResolvedValueOnce([makeResponseRow({ status: 'completed' })]);

      await questionnaireService.getClientResponses(5, 'completed');

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND qr.status = ?'),
        expect.arrayContaining([5, 'completed'])
      );
    });

    it('returns empty array when no responses', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await questionnaireService.getClientResponses(999);

      expect(result).toEqual([]);
    });
  });

  describe('getClientResponseForQuestionnaire', () => {
    it('returns response when found', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow());

      const result = await questionnaireService.getClientResponseForQuestionnaire(5, 1);

      expect(result).not.toBeNull();
      expect(result!.client_id).toBe(5);
    });

    it('returns null when not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await questionnaireService.getClientResponseForQuestionnaire(5, 99);

      expect(result).toBeNull();
    });
  });

  describe('getPendingResponses', () => {
    it('returns all pending and in_progress responses', async () => {
      mockDb.all.mockResolvedValueOnce([
        makeResponseRow({ status: 'pending' }),
        makeResponseRow({ id: 2, status: 'in_progress' })
      ]);

      const result = await questionnaireService.getPendingResponses();

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('pending');
      expect(result[1].status).toBe('in_progress');
    });

    it('returns empty array when no pending responses', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const result = await questionnaireService.getPendingResponses();

      expect(result).toEqual([]);
    });
  });

  describe('saveProgress', () => {
    it('saves partial answers and sets status to in_progress', async () => {
      // getResponse
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ answers: JSON.stringify({ q1: 'Acme' }) }));
      // run update
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      // getResponse after update
      mockDb.get.mockResolvedValueOnce(makeResponseRow({
        answers: JSON.stringify({ q1: 'Acme', q2: 'New York' }),
        status: 'in_progress',
        started_at: '2026-03-01T10:00:00Z'
      }));

      const result = await questionnaireService.saveProgress(1, { q2: 'New York' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('SET answers = ?'),
        expect.any(Array)
      );
      expect(result.status).toBe('in_progress');
    });

    it('merges new answers with existing answers', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ answers: JSON.stringify({ q1: 'Existing' }) }));
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeResponseRow({
        answers: JSON.stringify({ q1: 'Existing', q2: 'New' }),
        status: 'in_progress'
      }));

      await questionnaireService.saveProgress(1, { q2: 'New' });

      const [, params] = mockDb.run.mock.calls[0];
      const savedAnswers = JSON.parse(params[0]);
      expect(savedAnswers.q1).toBe('Existing');
      expect(savedAnswers.q2).toBe('New');
    });

    it('throws when response not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(questionnaireService.saveProgress(999, {})).rejects.toThrow('Response not found');
    });
  });

  describe('submitResponse', () => {
    it('submits answers and marks as completed', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ status: 'in_progress', answers: JSON.stringify({ q1: 'Draft' }) }));
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeResponseRow({
        answers: JSON.stringify({ q1: 'Final Answer' }),
        status: 'completed',
        completed_at: '2026-03-01T11:00:00Z'
      }));

      const result = await questionnaireService.submitResponse(1, { q1: 'Final Answer' });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('status = \'completed\''),
        expect.any(Array)
      );
      expect(result.status).toBe('completed');
    });

    it('merges submitted answers with existing ones', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ answers: JSON.stringify({ q1: 'Existing' }) }));
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ status: 'completed' }));

      await questionnaireService.submitResponse(1, { q2: 'New' });

      const [, params] = mockDb.run.mock.calls[0];
      const savedAnswers = JSON.parse(params[0]);
      expect(savedAnswers.q1).toBe('Existing');
      expect(savedAnswers.q2).toBe('New');
    });

    it('throws when response not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(questionnaireService.submitResponse(999, {})).rejects.toThrow('Response not found');
    });
  });

  describe('sendReminder', () => {
    it('increments reminder count and updates reminder_sent_at', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ reminder_count: 1 }));
      mockDb.run.mockResolvedValueOnce({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(makeResponseRow({
        reminder_count: 2,
        reminder_sent_at: '2026-03-01T09:00:00Z'
      }));

      const result = await questionnaireService.sendReminder(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('reminder_count = reminder_count + 1'),
        [1]
      );
      expect(result.reminder_count).toBe(2);
    });

    it('throws when response not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(questionnaireService.sendReminder(999)).rejects.toThrow('Response not found');
    });
  });

  describe('deleteResponse', () => {
    it('permanently deletes a response', async () => {
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      await questionnaireService.deleteResponse(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM questionnaire_responses WHERE id = ?',
        [1]
      );
    });
  });

  // =====================================================
  // STATS
  // =====================================================

  describe('getClientStats', () => {
    it('returns questionnaire stats for a client', async () => {
      mockDb.get.mockResolvedValueOnce({
        total: 5,
        pending: 2,
        in_progress: 1,
        completed: 2
      });

      const result = await questionnaireService.getClientStats(5);

      expect(result.total).toBe(5);
      expect(result.pending).toBe(2);
      expect(result.in_progress).toBe(1);
      expect(result.completed).toBe(2);
    });

    it('returns zeroes when no responses exist', async () => {
      mockDb.get.mockResolvedValueOnce({
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0
      });

      const result = await questionnaireService.getClientStats(999);

      expect(result.total).toBe(0);
      expect(result.pending).toBe(0);
    });

    it('handles null stats gracefully', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await questionnaireService.getClientStats(999);

      expect(result.total).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.in_progress).toBe(0);
      expect(result.completed).toBe(0);
    });
  });

  // =====================================================
  // JSON EXPORT
  // =====================================================

  describe('exportQuestionnaireJson', () => {
    it('exports response as structured JSON string', async () => {
      // getResponse
      mockDb.get.mockResolvedValueOnce(makeResponseRow({
        answers: JSON.stringify({ q1: 'Acme Corp' }),
        status: 'completed',
        completed_at: '2026-03-01T11:00:00Z'
      }));

      // getQuestionnaire
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      const result = await questionnaireService.exportQuestionnaireJson(1);
      const parsed = JSON.parse(result);

      expect(parsed.questionnaire.name).toBe('Client Onboarding');
      expect(parsed.response.id).toBe(1);
      expect(parsed.questions_and_answers).toHaveLength(1);
      expect(parsed.questions_and_answers[0].question_text).toBe('What is your business name?');
      expect(parsed.exported_at).toBeDefined();
    });

    it('throws when response not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(questionnaireService.exportQuestionnaireJson(999)).rejects.toThrow(
        'Response not found'
      );
    });

    it('throws when questionnaire not found', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow());
      mockDb.get.mockResolvedValueOnce(null);

      await expect(questionnaireService.exportQuestionnaireJson(1)).rejects.toThrow(
        'Questionnaire not found'
      );
    });

    it('includes null answer for unanswered questions', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ answers: JSON.stringify({}) }));
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      const result = await questionnaireService.exportQuestionnaireJson(1);
      const parsed = JSON.parse(result);

      expect(parsed.questions_and_answers[0].answer).toBeNull();
    });
  });

  // =====================================================
  // PDF GENERATION
  // =====================================================

  describe('generateQuestionnairePdf', () => {
    it('generates a PDF as Uint8Array', async () => {
      // getResponse
      mockDb.get.mockResolvedValueOnce(makeResponseRow({
        answers: JSON.stringify({ q1: 'Acme Corp' }),
        status: 'completed',
        completed_at: '2026-03-01T11:00:00Z'
      }));
      // getQuestionnaire
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      const result = await questionnaireService.generateQuestionnairePdf(1);

      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('throws when response not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(questionnaireService.generateQuestionnairePdf(999)).rejects.toThrow(
        'Response not found'
      );
    });

    it('throws when questionnaire not found', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow());
      mockDb.get.mockResolvedValueOnce(null);

      await expect(questionnaireService.generateQuestionnairePdf(1)).rejects.toThrow(
        'Questionnaire not found'
      );
    });

    it('handles array answers correctly', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow({
        answers: JSON.stringify({ q1: ['Option A', 'Option B'] }),
        status: 'completed'
      }));
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      const result = await questionnaireService.generateQuestionnairePdf(1);

      // Should not throw and should produce valid output
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  // =====================================================
  // SAVE PDF TO FILES
  // =====================================================

  describe('saveQuestionnairePdfToFiles', () => {
    it('generates PDF, saves to disk, and inserts file record', async () => {
      // getResponse (first call for saveQuestionnairePdfToFiles)
      mockDb.get.mockResolvedValueOnce(makeResponseRow({
        status: 'completed',
        project_id: 10
      }));
      // getQuestionnaire (for saveQuestionnairePdfToFiles)
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      // generateQuestionnairePdf -> getResponse
      mockDb.get.mockResolvedValueOnce(makeResponseRow({
        answers: JSON.stringify({ q1: 'Answer' }),
        status: 'completed',
        project_id: 10
      }));
      // generateQuestionnairePdf -> getQuestionnaire
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      // check for Forms folder
      mockDb.get.mockResolvedValueOnce(null); // no existing folder
      // INSERT folder
      mockDb.run.mockResolvedValueOnce({ lastID: 50 });
      // INSERT file
      mockDb.run.mockResolvedValueOnce({ lastID: 100 });
      // UPDATE response exported_file_id
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      const result = await questionnaireService.saveQuestionnairePdfToFiles(1);

      expect(result).toBe(100);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE questionnaire_responses SET exported_file_id = ?'),
        [100, 1]
      );
    });

    it('reuses existing Forms folder', async () => {
      // getResponse
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ project_id: 10, status: 'completed' }));
      // getQuestionnaire
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      // generateQuestionnairePdf calls
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ project_id: 10, status: 'completed', answers: JSON.stringify({}) }));
      mockDb.get.mockResolvedValueOnce(makeQuestionnaireRow());

      // Existing folder found
      mockDb.get.mockResolvedValueOnce({ id: 25 });
      // INSERT file
      mockDb.run.mockResolvedValueOnce({ lastID: 101 });
      // UPDATE response
      mockDb.run.mockResolvedValueOnce({ changes: 1 });

      const result = await questionnaireService.saveQuestionnairePdfToFiles(1);

      expect(result).toBe(101);
      // Should NOT have called run to create a folder
      const folderInsertCall = mockDb.run.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO file_folders')
      );
      expect(folderInsertCall).toBeUndefined();
    });

    it('throws when response not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      await expect(questionnaireService.saveQuestionnairePdfToFiles(999)).rejects.toThrow(
        'Response not found'
      );
    });

    it('throws when response has no project_id', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ project_id: null }));

      await expect(questionnaireService.saveQuestionnairePdfToFiles(1)).rejects.toThrow(
        'Cannot save PDF: questionnaire has no associated project'
      );
    });

    it('throws when questionnaire not found', async () => {
      mockDb.get.mockResolvedValueOnce(makeResponseRow({ project_id: 10 }));
      mockDb.get.mockResolvedValueOnce(null);

      await expect(questionnaireService.saveQuestionnairePdfToFiles(1)).rejects.toThrow(
        'Questionnaire not found'
      );
    });
  });
});
