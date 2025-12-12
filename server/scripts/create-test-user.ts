/**
 * Create a test user for the Client Portal
 * Run with: npx ts-node server/scripts/create-test-user.ts
 */

import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';

async function createTestUser() {
  const email = 'test@nobhad.codes';
  const password = 'Test!1234';
  const hash = await bcrypt.hash(password, 10);

  const db = new sqlite3.Database('./data/client_portal.db');

  // Create user
  db.run(
    `
    INSERT INTO clients (email, password_hash, company_name, contact_name, phone, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [email, hash, 'Arrow Test Account', 'Arrow', '555-0000', 'active'],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          console.log('User already exists, updating password...');
          db.run(
            'UPDATE clients SET password_hash = ? WHERE email = ?',
            [hash, email],
            (updateErr) => {
              if (updateErr) {
                console.error('Error updating:', updateErr);
              } else {
                console.log(`\n✅ Password updated for ${email}`);
                console.log(`   Password: ${password}\n`);
              }
              db.close();
            }
          );
        } else {
          console.error('Error:', err);
          db.close();
        }
      } else {
        const clientId = this.lastID;
        console.log(`\n✅ Created client "${email}" with ID: ${clientId}`);
        console.log(`   Password: ${password}\n`);

        // Create a sample project for the user
        db.run(
          `
        INSERT INTO projects (client_id, project_name, description, status, priority, progress, start_date, estimated_end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
          [
            clientId,
            'Arrow Test Project',
            'A test project for Arrow',
            'in-progress',
            'medium',
            35,
            '2025-11-15',
            '2026-02-15',
          ],
          function (projErr) {
            if (projErr) {
              console.error('Error creating project:', projErr);
            } else {
              console.log(`✅ Created project "Arrow Test Project" with ID: ${this.lastID}\n`);
            }
            db.close();
          }
        );
      }
    }
  );
}

createTestUser();
