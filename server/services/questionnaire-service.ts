/**
 * ===============================================
 * QUESTIONNAIRE SERVICE
 * ===============================================
 * @file server/services/questionnaire-service.ts
 *
 * Service for managing questionnaires and client responses.
 * Supports CRUD operations, sending to clients, and progress tracking.
 */

import { getDatabase } from '../database/init.js';
import { userService } from './user-service.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { BUSINESS_INFO, getPdfLogoBytes } from '../config/business.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// =====================================================
// TYPES
// =====================================================

export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'file';

export type ResponseStatus = 'pending' | 'in_progress' | 'completed';

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  required?: boolean;
  options?: string[];
  conditionalOn?: {
    questionId: string;
    value: string | string[];
  };
  placeholder?: string;
  helpText?: string;
}

export interface Questionnaire {
  id: number;
  name: string;
  description?: string;
  project_type?: string;
  questions: Question[];
  is_active: boolean;
  auto_send_on_project_create: boolean;
  display_order: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireResponse {
  id: number;
  questionnaire_id: number;
  client_id: number;
  project_id?: number;
  answers: Record<string, unknown>;
  status: ResponseStatus;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  reminder_count: number;
  reminder_sent_at?: string;
  exported_file_id?: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  questionnaire_name?: string;
  questionnaire_description?: string;
  client_name?: string;
  project_name?: string;
}

interface CreateQuestionnaireData {
  name: string;
  description?: string;
  project_type?: string;
  questions: Question[];
  is_active?: boolean;
  auto_send_on_project_create?: boolean;
  display_order?: number;
  created_by?: string;
}

interface SendQuestionnaireData {
  questionnaire_id: number;
  client_id: number;
  project_id?: number;
  due_date?: string;
}

// =====================================================
// SERVICE CLASS
// =====================================================

class QuestionnaireService {
  // =====================================================
  // QUESTIONNAIRE CRUD
  // =====================================================

  /**
   * Create a new questionnaire
   */
  async createQuestionnaire(data: CreateQuestionnaireData): Promise<Questionnaire> {
    const db = await getDatabase();

    // Look up user ID for created_by during transition period
    const createdByUserId = await userService.getUserIdByEmail(data.created_by);

    const result = await db.run(
      `INSERT INTO questionnaires
       (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        data.project_type || null,
        JSON.stringify(data.questions),
        data.is_active !== false ? 1 : 0,
        data.auto_send_on_project_create ? 1 : 0,
        data.display_order || 0,
        data.created_by || null,
        createdByUserId
      ]
    );

    return this.getQuestionnaire(result.lastID!) as Promise<Questionnaire>;
  }

  /**
   * Get a questionnaire by ID
   */
  async getQuestionnaire(id: number): Promise<Questionnaire | null> {
    const db = await getDatabase();

    const row = await db.get(
      'SELECT * FROM questionnaires WHERE id = ?',
      [id]
    );

    if (!row) return null;

    return this.mapQuestionnaireRow(row);
  }

  /**
   * Get all questionnaires, optionally filtered by project type
   */
  async getQuestionnaires(projectType?: string, activeOnly = false): Promise<Questionnaire[]> {
    const db = await getDatabase();

    let query = 'SELECT * FROM questionnaires WHERE 1=1';
    const params: (string | number)[] = [];

    if (projectType) {
      query += ' AND (project_type = ? OR project_type IS NULL)';
      params.push(projectType);
    }

    if (activeOnly) {
      query += ' AND is_active = 1';
    }

    query += ' ORDER BY display_order ASC, name ASC';

    const rows = await db.all(query, params);
    return rows.map(row => this.mapQuestionnaireRow(row));
  }

  /**
   * Update a questionnaire
   */
  async updateQuestionnaire(
    id: number,
    data: Partial<CreateQuestionnaireData>
  ): Promise<Questionnaire | null> {
    const db = await getDatabase();
    const existing = await this.getQuestionnaire(id);

    if (!existing) return null;

    await db.run(
      `UPDATE questionnaires
       SET name = ?,
           description = ?,
           project_type = ?,
           questions = ?,
           is_active = ?,
           auto_send_on_project_create = ?,
           display_order = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.name ?? existing.name,
        data.description !== undefined ? data.description : existing.description,
        data.project_type !== undefined ? data.project_type : existing.project_type,
        data.questions ? JSON.stringify(data.questions) : JSON.stringify(existing.questions),
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : (existing.is_active ? 1 : 0),
        data.auto_send_on_project_create !== undefined
          ? (data.auto_send_on_project_create ? 1 : 0)
          : (existing.auto_send_on_project_create ? 1 : 0),
        data.display_order ?? existing.display_order,
        id
      ]
    );

