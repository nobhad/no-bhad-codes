/**
 * ===============================================
 * DYNAMIC QUESTIONNAIRE SERVICE
 * ===============================================
 * @file server/services/dynamic-questionnaire-service.ts
 *
 * Auto-generates personalized questionnaires based on what
 * information is missing for a project. Used when clients
 * contact via email instead of filling out the intake form.
 *
 * The service maintains a QUESTION BANK -- a catalog of all
 * possible questions mapped to intake fields. When generating
 * a questionnaire, it:
 *   1. Checks what data already exists on the project/client
 *   2. Includes ALL questions -- pre-fills collected data so client can review/edit
 *   3. Only REQUIRES answers on fields that are truly missing
 *   4. Creates a questionnaire record with questions as JSON
 *   5. Creates a response record with pre-filled answers
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';

// =====================================================
// TYPES
// =====================================================

type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'number' | 'url';
type QuestionPriority = 'essential' | 'important' | 'nice_to_have';
type QuestionCategory = 'about_you' | 'project_details' | 'design' | 'content' | 'technical' | 'billing';

interface QuestionBankEntry {
  field: string;
  question: string;
  type: QuestionType;
  options?: string[];
  category: QuestionCategory;
  priority: QuestionPriority;
  helpText?: string;
  placeholder?: string;
}

/** Shape of a question object stored in the questionnaires.questions JSON column */
interface QuestionnaireQuestion {
  id: string;
  type: QuestionType;
  question: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  fieldMapping?: string;
  category?: string;
  priority?: string;
  prefilled?: boolean;
}

interface GenerateResult {
  questionnaireId: number;
  responseId: number;
  questionCount: number;
  prefilledCount: number;
  missingCount: number;
  categories: string[];
}

// =====================================================
// PRIORITY SORT ORDER
// =====================================================

const PRIORITY_ORDER: Record<QuestionPriority, number> = {
  essential: 0,
  important: 1,
  nice_to_have: 2
};

// =====================================================
// QUESTION BANK
// =====================================================
// Comprehensive catalog of all possible questions mapped
// to project and client fields. Each entry specifies which
// database field it collects data for.

