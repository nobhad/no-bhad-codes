/**
 * Deliverable Models and Types
 * Handles deliverable uploads, versioning, comments, and review tracking
 */

export interface Deliverable {
  id: number;
  project_id: number;
  type: 'design' | 'content' | 'document' | 'asset' | 'code' | 'other';
  title: string;
  description: string;
  status: 'draft' | 'pending_review' | 'revision_requested' | 'approved' | 'archived';
  approval_status: 'pending' | 'approved' | 'rejected' | 'revision_needed';
  round_number: number; // Round 1, 2, Final
  created_by_id: number;
  reviewed_by_id: number | null;
  review_deadline: string | null;
  approved_at: string | null;
  locked: boolean;
  tags: string; // comma-separated
  archived_file_id: number | null; // Reference to file in Files tab after approval
  created_at: string;
  updated_at: string;
}

export interface DeliverableVersion {
  id: number;
  deliverable_id: number;
  version_number: number;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string; // mime type
  uploaded_by_id: number;
  change_notes: string;
  created_at: string;
}

export interface DeliverableComment {
  id: number;
  deliverable_id: number;
  author_id: number;
  comment_text: string;
  x_position: number | null; // For image annotation
  y_position: number | null;
  annotation_type: 'text' | 'highlight' | 'arrow' | 'box'; // Drawing tools
  element_id: string | null; // For component-specific feedback (logo, homepage, etc)
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DesignElement {
  id: number;
  deliverable_id: number;
  name: string; // logo, homepage, inner_pages, etc
  description: string;
  approval_status: 'pending' | 'approved' | 'revision_needed';
  revision_count: number;
  created_at: string;
  updated_at: string;
}

export interface DeliverableReview {
  id: number;
  deliverable_id: number;
  reviewer_id: number;
  decision: 'approved' | 'revision_needed' | 'rejected';
  feedback: string;
  design_elements_reviewed: string; // JSON array of element IDs
  review_duration_minutes: number;
  created_at: string;
}

/**
 * Initialize deliverable tables
 */
export async function initializeDeliverableTables(db: any): Promise<void> {
  // Deliverables table
  await db.run(`
    CREATE TABLE IF NOT EXISTS deliverables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'design',
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      approval_status TEXT NOT NULL DEFAULT 'pending',
      round_number INTEGER NOT NULL DEFAULT 1,
      created_by_id INTEGER NOT NULL,
      reviewed_by_id INTEGER,
      review_deadline DATETIME,
      approved_at DATETIME,
      locked INTEGER NOT NULL DEFAULT 0,
      tags TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_id) REFERENCES users(id),
      FOREIGN KEY (reviewed_by_id) REFERENCES users(id)
    )
  `);

  // Deliverable versions table
  await db.run(`
    CREATE TABLE IF NOT EXISTS deliverable_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deliverable_id INTEGER NOT NULL,
      version_number INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      uploaded_by_id INTEGER NOT NULL,
      change_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by_id) REFERENCES users(id),
      UNIQUE(deliverable_id, version_number)
    )
  `);

  // Deliverable comments table
  await db.run(`
    CREATE TABLE IF NOT EXISTS deliverable_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deliverable_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      comment_text TEXT NOT NULL,
      x_position INTEGER,
      y_position INTEGER,
      annotation_type TEXT DEFAULT 'text',
      element_id TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);

  // Design elements table
  await db.run(`
    CREATE TABLE IF NOT EXISTS design_elements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deliverable_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      approval_status TEXT NOT NULL DEFAULT 'pending',
      revision_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
      UNIQUE(deliverable_id, name)
    )
  `);

  // Deliverable reviews table
  await db.run(`
    CREATE TABLE IF NOT EXISTS deliverable_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deliverable_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      decision TEXT NOT NULL,
      feedback TEXT,
      design_elements_reviewed TEXT DEFAULT '[]',
      review_duration_minutes INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewer_id) REFERENCES users(id)
    )
  `);

  // Create indexes
  await db.run('CREATE INDEX IF NOT EXISTS idx_deliverables_project_id ON deliverables(project_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(status)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_deliverables_approval_status ON deliverables(approval_status)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_deliverable_versions_deliverable_id ON deliverable_versions(deliverable_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_deliverable_comments_deliverable_id ON deliverable_comments(deliverable_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_design_elements_deliverable_id ON design_elements(deliverable_id)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_deliverable_id ON deliverable_reviews(deliverable_id)');
}