    return this.getQuestionnaire(id);
  }

  /**
   * Delete a questionnaire
   */
  async deleteQuestionnaire(id: number): Promise<void> {
    const db = await getDatabase();
    await db.run('DELETE FROM questionnaires WHERE id = ?', [id]);
  }

  // =====================================================
  // RESPONSE MANAGEMENT
  // =====================================================

  /**
   * Send a questionnaire to a client
   */
  async sendQuestionnaire(data: SendQuestionnaireData): Promise<QuestionnaireResponse> {
    const db = await getDatabase();

    const result = await db.run(
      `INSERT INTO questionnaire_responses
       (questionnaire_id, client_id, project_id, answers, status, due_date)
       VALUES (?, ?, ?, '{}', 'pending', ?)`,
      [
        data.questionnaire_id,
        data.client_id,
        data.project_id || null,
        data.due_date || null
      ]
    );

    return this.getResponse(result.lastID!) as Promise<QuestionnaireResponse>;
  }

  /**
   * Auto-send questionnaires for a project type
   */
  async sendQuestionnaireForProjectType(
    clientId: number,
    projectId: number,
    projectType: string
  ): Promise<QuestionnaireResponse[]> {
    const questionnaires = await this.getQuestionnaires(projectType, true);
    const autoSendQuestionnaires = questionnaires.filter(q => q.auto_send_on_project_create);

    const responses: QuestionnaireResponse[] = [];

    for (const questionnaire of autoSendQuestionnaires) {
      // Check if already sent
      const existing = await this.getClientResponseForQuestionnaire(clientId, questionnaire.id);
      if (existing) continue;

      const response = await this.sendQuestionnaire({
        questionnaire_id: questionnaire.id,
        client_id: clientId,
        project_id: projectId
      });

      responses.push(response);
    }

    return responses;
  }

  /**
   * Get a response by ID
   */
  async getResponse(id: number): Promise<QuestionnaireResponse | null> {
    const db = await getDatabase();

    const row = await db.get(
      `SELECT qr.*,
              q.name as questionnaire_name,
              q.description as questionnaire_description,
              COALESCE(c.company_name, c.contact_name) as client_name,
              p.project_name as project_name
       FROM questionnaire_responses qr
       LEFT JOIN questionnaires q ON qr.questionnaire_id = q.id
       LEFT JOIN clients c ON qr.client_id = c.id
       LEFT JOIN projects p ON qr.project_id = p.id
       WHERE qr.id = ?`,
      [id]
    );

    if (!row) return null;

    return this.mapResponseRow(row);
  }