const QUESTION_BANK: QuestionBankEntry[] = [
  // === ABOUT YOU ===
  {
    field: 'company_name',
    question: 'What is your business or organization name?',
    type: 'text',
    category: 'about_you',
    priority: 'essential'
  },
  {
    field: 'phone',
    question: 'What is the best phone number to reach you?',
    type: 'text',
    category: 'about_you',
    priority: 'important',
    helpText: 'For quick questions during the project'
  },
  {
    field: 'referral_source',
    question: 'How did you hear about us?',
    type: 'select',
    options: [
      'Google search',
      'Social media',
      'Referral from a friend/colleague',
      'Saw your portfolio',
      'Other'
    ],
    category: 'about_you',
    priority: 'nice_to_have'
  },

  // === PROJECT DETAILS ===
  {
    field: 'project_type',
    question: 'What type of project are you looking for?',
    type: 'select',
    options: [
      'Simple Website (1-5 pages)',
      'Business Website (5-15 pages)',
      'Portfolio / Creative Site',
      'Online Store (E-commerce)',
      'Web Application',
      'Other'
    ],
    category: 'project_details',
    priority: 'essential'
  },
  {
    field: 'description',
    question: 'Tell us about your project -- what do you need and what problem are you trying to solve?',
    type: 'textarea',
    category: 'project_details',
    priority: 'essential',
    helpText: 'The more detail the better -- this helps us understand your vision'
  },
  {
    field: 'budget_range',
    question: 'What is your budget for this project?',
    type: 'select',
    options: [
      'Under $1,000',
      '$1,000 - $2,000',
      '$2,000 - $5,000',
      '$5,000 - $10,000',
      '$10,000 - $20,000',
      '$20,000+',
      'Not sure yet'
    ],
    category: 'project_details',
    priority: 'essential',
    helpText: 'This helps us recommend the right package for you -- we work with all budgets'
  },
  {
    field: 'timeline',
    question: 'When do you need this completed?',
    type: 'select',
    options: [
      'ASAP (1-2 weeks)',
      '1 month',
      '1-3 months',
      '3-6 months',
      'No rush / flexible',
      'Specific date (please specify in notes)'
    ],
    category: 'project_details',
    priority: 'essential'
  },
  {
    field: 'page_count',
    question: 'Approximately how many pages will your site need?',
    type: 'select',
    options: [
      '1 (landing page)',
      '2-5 pages',
      '6-10 pages',
      '11-20 pages',
      '20+ pages',
      'Not sure'
    ],
    category: 'project_details',
    priority: 'important'
  },
  {
    field: 'features',
    question: 'What features do you need? (select all that apply)',
    type: 'multiselect',
    options: [
      'Contact form',
      'Blog',
      'Photo gallery',
      'Online booking/scheduling',
      'Newsletter signup',
      'Social media integration',
      'Search functionality',
      'User accounts/login',
      'Online payments',
      'Live chat',
      'Multi-language',
      'Other (describe in notes)'
    ],
    category: 'project_details',
    priority: 'important'
  },
  {
    field: 'current_site',
    question: 'Do you have a current website? If so, what is the URL?',
    type: 'url',
    category: 'project_details',
    priority: 'important',
    helpText: 'Helps us understand where you are starting from'
  },
  {
    field: 'challenges',
    question: 'What are the biggest pain points with your current online presence?',
    type: 'textarea',
    category: 'project_details',
    priority: 'nice_to_have'
  },

  // === DESIGN ===
  {
    field: 'design_level',
    question: 'What level of design customization do you want?',
    type: 'radio',
    options: [
      'Clean and simple -- just make it look professional',
      'Custom design -- I want something unique to my brand',
      'Premium -- full custom with animations and interactive elements'
    ],
    category: 'design',
    priority: 'important'
  },
  {
    field: 'brand_assets',
    question: 'Do you have existing brand assets? (select all that apply)',
    type: 'multiselect',
    options: [
      'Logo',
      'Brand colors',
      'Brand fonts',
      'Brand guidelines document',
      'None -- I need branding help'
    ],
    category: 'design',
    priority: 'important'
  },
  {
    field: 'inspiration',
    question: 'Are there any websites you love the look and feel of? Share links or describe what you like.',
    type: 'textarea',
    category: 'design',
    priority: 'nice_to_have',
    helpText: 'This helps us understand your aesthetic preferences'
  },

  // === CONTENT ===
  {
    field: 'content_status',
    question: 'What is the status of your content (text, photos, videos)?',
    type: 'radio',
    options: [
      'I have everything ready to go',
      'I have some content but need help with the rest',
      'I need all content created from scratch',
      'Not sure yet'
    ],
    category: 'content',
    priority: 'important'
  },

  // === TECHNICAL ===
  {
    field: 'tech_comfort',
    question: 'How comfortable are you with technology?',
    type: 'radio',
    options: [
      'Beginner -- I need everything explained simply',
      'Comfortable -- I can handle basic website updates',
      'Technical -- I understand web development basics',
      'Expert -- I code myself'
    ],
    category: 'technical',
    priority: 'nice_to_have',
    helpText: 'Helps us tailor documentation and training to your level'
  },
  {
    field: 'hosting_preference',
    question: 'Do you have a hosting preference?',
    type: 'radio',
    options: [
      'I already have hosting',
      'I want free hosting (Netlify/Vercel)',
      'I want managed hosting (we handle everything)',
      'No preference -- recommend something',
      'I don\'t know what hosting is'
    ],
    category: 'technical',
    priority: 'nice_to_have'
  },
  {
    field: 'integrations',
    question: 'Do you need to connect with any existing tools or services?',
    type: 'multiselect',
    options: [
      'Google Analytics',
      'Mailchimp / email marketing',
      'Stripe / payment processing',
      'QuickBooks / accounting',
      'CRM (Salesforce, HubSpot, etc.)',
      'Social media feeds',
      'Calendly / scheduling',
      'None',
      'Other (describe in notes)'
    ],
    category: 'technical',
    priority: 'nice_to_have'
  },

  // === BILLING ===
  {
    field: 'billing_name',
    question: 'What name should appear on invoices?',
    type: 'text',
    category: 'billing',
    priority: 'nice_to_have',
    helpText: 'If different from your contact name'
  },
  {
    field: 'billing_address',
    question: 'What is your billing address?',
    type: 'textarea',
    category: 'billing',
    priority: 'nice_to_have',
    helpText: 'Street address, city, state, zip'
  }
];

// =====================================================
// FIELD-TO-SOURCE MAPPING
// =====================================================
// Maps question bank fields to where they live in the DB.
// Fields prefixed with 'client.' come from the clients table;
// all others come from the projects table.

const _CLIENT_FIELDS = new Set([
  'company_name',
  'phone',
  'billing_name',
  'billing_address'
]);

// =====================================================
// CORE FUNCTION
// =====================================================

/**
 * Generate a dynamic questionnaire for a project based on missing information.
 *
 * Queries the project + client records to determine which intake fields
 * are already populated. Builds a questionnaire from the question bank
 * containing only questions for the missing fields.
 *
 * @param projectId - The project to generate a questionnaire for
 * @returns Object with questionnaire details, or null if project not found or nothing is missing
 */
