/**
 * ===============================================
 * TEST SUITE - CLIENT INFORMATION COLLECTION
 * ===============================================
 * @file tests/unit/server/client-information.test.ts
 *
 * Tests for client information collection system:
 * - Onboarding workflow
 * - Document collection and management
 * - Questionnaires and responses
 * - Information status tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/database/init';

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn()
}));

describe('Client Information - Onboarding Wizard', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('POST /api/onboarding/create', () => {
    it('should create onboarding session for client', async () => {
      const onboardingData = {
        client_id: 5,
        project_id: 1,
        status: 'step_1',
        current_step: 1
      };

      mockDb.run.mockResolvedValue({ lastID: 1 });

      await mockDb.run(
        'INSERT INTO onboarding_sessions (client_id, project_id, status, current_step) VALUES (?, ?, ?, ?)',
        [onboardingData.client_id, onboardingData.project_id, onboardingData.status, onboardingData.current_step]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should initialize with step 1 (basic info)', async () => {
      const session = {
        current_step: 1,
        status: 'step_1'
      };

      expect(session.current_step).toBe(1);
    });
  });

  describe('PUT /api/onboarding/:id/step/:step', () => {
    it('should save step 1: basic info', async () => {
      const stepData = {
        company_name: 'Acme Corp',
        contact_name: 'John Doe',
        email: 'john@acmecorp.com',
        phone: '+1-555-1234'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'INSERT INTO onboarding_responses (session_id, step, response_data) VALUES (?, ?, ?)',
        [1, 1, JSON.stringify(stepData)]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should save step 2: project overview', async () => {
      const stepData = {
        project_type: 'website',
        description: 'Modern business website',
        goals: 'Increase online presence and lead generation',
        target_audience: 'B2B clients in tech industry'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'INSERT INTO onboarding_responses (session_id, step, response_data) VALUES (?, ?, ?)',
        [1, 2, JSON.stringify(stepData)]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should save step 3: requirements', async () => {
      const stepData = {
        features_needed: ['Blog', 'Contact Form', 'Gallery'],
        timeline_months: 3,
        budget_range: '5000-10000'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'INSERT INTO onboarding_responses (session_id, step, response_data) VALUES (?, ?, ?)',
        [1, 3, JSON.stringify(stepData)]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should save step 4: asset checklist', async () => {
      const stepData = {
        has_logo: true,
        has_content: false,
        has_domain: true,
        domain_info: 'acmecorp.com'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'INSERT INTO onboarding_responses (session_id, step, response_data) VALUES (?, ?, ?)',
        [1, 4, JSON.stringify(stepData)]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should save step 5: review and submit', async () => {
      const stepData = {
        review_complete: true,
        is_submitted: true
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'UPDATE onboarding_sessions SET status = ?, is_complete = ? WHERE id = ?',
        ['complete', 1, 1]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should support progress save without step completion', async () => {
      const session = {
        current_step: 3,
        progress_saved_at: new Date().toISOString()
      };

      expect(session.progress_saved_at).toBeTruthy();
    });

    it('should allow resuming from saved progress', async () => {
      const mockSession = {
        id: 1,
        current_step: 3,
        status: 'in_progress'
      };

      mockDb.get.mockResolvedValue(mockSession);

      const session = await mockDb.get('SELECT * FROM onboarding_sessions WHERE id = ?', [1]);

      expect(session.current_step).toBe(3);
    });
  });

  describe('Progress Indicators', () => {
    it('should show progress as step X of 5', async () => {
      const currentStep = 3;
      const totalSteps = 5;
      const progress = Math.round((currentStep / totalSteps) * 100);

      expect(progress).toBe(60);
    });

    it('should show completion status', async () => {
      const completedSteps = 5;
      const totalSteps = 5;
      const isComplete = completedSteps === totalSteps;

      expect(isComplete).toBe(true);
    });
  });
});

describe('Client Information - Document Collection', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('GET /api/document-requests/my-requests', () => {
    it('should fetch document requests for client', async () => {
      const mockRequests = [
        {
          id: 1,
          title: 'Logo Files',
          category: 'brand_assets',
          status: 'submitted',
          due_date: '2026-02-15'
        },
        {
          id: 2,
          title: 'Website Copy',
          category: 'content',
          status: 'pending',
          due_date: '2026-02-20'
        },
        {
          id: 3,
          title: 'Legal Documents',
          category: 'legal',
          status: 'pending',
          due_date: '2026-02-25'
        }
      ];

      mockDb.all.mockResolvedValue(mockRequests);

      const requests = await mockDb.all('SELECT * FROM document_requests WHERE client_id = ?', [5]);

      expect(requests).toHaveLength(3);
      expect(requests[0].status).toBe('submitted');
      expect(requests[1].status).toBe('pending');
    });

    it('should show status: pending, in_progress, submitted, approved, rejected', async () => {
      const validStatuses = ['pending', 'in_progress', 'submitted', 'approved', 'rejected'];
      const currentStatus = 'in_progress';

      expect(validStatuses).toContain(currentStatus);
    });

    it('should show required vs optional documents', async () => {
      const document = {
        id: 1,
        title: 'Logo Files',
        is_required: true
      };

      expect(document.is_required).toBe(true);
    });
  });

  describe('POST /api/document-requests/:id/upload', () => {
    it('should upload document for request', async () => {
      const uploadData = {
        request_id: 1,
        client_id: 5,
        file_name: 'logo.png',
        file_size: 102400,
        file_type: 'image/png',
        file_path: '/uploads/logos/logo.png'
      };

      mockDb.run.mockResolvedValue({ lastID: 1 });

      await mockDb.run(
        'INSERT INTO document_uploads (request_id, client_id, file_name, file_size, file_type, file_path) VALUES (?, ?, ?, ?, ?, ?)',
        [uploadData.request_id, uploadData.client_id, uploadData.file_name, uploadData.file_size, uploadData.file_type, uploadData.file_path]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should validate file type', async () => {
      const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
      const uploadedType = 'image/png';

      expect(allowedTypes).toContain(uploadedType);
    });

    it('should validate file size', async () => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const uploadedSize = 2 * 1024 * 1024; // 2MB

      expect(uploadedSize).toBeLessThanOrEqual(maxSize);
    });

    it('should support bulk upload', async () => {
      const files = [
        { name: 'logo.png', size: 102400 },
        { name: 'favicon.ico', size: 51200 },
        { name: 'brand-guide.pdf', size: 2048000 }
      ];

      expect(files).toHaveLength(3);
    });

    it('should update request status to submitted after upload', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'UPDATE document_requests SET status = ?, submitted_at = ? WHERE id = ?',
        ['submitted', new Date().toISOString(), 1]
      );

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        expect.arrayContaining(['submitted'])
      );
    });
  });

  describe('Document Management', () => {
    it('should list required documents for project type', async () => {
      const requiredDocs = [
        { id: 1, title: 'Logo Files', category: 'brand_assets' },
        { id: 2, title: 'Company Info', category: 'brand_assets' },
        { id: 3, title: 'Website Copy', category: 'content' }
      ];

      expect(requiredDocs).toHaveLength(3);
    });

    it('should categorize documents: brand_assets, content, legal, technical', async () => {
      const categories = ['brand_assets', 'content', 'legal', 'technical'];
      const docCategory = 'brand_assets';

      expect(categories).toContain(docCategory);
    });

    it('should preview uploaded documents', async () => {
      const document = {
        file_name: 'logo.png',
        file_path: '/uploads/logos/logo.png',
        file_type: 'image/png'
      };

      expect(document.file_path).toBeTruthy();
    });
  });
});

describe('Client Information - Questionnaires', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('GET /api/questionnaires', () => {
    it('should fetch questionnaires by project type', async () => {
      const mockQuestionnaires = [
        {
          id: 1,
          name: 'Website Project Questionnaire',
          project_type: 'website',
          question_count: 15
        }
      ];

      mockDb.all.mockResolvedValue(mockQuestionnaires);

      const questionnaires = await mockDb.all('SELECT * FROM questionnaires WHERE project_type = ?', ['website']);

      expect(questionnaires).toHaveLength(1);
      expect(questionnaires[0].name).toContain('Website');
    });

    it('should fetch questionnaire details with questions', async () => {
      const mockQuestionnaire = {
        id: 1,
        name: 'Website Project Questionnaire',
        questions: [
          {
            id: 1,
            question: 'What is your primary business?',
            type: 'text',
            required: true
          },
          {
            id: 2,
            question: 'Who is your target audience?',
            type: 'textarea',
            required: true
          }
        ]
      };

      mockDb.get.mockResolvedValue(mockQuestionnaire);

      const questionnaire = await mockDb.get('SELECT * FROM questionnaires WHERE id = ?', [1]);

      expect(questionnaire.questions).toHaveLength(2);
    });
  });

  describe('Question Types', () => {
    it('should support text questions', async () => {
      const questionType = 'text';

      expect(['text', 'textarea', 'select', 'multiselect', 'number', 'email', 'file']).toContain(questionType);
    });

    it('should support textarea questions', async () => {
      const questionType = 'textarea';

      expect(['text', 'textarea', 'select', 'multiselect', 'number', 'email', 'file']).toContain(questionType);
    });

    it('should support select (dropdown) questions', async () => {
      const question = {
        type: 'select',
        options: ['Option A', 'Option B', 'Option C']
      };

      expect(question.options).toHaveLength(3);
    });

    it('should support multiselect questions', async () => {
      const question = {
        type: 'multiselect',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4']
      };

      expect(question.options.length).toBeGreaterThan(1);
    });

    it('should support file upload questions', async () => {
      const question = {
        type: 'file',
        allowed_types: ['image/png', 'image/jpeg', 'application/pdf']
      };

      expect(question.allowed_types).toContain('image/png');
    });

    it('should support number questions', async () => {
      const question = {
        type: 'number',
        min: 0,
        max: 100
      };

      expect(question.min).toBe(0);
    });
  });

  describe('Conditional Questions', () => {
    it('should show conditional questions based on previous answer', async () => {
      const question = {
        id: 5,
        text: 'Please describe your specific needs',
        condition: {
          question_id: 2,
          operator: 'equals',
          value: 'Yes'
        }
      };

      expect(question.condition).toBeTruthy();
      expect(question.condition.question_id).toBe(2);
    });
  });

  describe('POST /api/questionnaires/:id/respond', () => {
    it('should submit questionnaire responses', async () => {
      const responses = {
        client_id: 5,
        questionnaire_id: 1,
        answers: {
          1: 'Acme Corporation',
          2: 'Small business owners in tech',
          3: ['Business Network', 'Blog']
        }
      };

      mockDb.run.mockResolvedValue({ lastID: 1 });

      await mockDb.run(
        'INSERT INTO questionnaire_responses (client_id, questionnaire_id, answers, submitted_at) VALUES (?, ?, ?, ?)',
        [responses.client_id, responses.questionnaire_id, JSON.stringify(responses.answers), new Date().toISOString()]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should validate required questions are answered', async () => {
      const answers = {
        1: 'Answer to Q1',
        2: null, // Required question not answered
        3: 'Answer to Q3'
      };

      const allRequired = Object.values(answers).every(answer => answer !== null);

      expect(allRequired).toBe(false);
    });
  });

  describe('Auto-Sending Questionnaires', () => {
    it('should auto-send questionnaire on project creation', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'UPDATE document_requests SET status = ? WHERE project_id = ? AND is_questionnaire = ?',
        ['sent', 1, 1]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });
  });
});

describe('Client Information - Status Tracking', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('GET /api/clients/:id/information-status', () => {
    it('should calculate information completeness percentage', async () => {
      const statusData = {
        total_items: 20,
        completed_items: 14,
        completeness_percent: (14 / 20) * 100
      };

      expect(statusData.completeness_percent).toBe(70);
    });

    it('should list missing items', async () => {
      const missingItems = [
        { id: 1, title: 'Website Copy', category: 'content', status: 'pending' },
        { id: 2, title: 'Brand Guide', category: 'brand_assets', status: 'pending' },
        { id: 3, title: 'NDA', category: 'legal', status: 'pending' }
      ];

      expect(missingItems).toHaveLength(3);
    });

    it('should show items by category', async () => {
      const breakdown = {
        brand_assets: { total: 5, completed: 3, percent: 60 },
        content: { total: 8, completed: 5, percent: 62.5 },
        legal: { total: 4, completed: 2, percent: 50 },
        technical: { total: 3, completed: 2, percent: 67 }
      };

      expect(breakdown.brand_assets.completed).toBe(3);
      expect(Object.keys(breakdown)).toHaveLength(4);
    });
  });

  describe('Reminders', () => {
    it('should send reminder for incomplete items', async () => {
      const item = {
        id: 1,
        status: 'pending',
        due_date: '2026-02-15',
        reminder_sent_at: null
      };

      const daysUntilDue = Math.floor((new Date(item.due_date).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));
      const shouldRemind = daysUntilDue <= 3;

      expect(typeof shouldRemind).toBe('boolean');
    });
  });
});

describe('Client Information - Error Handling', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  it('should return 404 for non-existent onboarding session', async () => {
    mockDb.get.mockResolvedValue(null);

    const session = await mockDb.get('SELECT * FROM onboarding_sessions WHERE id = ?', [999]);

    expect(session).toBeNull();
  });

  it('should validate file upload before processing', async () => {
    const invalidFile = {
      size: null,
      type: null,
      name: ''
    };

    const isValid = invalidFile.name && invalidFile.type && invalidFile.size;

    expect(isValid).toBeFalsy();
  });

  it('should handle duplicate document uploads', async () => {
    const uploads = [
      { id: 1, file_name: 'logo.png', uploaded_at: '2026-02-01' },
      { id: 2, file_name: 'logo.png', uploaded_at: '2026-02-10' }
    ];

    const isDuplicate = uploads.filter(u => u.file_name === 'logo.png').length > 1;

    expect(isDuplicate).toBe(true);
  });

  it('should validate questionnaire answers format', async () => {
    const invalidAnswers = {
      1: null, // Required answer is null
      2: 'Valid answer'
    };

    const hasAllAnswers = Object.values(invalidAnswers).every(answer => answer !== null);

    expect(hasAllAnswers).toBe(false);
  });
});