  /**
   * Get all responses for a client
   */
  async getClientResponses(
    clientId: number,
    status?: ResponseStatus
  ): Promise<QuestionnaireResponse[]> {
    const db = await getDatabase();

    let query = `
      SELECT qr.*,
             q.name as questionnaire_name,
             q.description as questionnaire_description,
             p.project_name as project_name
      FROM questionnaire_responses qr
      LEFT JOIN questionnaires q ON qr.questionnaire_id = q.id
      LEFT JOIN projects p ON qr.project_id = p.id
      WHERE qr.client_id = ?
    `;
    const params: (number | string)[] = [clientId];

    if (status) {
      query += ' AND qr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY CASE WHEN qr.due_date IS NULL THEN 1 ELSE 0 END, qr.due_date ASC, qr.created_at DESC';

    const rows = await db.all(query, params);
    return rows.map(row => this.mapResponseRow(row));
  }

  /**
   * Get a client's response for a specific questionnaire
   */
  async getClientResponseForQuestionnaire(
    clientId: number,
    questionnaireId: number
  ): Promise<QuestionnaireResponse | null> {
    const db = await getDatabase();

    const row = await db.get(
      `SELECT qr.*,
              q.name as questionnaire_name,
              q.description as questionnaire_description
       FROM questionnaire_responses qr
       LEFT JOIN questionnaires q ON qr.questionnaire_id = q.id
       WHERE qr.client_id = ? AND qr.questionnaire_id = ?`,
      [clientId, questionnaireId]
    );

    if (!row) return null;

    return this.mapResponseRow(row);
  }

  /**
   * Get all pending responses (admin view)
   */
  async getPendingResponses(): Promise<QuestionnaireResponse[]> {
    const db = await getDatabase();

    const rows = await db.all(
      `SELECT qr.*,
              q.name as questionnaire_name,
              q.description as questionnaire_description,
              COALESCE(c.company_name, c.contact_name) as client_name,
              p.project_name as project_name
       FROM questionnaire_responses qr
       LEFT JOIN questionnaires q ON qr.questionnaire_id = q.id
       LEFT JOIN clients c ON qr.client_id = c.id
       LEFT JOIN projects p ON qr.project_id = p.id
       WHERE qr.status IN ('pending', 'in_progress')
       ORDER BY
         CASE WHEN qr.due_date IS NULL THEN 1 ELSE 0 END,
         qr.due_date ASC,
         qr.created_at DESC`
    );

    return rows.map(row => this.mapResponseRow(row));
  }

  /**
   * Save progress on a questionnaire response
   */
  async saveProgress(
    responseId: number,
    answers: Record<string, unknown>
  ): Promise<QuestionnaireResponse> {
    const db = await getDatabase();
    const response = await this.getResponse(responseId);

    if (!response) {
      throw new Error('Response not found');
    }

    // Merge with existing answers
    const mergedAnswers = { ...response.answers, ...answers };

    // Set started_at if not already set
    const startedAt = response.started_at || new Date().toISOString();

    await db.run(
      `UPDATE questionnaire_responses
       SET answers = ?,
           status = 'in_progress',
           started_at = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(mergedAnswers), startedAt, responseId]
    );

    return this.getResponse(responseId) as Promise<QuestionnaireResponse>;
  }

  /**
   * Submit a completed questionnaire response
   */
  async submitResponse(
    responseId: number,
    answers: Record<string, unknown>
  ): Promise<QuestionnaireResponse> {
    const db = await getDatabase();
    const response = await this.getResponse(responseId);

    if (!response) {
      throw new Error('Response not found');
    }

    // Merge with existing answers
    const mergedAnswers = { ...response.answers, ...answers };

    await db.run(
      `UPDATE questionnaire_responses
       SET answers = ?,
           status = 'completed',
           started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(mergedAnswers), responseId]
    );

    return this.getResponse(responseId) as Promise<QuestionnaireResponse>;
  }

  /**
   * Send reminder for a questionnaire response
   */
  async sendReminder(responseId: number): Promise<QuestionnaireResponse> {
    const db = await getDatabase();
    const response = await this.getResponse(responseId);

    if (!response) {
      throw new Error('Response not found');
    }

    await db.run(
      `UPDATE questionnaire_responses
       SET reminder_sent_at = CURRENT_TIMESTAMP,
           reminder_count = reminder_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [responseId]
    );

    return this.getResponse(responseId) as Promise<QuestionnaireResponse>;
  }

  /**
   * Delete a questionnaire response
   */
  async deleteResponse(responseId: number): Promise<void> {
    const db = await getDatabase();
    await db.run('DELETE FROM questionnaire_responses WHERE id = ?', [responseId]);
  }

  // =====================================================
  // STATS
  // =====================================================

  /**
   * Get questionnaire stats for a client
   */
  async getClientStats(clientId: number): Promise<{
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  }> {
    const db = await getDatabase();

    const stats = await db.get(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM questionnaire_responses
       WHERE client_id = ?`,
      [clientId]
    ) as { total: number; pending: number; in_progress: number; completed: number };

    return {
      total: stats?.total || 0,
      pending: stats?.pending || 0,
      in_progress: stats?.in_progress || 0,
      completed: stats?.completed || 0
    };
  }

  // =====================================================
  // HELPERS
  // =====================================================

