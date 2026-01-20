/**
 * Create a demo user for the Client Portal
 * Run with: npx ts-node server/scripts/create-demo-user.ts
 */

import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';

async function createDemoUser() {
  const email = 'demo@example.com';
  const password = 'nobhadDemo123';
  const hash = await bcrypt.hash(password, 10);

  const db = new sqlite3.Database('./data/client_portal.db');

  // Create user
  db.run(
    `
    INSERT INTO clients (email, password_hash, company_name, contact_name, phone, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [email, hash, 'Demo Company', 'Demo User', '555-0000', 'active'],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          console.log('User already exists, updating password...');
          db.run(
            'UPDATE clients SET password_hash = ?, status = ? WHERE email = ?',
            [hash, 'active', email],
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
        console.log(`\n✅ Created demo client "${email}" with ID: ${clientId}`);
        console.log(`   Password: ${password}\n`);

        // Create a sample project for the demo user
        db.run(
          `
        INSERT INTO projects (client_id, project_name, description, status, priority, progress, start_date, estimated_end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
          [
            clientId,
            'Demo Project',
            'A demo project for testing the client portal',
            'in-progress',
            'medium',
            50,
            new Date().toISOString().split('T')[0],
            new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 90 days from now
          ],
          function (projErr) {
            if (projErr) {
              console.error('Error creating project:', projErr);
            } else {
              console.log(`✅ Created project "Demo Project" with ID: ${this.lastID}\n`);
            }
            db.close();
          }
        );
      }
    }
  );
}

createDemoUser();