export async function generateDynamicQuestionnaire(
  projectId: number
): Promise<GenerateResult | null> {
  const db = getDatabase();

  // Fetch project + client data to determine what is already collected
  const row = await db.get(
    `SELECT p.*, c.contact_name, c.email, c.phone, c.company_name,
            c.billing_name, c.billing_address, c.billing_city,
            c.billing_state, c.billing_zip
     FROM active_projects p
     JOIN active_clients c ON p.client_id = c.id
     WHERE p.id = ?`,
    [projectId]
  ) as Record<string, unknown> | undefined;

  if (!row) {
    await logger.warn(`[DynamicQuestionnaire] Project ${projectId} not found`, {
      category: 'projects'
    });
    return null;
  }

  // Determine which fields already have data
  const collectedFields = new Set<string>();

  for (const entry of QUESTION_BANK) {
    const value = resolveFieldValue(row, entry.field);
    if (isFieldPopulated(value)) {
      collectedFields.add(entry.field);
    }
  }

  // Include ALL questions — pre-fill collected fields so client can review/edit,
  // and require answers for missing fields
  const allQuestions = [...QUESTION_BANK];
  allQuestions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  // Build the questions JSON array matching the existing schema format
  const categories = new Set<string>();
  const prefillAnswers: Record<string, unknown> = {};

  const questionsJson: QuestionnaireQuestion[] = allQuestions.map((q, index) => {
    categories.add(q.category);

    const existingValue = resolveFieldValue(row, q.field);
    const hasValue = isFieldPopulated(existingValue);

    const questionObj: QuestionnaireQuestion = {
      id: `dq${index + 1}`,
      type: q.type,
      question: q.question,
      // Only REQUIRE answers on fields that are actually missing
      required: !hasValue && q.priority === 'essential'
    };

    if (q.options) {
      questionObj.options = q.options;
    }
    if (q.placeholder) {
      questionObj.placeholder = q.placeholder;
    }

    // Mark pre-filled fields so the UI can show them differently
    if (hasValue) {
      questionObj.helpText = q.helpText
        ? `${q.helpText} (Pre-filled from your project — feel free to edit)`
        : 'Pre-filled from your project — feel free to edit';
      questionObj.prefilled = true;
      // Store the pre-filled value in the response answers
      prefillAnswers[`dq${index + 1}`] = String(existingValue);
    } else if (q.helpText) {
      questionObj.helpText = q.helpText;
    }

    // Store field mapping so answers can be written back to the correct column
    questionObj.fieldMapping = q.field;
    questionObj.category = q.category;
    questionObj.priority = q.priority;

    return questionObj;
  });

  // Create the questionnaire record
  const projectName = String(row.project_name || 'Your Project');
  const _title = `Project Information - ${projectName}`;
  const missingCount = allQuestions.length - collectedFields.size;
  const description = missingCount > 0
    ? 'We have some of your project details already — please review what we have and fill in anything that\'s missing. ' +
      'The more detail you provide, the better we can tailor our proposal to your needs.'
    : 'We have your project details on file. Please review everything and make any corrections or updates.';

  const qResult = await db.run(
    `INSERT INTO questionnaires (
      name, description, project_type, questions,
      is_active, auto_send_on_project_create, display_order,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, 0, 0, 'system', datetime('now'), datetime('now'))`,
    [
      `dynamic_${projectId}_${Date.now()}`,
      description,
      (row.project_type as string) || null,
      JSON.stringify(questionsJson)
    ]
  );

  if (!qResult?.lastID) {
    await logger.error(
      `[DynamicQuestionnaire] Failed to insert questionnaire for project ${projectId}`,
      { category: 'projects' }
    );
    return null;
  }

  const questionnaireId = qResult.lastID;

  // Auto-assign to the project's client with pre-filled answers
  const clientId = row.client_id as number;
  const responseResult = await db.run(
    `INSERT INTO questionnaire_responses (
      questionnaire_id, client_id, project_id,
      answers, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
    [questionnaireId, clientId, projectId, JSON.stringify(prefillAnswers)]
  );

  const responseId = responseResult?.lastID || 0;

  const categoriesArray = Array.from(categories);

  await logger.info(
    `[DynamicQuestionnaire] Generated custom questionnaire for project ${projectId} (${allQuestions.length} questions, ${collectedFields.size} pre-filled, ${missingCount} missing)`,
    {
      category: 'projects',
      metadata: {
        questionnaireId,
        responseId,
        questionCount: allQuestions.length,
        prefilledCount: collectedFields.size,
        missingCount,
        categories: categoriesArray
      }
    }
  );

  return {
    questionnaireId,
    responseId,
    questionCount: allQuestions.length,
    prefilledCount: collectedFields.size,
    missingCount,
    categories: categoriesArray
  };
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Resolve the value of a field from the joined project+client row.
 * Client fields (company_name, phone, billing_*) are pulled from the
 * client columns in the joined result.
 */
function resolveFieldValue(row: Record<string, unknown>, field: string): unknown {
  // The joined query aliases client columns directly (c.company_name, c.phone, etc.)
  // so they appear at top level in the row. For billing_address, we also check
  // the constituent parts (city, state, zip).
  if (field === 'billing_address') {
    // Consider billing address populated if any of the address parts exist
    const hasAddress = isFieldPopulated(row.billing_address);
    const hasCity = isFieldPopulated(row.billing_city);
    const hasState = isFieldPopulated(row.billing_state);
    const hasZip = isFieldPopulated(row.billing_zip);
    return (hasAddress || hasCity || hasState || hasZip) ? 'populated' : null;
  }

  return row[field];
}

/**
 * Check if a field value counts as "populated" (non-null, non-empty).
 */
function isFieldPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}