  /**
   * Map a questionnaire database row to typed object
   */
  private mapQuestionnaireRow(row: Record<string, unknown>): Questionnaire {
    return {
      id: row.id as number,
      name: row.name as string,
      description: row.description as string | undefined,
      project_type: row.project_type as string | undefined,
      questions: typeof row.questions === 'string'
        ? JSON.parse(row.questions)
        : row.questions as Question[],
      is_active: Boolean(row.is_active),
      auto_send_on_project_create: Boolean(row.auto_send_on_project_create),
      display_order: row.display_order as number,
      created_by: row.created_by as string | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    };
  }

  /**
   * Map a response database row to typed object
   */
  private mapResponseRow(row: Record<string, unknown>): QuestionnaireResponse {
    return {
      id: row.id as number,
      questionnaire_id: row.questionnaire_id as number,
      client_id: row.client_id as number,
      project_id: row.project_id as number | undefined,
      answers: typeof row.answers === 'string'
        ? JSON.parse(row.answers)
        : row.answers as Record<string, unknown>,
      status: row.status as ResponseStatus,
      started_at: row.started_at as string | undefined,
      completed_at: row.completed_at as string | undefined,
      due_date: row.due_date as string | undefined,
      reminder_count: row.reminder_count as number,
      reminder_sent_at: row.reminder_sent_at as string | undefined,
      exported_file_id: row.exported_file_id as number | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      questionnaire_name: row.questionnaire_name as string | undefined,
      questionnaire_description: row.questionnaire_description as string | undefined,
      client_name: row.client_name as string | undefined,
      project_name: row.project_name as string | undefined
    };
  }

  // =====================================================
  // PDF GENERATION
  // =====================================================

