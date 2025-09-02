/**
 * ===============================================
 * CLIENT ROUTES
 * ===============================================
 * Client management endpoints
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';
import { cache, invalidateCache, QueryCache } from '../middleware/cache.js';

const router = express.Router();

// Get all clients (admin only)
router.get('/', 
  authenticateToken, 
  requireAdmin, 
  cache({ 
    ttl: 300, // 5 minutes
    tags: ['clients', 'projects'],
    keyGenerator: (req) => 'clients:all'
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();
    
    const clients = await QueryCache.getOrSet(
      'clients:all:with_projects',
      async () => {
        return await db.all(`
          SELECT 
            c.id, c.email, c.company_name, c.contact_name, c.phone, 
            c.status, c.created_at, c.updated_at,
            COUNT(p.id) as project_count
          FROM clients c
          LEFT JOIN projects p ON c.id = p.client_id
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `);
      },
      {
        ttl: 300,
        tags: ['clients', 'projects']
      }
    );

    res.json({ clients });
  })
);

// Get single client (admin or own profile)
router.get('/:id', 
  authenticateToken, 
  cache({ 
    ttl: 600, // 10 minutes
    tags: (req) => [`client:${req.params.id}`, 'projects'],
    keyGenerator: (req) => `client:${req.params.id}:details`
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    
    // Check if user can access this client
    if (req.user!.type === 'client' && req.user!.id !== clientId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const db = getDatabase();
    
    const client = await QueryCache.getOrSet(
      `client:${clientId}:profile`,
      async () => {
        return await db.get(`
          SELECT 
            c.id, c.email, c.company_name, c.contact_name, c.phone, 
            c.status, c.created_at, c.updated_at
          FROM clients c
          WHERE c.id = ?
        `, [clientId]);
      },
      {
        ttl: 600,
        tags: [`client:${clientId}`]
      }
    );

    if (!client) {
      return res.status(404).json({
        error: 'Client not found',
        code: 'CLIENT_NOT_FOUND'
      });
    }

    // Get client's projects
    const projects = await QueryCache.getOrSet(
      `client:${clientId}:projects`,
      async () => {
        return await db.all(`
          SELECT 
            id, name, description, status, priority, start_date, 
            due_date, completed_at, budget, created_at, updated_at
          FROM projects 
          WHERE client_id = ?
          ORDER BY created_at DESC
        `, [clientId]);
      },
      {
        ttl: 300,
        tags: [`client:${clientId}`, 'projects']
      }
    );

    res.json({
      client,
      projects
    });
  })
);

// Create new client (admin only)
router.post('/', 
  authenticateToken, 
  requireAdmin, 
  invalidateCache(['clients']),
  asyncHandler(async (req: express.Request, res: express.Response) => {
  const { 
    email, 
    password, 
    company_name, 
    contact_name, 
    phone 
  } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required',
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      error: 'Invalid email format',
      code: 'INVALID_EMAIL'
    });
  }

  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long',
      code: 'WEAK_PASSWORD'
    });
  }

  const db = getDatabase();

  // Check if email already exists
  const existingClient = await db.get(
    'SELECT id FROM clients WHERE email = ?',
    [email.toLowerCase()]
  );

  if (existingClient) {
    return res.status(409).json({
      error: 'Email already registered',
      code: 'EMAIL_EXISTS'
    });
  }

  // Hash password
  const saltRounds = 12;
  const password_hash = await bcrypt.hash(password, saltRounds);

  // Insert new client
  const result = await db.run(`
    INSERT INTO clients (email, password_hash, company_name, contact_name, phone)
    VALUES (?, ?, ?, ?, ?)
  `, [
    email.toLowerCase(),
    password_hash,
    company_name || null,
    contact_name || null,
    phone || null
  ]);

  // Get the created client
  const newClient = await db.get(`
    SELECT id, email, company_name, contact_name, phone, status, created_at
    FROM clients WHERE id = ?
  `, [result.lastID]);

  if (!newClient) {
    return res.status(500).json({
      error: 'Client created but could not retrieve details',
      code: 'CLIENT_CREATION_ERROR'
    });
  }

  // Send welcome email
  try {
    await emailService.sendWelcomeEmail(newClient.email, {
      name: newClient.contact_name || 'Client',
      companyName: newClient.company_name,
      loginUrl: `${process.env.CLIENT_PORTAL_URL || 'https://nobhadcodes.com/client/portal.html'}?email=${encodeURIComponent(newClient.email)}`,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@nobhadcodes.com'
    });

    // Send admin notification
    await emailService.sendAdminNotification({
      subject: 'New Client Registration',
      intakeId: newClient.id.toString(),
      clientName: newClient.contact_name || 'Unknown',
      companyName: newClient.company_name || 'Unknown Company',
      projectType: 'New Registration',
      budget: 'TBD',
      timeline: 'New Client'
    });
  } catch (emailError) {
    console.error('Failed to send welcome email:', emailError);
    // Continue with response - don't fail client creation due to email issues
  }

  res.status(201).json({
    message: 'Client created successfully',
    client: newClient
  });
}));

// Update client (admin or own profile)
router.put('/:id', 
  authenticateToken, 
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const clientId = parseInt(req.params.id);
  
  // Check if user can update this client
  if (req.user!.type === 'client' && req.user!.id !== clientId) {
    return res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED'
    });
  }

  const { company_name, contact_name, phone, status } = req.body;
  const db = getDatabase();

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];

  if (company_name !== undefined) {
    updates.push('company_name = ?');
    values.push(company_name);
  }
  if (contact_name !== undefined) {
    updates.push('contact_name = ?');
    values.push(contact_name);
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    values.push(phone);
  }
  
  // Only admins can change status
  if (status !== undefined && req.user!.type === 'admin') {
    if (!['active', 'inactive', 'pending'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status value',
        code: 'INVALID_STATUS'
      });
    }
    updates.push('status = ?');
    values.push(status);
  }

  if (updates.length === 0) {
    return res.status(400).json({
      error: 'No valid fields to update',
      code: 'NO_UPDATES'
    });
  }

  values.push(clientId);

  await db.run(`
    UPDATE clients 
    SET ${updates.join(', ')}
    WHERE id = ?
  `, values);

  // Get updated client
  const updatedClient = await db.get(`
    SELECT id, email, company_name, contact_name, phone, status, created_at, updated_at
    FROM clients WHERE id = ?
  `, [clientId]);

  res.json({
    message: 'Client updated successfully',
    client: updatedClient
  });
}));

// Delete client (admin only)
router.delete('/:id', 
  authenticateToken, 
  requireAdmin, 
  invalidateCache(['clients', 'projects']),
  asyncHandler(async (req: express.Request, res: express.Response) => {
  const clientId = parseInt(req.params.id);
  const db = getDatabase();

  const client = await db.get('SELECT id FROM clients WHERE id = ?', [clientId]);
  
  if (!client) {
    return res.status(404).json({
      error: 'Client not found',
      code: 'CLIENT_NOT_FOUND'
    });
  }

  await db.run('DELETE FROM clients WHERE id = ?', [clientId]);

  res.json({
    message: 'Client deleted successfully'
  });
}));

export { router as clientsRouter };
export default router;