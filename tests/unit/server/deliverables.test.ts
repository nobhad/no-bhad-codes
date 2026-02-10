import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeliverableService } from '../../../server/services/deliverable-service';

describe('Deliverable Service', () => {
  let mockDb: any;
  let service: DeliverableService;

  beforeEach(() => {
    mockDb = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    };
    service = new DeliverableService(mockDb);
  });

  describe('Deliverable CRUD Operations', () => {
    it('should create a new deliverable', async () => {
      const result = { lastID: 1 };
      mockDb.run.mockResolvedValueOnce(result);
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 100,
        type: 'design',
        title: 'Homepage Design',
        description: 'Main page design mockups',
        status: 'draft',
        approval_status: 'pending',
        round_number: 1,
        created_by_id: 1,
        reviewed_by_id: null,
        review_deadline: null,
        approved_at: null,
        locked: 0,
        tags: 'design,final',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      const deliverable = await service.createDeliverable(
        100,
        'Homepage Design',
        'Main page design mockups',
        'design',
        1,
        { tags: 'design,final' }
      );

      expect(deliverable).toMatchObject({
        id: 1,
        title: 'Homepage Design',
        status: 'draft'
      });
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should retrieve deliverable by ID', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 100,
        type: 'design',
        title: 'Logo Design',
        description: 'Logo concepts',
        status: 'pending_review',
        approval_status: 'pending',
        round_number: 1,
        created_by_id: 1,
        reviewed_by_id: null,
        review_deadline: null,
        approved_at: null,
        locked: 0,
        tags: '',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      const deliverable = await service.getDeliverableById(1);

      expect(deliverable).not.toBeNull();
      expect(deliverable?.title).toBe('Logo Design');
      expect(mockDb.get).toHaveBeenCalledWith('SELECT * FROM deliverables WHERE id = ?', [1]);
    });

    it('should list project deliverables with pagination', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 10 });
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          project_id: 100,
          type: 'design',
          title: 'Design 1',
          status: 'approved',
          approval_status: 'approved',
          round_number: 1,
          created_by_id: 1,
          reviewed_by_id: 2,
          locked: 1,
          description: '',
          review_deadline: null,
          approved_at: '2026-02-10T13:00:00.000Z',
          tags: '',
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T13:00:00.000Z'
        }
      ]);

      const result = await service.getProjectDeliverables(100, { limit: 50, offset: 0 });

      expect(result.total).toBe(10);
      expect(result.deliverables).toHaveLength(1);
      expect(result.deliverables[0].locked).toBe(true);
    });

    it('should filter deliverables by status', async () => {
      mockDb.get.mockResolvedValueOnce({ count: 3 });
      mockDb.all.mockResolvedValueOnce([
        {
          id: 2,
          project_id: 100,
          type: 'design',
          title: 'Revision Design',
          status: 'revision_requested',
          approval_status: 'revision_needed',
          round_number: 2,
          created_by_id: 1,
          reviewed_by_id: 2,
          locked: 0,
          description: '',
          review_deadline: null,
          approved_at: null,
          tags: '',
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z'
        }
      ]);

      const result = await service.getProjectDeliverables(100, { status: 'revision_requested' });

      expect(result.deliverables).toHaveLength(1);
      expect(result.deliverables[0].approval_status).toBe('revision_needed');
    });

    it('should update deliverable', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 100,
        type: 'design',
        title: 'Old Title',
        description: 'Old desc',
        status: 'draft',
        approval_status: 'pending',
        round_number: 1,
        created_by_id: 1,
        reviewed_by_id: null,
        review_deadline: null,
        approved_at: null,
        locked: 0,
        tags: '',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 100,
        type: 'design',
        title: 'New Title',
        description: 'New description',
        status: 'pending_review',
        approval_status: 'pending',
        round_number: 1,
        created_by_id: 1,
        reviewed_by_id: null,
        review_deadline: null,
        approved_at: null,
        locked: 0,
        tags: '',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:01:00.000Z'
      });

      const deliverable = await service.updateDeliverable(1, {
        title: 'New Title',
        description: 'New description',
        status: 'pending_review'
      });

      expect(deliverable.title).toBe('New Title');
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should lock deliverable (approve)', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 100,
        type: 'design',
        title: 'Final Design',
        status: 'approved',
        approval_status: 'approved',
        round_number: 1,
        created_by_id: 1,
        reviewed_by_id: 2,
        locked: 1,
        description: '',
        review_deadline: null,
        approved_at: '2026-02-10T13:00:00.000Z',
        tags: '',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T13:00:00.000Z'
      });

      const deliverable = await service.lockDeliverable(1, 2);

      expect(deliverable.locked).toBe(true);
      expect(deliverable.approval_status).toBe('approved');
      expect(deliverable.reviewed_by_id).toBe(2);
    });

    it('should request revision', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 100,
        type: 'design',
        title: 'Design',
        status: 'revision_requested',
        approval_status: 'revision_needed',
        round_number: 2,
        created_by_id: 1,
        reviewed_by_id: 2,
        locked: 0,
        description: '',
        review_deadline: null,
        approved_at: null,
        tags: '',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      const deliverable = await service.requestRevision(1, 'Needs color adjustments', 2);

      expect(deliverable.status).toBe('revision_requested');
      expect(deliverable.approval_status).toBe('revision_needed');
    });
  });

  describe('Version Management', () => {
    it('should upload new version', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 100,
        type: 'design',
        title: 'Design',
        status: 'pending_review', // Not draft, so updateDeliverable won't be called
        approval_status: 'pending',
        round_number: 1,
        created_by_id: 1,
        reviewed_by_id: null,
        review_deadline: null,
        approved_at: null,
        locked: 0,
        description: '',
        tags: '',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      mockDb.get.mockResolvedValueOnce({ max_version: null }); // First version
      mockDb.run.mockResolvedValueOnce({ lastID: 1 }); // Insert version
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        version_number: 1,
        file_path: '/uploads/design-v1.psd',
        file_name: 'design-v1.psd',
        file_size: 5242880,
        file_type: 'application/x-photoshop',
        uploaded_by_id: 1,
        change_notes: 'Initial design',
        created_at: '2026-02-10T12:00:00.000Z'
      }); // Get version by ID

      const version = await service.uploadVersion(1, '/uploads/design-v1.psd', 'design-v1.psd', 5242880, 'application/x-photoshop', 1, 'Initial design');

      expect(version.version_number).toBe(1);
      expect(version.file_name).toBe('design-v1.psd');
    });

    it('should increment version numbers', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 100,
        status: 'pending_review',
        title: '',
        description: '',
        type: '',
        approval_status: '',
        round_number: 0,
        created_by_id: 0,
        reviewed_by_id: null,
        review_deadline: null,
        approved_at: null,
        locked: 0,
        tags: '',
        created_at: '',
        updated_at: ''
      });

      mockDb.get.mockResolvedValueOnce({ max_version: 2 }); // Already has 2 versions

      // First mockDb call for version upload, second for latest version
      mockDb.run.mockResolvedValueOnce({ lastID: 3 });
      mockDb.get.mockResolvedValueOnce({
        id: 3,
        deliverable_id: 1,
        version_number: 3,
        file_path: '/uploads/design-v3.psd',
        file_name: 'design-v3.psd',
        file_size: 5242880,
        file_type: 'application/x-photoshop',
        uploaded_by_id: 1,
        change_notes: 'Updated colors',
        created_at: '2026-02-10T12:05:00.000Z'
      });

      const version = await service.uploadVersion(1, '/uploads/design-v3.psd', 'design-v3.psd', 5242880, 'application/x-photoshop', 1, 'Updated colors');

      expect(version.version_number).toBe(3);
    });

    it('should get latest version', async () => {
      mockDb.get.mockResolvedValueOnce({
        id: 5,
        deliverable_id: 1,
        version_number: 3,
        file_path: '/uploads/design-v3.psd',
        file_name: 'design-v3.psd',
        file_size: 5242880,
        file_type: 'application/x-photoshop',
        uploaded_by_id: 1,
        change_notes: 'Latest version',
        created_at: '2026-02-10T12:05:00.000Z'
      });

      const version = await service.getLatestVersion(1);

      expect(version?.version_number).toBe(3);
      expect(version?.file_name).toBe('design-v3.psd');
    });
  });

  describe('Comments & Annotations', () => {
    it('should add comment', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        author_id: 2,
        comment_text: 'The color scheme is too bright',
        x_position: 150,
        y_position: 200,
        annotation_type: 'highlight',
        element_id: 'logo',
        resolved: 0,
        resolved_at: null,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      const comment = await service.addComment(1, 2, 'The color scheme is too bright', {
        x: 150,
        y: 200,
        annotationType: 'highlight',
        elementId: 'logo'
      });

      expect(comment.comment_text).toBe('The color scheme is too bright');
      expect(comment.annotation_type).toBe('highlight');
      expect(comment.resolved).toBe(false);
    });

    it('should get comments with filtering', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          deliverable_id: 1,
          author_id: 2,
          comment_text: 'Needs revision',
          x_position: null,
          y_position: null,
          annotation_type: 'text',
          element_id: 'logo',
          resolved: 0,
          resolved_at: null,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z'
        }
      ]);

      const comments = await service.getDeliverableComments(1, { elementId: 'logo' });

      expect(comments).toHaveLength(1);
      expect(comments[0].element_id).toBe('logo');
    });

    it('should resolve comment', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        author_id: 2,
        comment_text: 'Fixed',
        x_position: null,
        y_position: null,
        annotation_type: 'text',
        element_id: null,
        resolved: 1,
        resolved_at: '2026-02-10T12:05:00.000Z',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:05:00.000Z'
      });

      const comment = await service.resolveComment(1);

      expect(comment.resolved).toBe(true);
      expect(comment.resolved_at).not.toBeNull();
    });
  });

  describe('Design Elements', () => {
    it('should create design element', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        name: 'logo',
        description: 'Company logo design',
        approval_status: 'pending',
        revision_count: 0,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:00:00.000Z'
      });

      const element = await service.createDesignElement(1, 'logo', 'Company logo design');

      expect(element.name).toBe('logo');
      expect(element.approval_status).toBe('pending');
    });

    it('should get all design elements', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          deliverable_id: 1,
          name: 'logo',
          description: 'Logo',
          approval_status: 'pending',
          revision_count: 0,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z'
        },
        {
          id: 2,
          deliverable_id: 1,
          name: 'homepage',
          description: 'Homepage',
          approval_status: 'approved',
          revision_count: 1,
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z'
        }
      ]);

      const elements = await service.getDeliverableElements(1);

      expect(elements).toHaveLength(2);
      expect(elements[0].name).toBe('logo');
      expect(elements[1].revision_count).toBe(1);
    });

    it('should update element approval status', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        name: 'logo',
        description: 'Logo',
        approval_status: 'approved',
        revision_count: 0,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:01:00.000Z'
      });

      const element = await service.updateElementApprovalStatus(1, 'approved');

      expect(element.approval_status).toBe('approved');
    });

    it('should increment revision count on revision_needed', async () => {
      mockDb.run.mockResolvedValueOnce(undefined);
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        name: 'logo',
        description: 'Logo',
        approval_status: 'revision_needed',
        revision_count: 1,
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-10T12:01:00.000Z'
      });

      const element = await service.updateElementApprovalStatus(1, 'revision_needed');

      expect(element.approval_status).toBe('revision_needed');
      expect(element.revision_count).toBe(1);
    });
  });

  describe('Reviews', () => {
    it('should create review', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        deliverable_id: 1,
        reviewer_id: 2,
        decision: 'revision_needed',
        feedback: 'Colors need adjustment',
        design_elements_reviewed: '[1,2]',
        review_duration_minutes: 15,
        created_at: '2026-02-10T12:00:00.000Z'
      });

      const review = await service.createReview(1, 2, 'revision_needed', 'Colors need adjustment', [1, 2]);

      expect(review.decision).toBe('revision_needed');
      expect(review.feedback).toBe('Colors need adjustment');
      expect(review.design_elements_reviewed).toEqual([1, 2]);
    });

    it('should get all reviews', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          deliverable_id: 1,
          reviewer_id: 2,
          decision: 'revision_needed',
          feedback: 'Round 1 feedback',
          design_elements_reviewed: '[]',
          review_duration_minutes: null,
          created_at: '2026-02-10T12:00:00.000Z'
        },
        {
          id: 2,
          deliverable_id: 1,
          reviewer_id: 3,
          decision: 'approved',
          feedback: 'Round 2 approved',
          design_elements_reviewed: '[]',
          review_duration_minutes: null,
          created_at: '2026-02-10T13:00:00.000Z'
        }
      ]);

      const reviews = await service.getDeliverableReviews(1);

      expect(reviews).toHaveLength(2);
      expect(reviews[0].decision).toBe('revision_needed');
      expect(reviews[1].decision).toBe('approved');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent deliverable', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const deliverable = await service.getDeliverableById(999);

      expect(deliverable).toBeNull();
    });

    it('should handle update of non-existent deliverable', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      try {
        await service.updateDeliverable(999, { title: 'Test' });
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('should handle retrieval errors gracefully', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Database error'));

      try {
        await service.getDeliverableById(1);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