  /**
   * Generate PDF of questionnaire Q&A responses
   */
  async generateQuestionnairePdf(responseId: number): Promise<Uint8Array> {
    const response = await this.getResponse(responseId);
    if (!response) {
      throw new Error('Response not found');
    }

    const questionnaire = await this.getQuestionnaire(response.questionnaire_id);
    if (!questionnaire) {
      throw new Error('Questionnaire not found');
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // Set metadata
    const clientName = response.client_name || 'Client';
    const pdfTitle = `${questionnaire.name} - ${clientName}`;
    pdfDoc.setTitle(pdfTitle);
    pdfDoc.setAuthor(BUSINESS_INFO.name);
    pdfDoc.setSubject('Questionnaire Response');
    pdfDoc.setCreator('NoBhadCodes');

    // Create first page
    let page = pdfDoc.addPage([612, 792]); // LETTER size
    const { width, height } = page.getSize();

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const black = rgb(0, 0, 0);
    const lightGray = rgb(0.5, 0.5, 0.5);
    const lineGray = rgb(0.8, 0.8, 0.8);
    const questionColor = rgb(0.2, 0.2, 0.2);

    // Layout constants
    const leftMargin = 54;
    const rightMargin = width - 54;
    const contentWidth = rightMargin - leftMargin;
    const lineHeight = 14;
    const bottomMargin = 72;

    // Start position
    let y = height - 43;

    // === HEADER - Title on left, logo and business info on right ===
    const logoHeight = 100;

    // Title on left
    page.drawText('QUESTIONNAIRE', {
      x: leftMargin,
      y: y - 20,
      size: 24,
      font: helveticaBold,
      color: rgb(0.15, 0.15, 0.15)
    });

    // Logo and business info on right
    let textStartX = rightMargin - 180;
    const logoBytes = getPdfLogoBytes();
    if (logoBytes) {
      try {
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
        const logoX = rightMargin - logoWidth - 150;
        page.drawImage(logoImage, {
          x: logoX,
          y: y - logoHeight + 10,
          width: logoWidth,
          height: logoHeight
        });
        textStartX = logoX + logoWidth + 18;
      } catch {
        // Skip logo if embedding fails
      }
    }

    // Business info
    page.drawText(BUSINESS_INFO.name, { x: textStartX, y: y - 11, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(BUSINESS_INFO.owner, { x: textStartX, y: y - 34, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(BUSINESS_INFO.tagline, { x: textStartX, y: y - 54, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.email, { x: textStartX, y: y - 70, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.website, { x: textStartX, y: y - 86, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    y -= 120;

    // Divider line
    page.drawLine({
      start: { x: leftMargin, y: y },
      end: { x: rightMargin, y: y },
      thickness: 1,
      color: lineGray
    });
    y -= 25;

    // === META INFO ===
    // Questionnaire name
    page.drawText(questionnaire.name.toUpperCase(), {
      x: leftMargin,
      y: y,
      size: 12,
      font: helveticaBold,
      color: black
    });
    y -= 18;

    if (questionnaire.description) {
      page.drawText(questionnaire.description, {
        x: leftMargin,
        y: y,
        size: 10,
        font: helvetica,
        color: lightGray
      });
      y -= 16;
    }

    // Client and date info
    y -= 8;
    page.drawText(`Client: ${clientName}`, {
      x: leftMargin,
      y: y,
      size: 10,
      font: helvetica,
      color: black
    });

    const completedDate = response.completed_at
      ? new Date(response.completed_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      : 'In Progress';
    page.drawText(`Completed: ${completedDate}`, {
      x: leftMargin + 200,
      y: y,
      size: 10,
      font: helvetica,
      color: black
    });

    if (response.project_name) {
      y -= 14;
      page.drawText(`Project: ${response.project_name}`, {
        x: leftMargin,
        y: y,
        size: 10,
        font: helvetica,
        color: black
      });
    }

    y -= 30;

    // Content separator
    page.drawLine({
      start: { x: leftMargin, y: y },
      end: { x: rightMargin, y: y },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9)
    });
    y -= 25;

    // Helper to sanitize text for PDF
    const sanitizeForPdf = (text: string): string => {
      return text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    };

    // Helper to draw wrapped text and return new Y position
    const drawWrappedText = (
      text: string,
      startY: number,
      fontSize: number,
      font: typeof helvetica,
      color: ReturnType<typeof rgb>,
      indent: number = 0
    ): number => {
      const sanitized = sanitizeForPdf(text);
      const words = sanitized.split(' ');
      let line = '';
      const maxWidth = contentWidth - indent;
      let currentY = startY;

      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && line) {
          // Check if we need a new page
          if (currentY - lineHeight < bottomMargin) {
            // Add new page
            page = pdfDoc.addPage([612, 792]);
            currentY = height - 54;
          }
          page.drawText(line, { x: leftMargin + indent, y: currentY, size: fontSize, font, color });
          currentY -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        if (currentY - lineHeight < bottomMargin) {
          page = pdfDoc.addPage([612, 792]);
          currentY = height - 54;
        }
        page.drawText(line, { x: leftMargin + indent, y: currentY, size: fontSize, font, color });
        currentY -= lineHeight;
      }
      return currentY;
    };

    // === QUESTIONS AND ANSWERS ===
    let questionNumber = 1;
    for (const question of questionnaire.questions) {
      // Check if we need a new page (need at least 60pt for Q&A)
      if (y - 60 < bottomMargin) {
        page = pdfDoc.addPage([612, 792]);
        y = height - 54;
      }

      // Question number and text
      const questionPrefix = `Q${questionNumber}. `;
      page.drawText(questionPrefix, {
        x: leftMargin,
        y: y,
        size: 10,
        font: helveticaBold,
        color: questionColor
      });

      const prefixWidth = helveticaBold.widthOfTextAtSize(questionPrefix, 10);
      y = drawWrappedText(
        question.question,
        y,
        10,
        helveticaBold,
        questionColor,
        prefixWidth
      );

      y -= 4;

      // Answer
      const answer = response.answers[question.id];
      let answerText = 'No answer provided';

      if (answer !== undefined && answer !== null && answer !== '') {
        if (Array.isArray(answer)) {
          answerText = answer.join(', ');
        } else {
          answerText = String(answer);
        }
      }

      y = drawWrappedText(answerText, y, 10, helvetica, black, 20);

      y -= 20; // Space between Q&A pairs
      questionNumber++;
    }

    // === FOOTER on all pages ===
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      // Footer line
      p.drawLine({
        start: { x: leftMargin, y: bottomMargin },
        end: { x: rightMargin, y: bottomMargin },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8)
      });

      // Footer text
      const footerText = `${BUSINESS_INFO.name} - ${BUSINESS_INFO.email} - ${BUSINESS_INFO.website}`;
      const footerWidth = helvetica.widthOfTextAtSize(footerText, 7);
      p.drawText(footerText, {
        x: (width - footerWidth) / 2,
        y: bottomMargin - 18,
        size: 7,
        font: helvetica,
        color: lightGray
      });

      // Page numbers
      if (totalPages > 1) {
        const pageText = `Page ${i + 1} of ${totalPages}`;
        const pageTextWidth = helvetica.widthOfTextAtSize(pageText, 8);
        p.drawText(pageText, {
          x: rightMargin - pageTextWidth,
          y: bottomMargin - 18,
          size: 8,
          font: helvetica,
          color: lightGray
        });
      }
    }

    return pdfDoc.save();
  }

  /**
   * Save questionnaire PDF to project files
   * Returns the created file ID
   */
  async saveQuestionnairePdfToFiles(responseId: number): Promise<number> {
    const db = await getDatabase();

    const response = await this.getResponse(responseId);
    if (!response) {
      throw new Error('Response not found');
    }

    if (!response.project_id) {
      throw new Error('Cannot save PDF: questionnaire has no associated project');
    }

    const questionnaire = await this.getQuestionnaire(response.questionnaire_id);
    if (!questionnaire) {
      throw new Error('Questionnaire not found');
    }

    // Generate PDF
    const pdfBytes = await this.generateQuestionnairePdf(responseId);

    // Create filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const safeQuestionnaireName = questionnaire.name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .substring(0, 30);
    const filename = `questionnaire_${safeQuestionnaireName}_${timestamp}.pdf`;
    const originalFilename = `${questionnaire.name} - ${response.client_name || 'Client'}.pdf`;

    // Ensure uploads/forms directory exists
    const uploadsDir = join(process.cwd(), 'uploads', 'forms');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    // Save PDF file to disk
    const filePath = join('uploads', 'forms', filename);
    const fullPath = join(process.cwd(), filePath);
    writeFileSync(fullPath, Buffer.from(pdfBytes));

    // Get or create Forms folder for the project
    const formsFolderRow = await db.get(
      'SELECT id FROM file_folders WHERE project_id = ? AND name = \'Forms\'',
      [response.project_id]
    ) as { id: number } | undefined;

    let formsFolderId: number;
    if (!formsFolderRow) {
      const folderResult = await db.run(
        `INSERT INTO file_folders (project_id, name, description, color, icon, sort_order, created_by)
         VALUES (?, 'Forms', 'Questionnaires, intake forms, and other forms', '#8b5cf6', 'file-text', 1, 'system')`,
        [response.project_id]
      );
      formsFolderId = folderResult.lastID!;
    } else {
      formsFolderId = formsFolderRow.id;
    }

    // Insert file record (NOT shared by default)
    const fileResult = await db.run(
      `INSERT INTO files (
        project_id, folder_id, filename, original_filename, file_path,
        file_size, mime_type, file_type, category, uploaded_by, description, shared_with_client
      ) VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', 'document', 'document', 'system', ?, FALSE)`,
      [
        response.project_id,
        formsFolderId,
        filename,
        originalFilename,
        filePath,
        pdfBytes.length,
        `Questionnaire response: ${questionnaire.name}`
      ]
    );

    const fileId = fileResult.lastID!;

    // Update questionnaire response with exported file ID
    await db.run(
      'UPDATE questionnaire_responses SET exported_file_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [fileId, responseId]
    );

    return fileId;
  }

  /**
   * Export questionnaire response as raw JSON data
   * Returns JSON string of the response data
   */
  async exportQuestionnaireJson(responseId: number): Promise<string> {
    const response = await this.getResponse(responseId);
    if (!response) {
      throw new Error('Response not found');
    }

    const questionnaire = await this.getQuestionnaire(response.questionnaire_id);
    if (!questionnaire) {
      throw new Error('Questionnaire not found');
    }

    // Build structured export data
    const exportData = {
      questionnaire: {
        id: questionnaire.id,
        name: questionnaire.name,
        description: questionnaire.description,
        project_type: questionnaire.project_type
      },
      response: {
        id: response.id,
        client_id: response.client_id,
        client_name: response.client_name,
        project_id: response.project_id,
        project_name: response.project_name,
        status: response.status,
        started_at: response.started_at,
        completed_at: response.completed_at
      },
      questions_and_answers: questionnaire.questions.map(q => ({
        question_id: q.id,
        question_type: q.type,
        question_text: q.question,
        required: q.required || false,
        options: q.options,
        answer: response.answers[q.id] ?? null
      })),
      exported_at: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }
}

// Export singleton instance
export const questionnaireService = new QuestionnaireService();
