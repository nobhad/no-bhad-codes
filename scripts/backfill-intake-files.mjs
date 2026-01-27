/**
 * Backfill intake files for existing projects
 * Run with: node scripts/backfill-intake-files.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const DB_PATH = './data/client_portal.db';
const UPLOADS_DIR = resolve('./uploads/intake');

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('Created uploads/intake directory');
}

const db = new sqlite3.Database(DB_PATH);
const dbAll = promisify(db.all.bind(db));
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));

async function main() {
  // Get all projects with their client info
  const projects = await dbAll(`
    SELECT 
      p.id,
      p.project_name,
      p.description,
      p.project_type,
      p.budget_range,
      p.timeline,
      p.features,
      p.created_at,
      c.contact_name,
      c.company_name,
      c.email
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
  `);

  console.log(`Found ${projects.length} projects to process`);

  let created = 0;
  let skipped = 0;

  for (const project of projects) {
    // Check if file already exists for this project
    const existingFile = await dbGet(
      `SELECT id FROM files WHERE project_id = ? AND description LIKE '%intake%'`,
      [project.id]
    );

    if (existingFile) {
      console.log(`Skipping project ${project.id} - intake file already exists`);
      skipped++;
      continue;
    }

    // Create intake document from project data
    const intakeDocument = {
      submittedAt: project.created_at,
      projectId: project.id,
      projectName: project.project_name,
      clientInfo: {
        name: project.contact_name || 'Unknown',
        email: project.email || 'unknown@example.com',
        companyName: project.company_name || null
      },
      projectDetails: {
        type: project.project_type || 'other',
        description: project.description || '',
        timeline: project.timeline || '',
        budget: project.budget_range || '',
        features: project.features ? project.features.split(',').map(f => f.trim()) : []
      },
      note: 'Backfilled from project data'
    };

    // Generate filename
    const timestamp = new Date(project.created_at).getTime() || Date.now();
    const safeProjectName = (project.project_name || 'project').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `intake_${project.id}_${safeProjectName}_${timestamp}.json`;
    const filePath = join(UPLOADS_DIR, filename);
    const relativePath = `uploads/intake/${filename}`;

    // Write file
    writeFileSync(filePath, JSON.stringify(intakeDocument, null, 2), 'utf-8');

    // Get file size
    const fileSize = Buffer.byteLength(JSON.stringify(intakeDocument, null, 2), 'utf-8');

    // Insert into files table
    await dbRun(`
      INSERT INTO files (
        project_id, filename, original_filename, file_path,
        file_size, mime_type, file_type, description, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [
      project.id,
      filename,
      'Project Intake Form.json',
      relativePath,
      fileSize,
      'application/json',
      'document',
      'Original project intake form submission (backfilled)',
      'system'
    ]);

    console.log(`Created intake file for project ${project.id}: ${filename}`);
    created++;
  }

  db.close();
  console.log(`\nDone! Created ${created} files, skipped ${skipped}`);
}

main().catch(console.error);
