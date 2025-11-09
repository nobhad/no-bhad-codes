/**
 * Simple authentication server for testing
 */
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Simple in-memory user store for testing
const users: Array<{id: number, email: string, password: string, role: string, name?: string, clientId?: number, status?: string}> = [
  {
    id: 1,
    email: 'admin@nobhadcodes.com',
    password: bcrypt.hashSync('password123', 10),
    role: 'admin',
    name: 'Admin User'
  }
];

// Simple in-memory clients store
const clients: Array<{
  id: number,
  name: string,
  email: string,
  company: string,
  phone: string,
  status: 'pending' | 'active' | 'inactive',
  createdAt: string,
  intakeId?: number,
  userId?: number
}> = [];

// Simple in-memory projects store
const projects: Array<{
  id: number,
  clientId: number,
  intakeId: number,
  title: string,
  type: string,
  status: 'pending' | 'active' | 'completed' | 'cancelled',
  budget: string,
  timeline: string,
  description: string,
  features: string[],
  createdAt: string
}> = [];

// Simple in-memory intake store for testing
const intakes: Array<{
  id: number,
  name: string,
  email: string,
  company: string,
  phone: string,
  projectType: string,
  budget: string,
  timeline: string,
  description: string,
  features: string[],
  createdAt: string,
  status: string
}> = [];

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      'test-jwt-secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token,
      expiresIn: '7d'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/auth/profile', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, 'test-jwt-secret') as any;
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Client intake endpoint
app.post('/api/intake', (req, res) => {
  try {
    const {
      name,
      email,
      company,
      phone,
      projectType,
      budget,
      timeline,
      description,
      features
    } = req.body;

    // Basic validation
    if (!name || !email || !projectType) {
      return res.status(400).json({
        message: 'Name, email, and project type are required'
      });
    }

    // Create new intake
    const newIntake = {
      id: intakes.length + 1,
      name,
      email,
      company: company || '',
      phone: phone || '',
      projectType,
      budget: budget || '',
      timeline: timeline || '',
      description: description || '',
      features: features || [],
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    intakes.push(newIntake);

    // Create client record
    const newClient = {
      id: clients.length + 1,
      name,
      email,
      company: company || '',
      phone: phone || '',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      intakeId: newIntake.id
    };

    clients.push(newClient);

    // Create project record
    const newProject = {
      id: projects.length + 1,
      clientId: newClient.id,
      intakeId: newIntake.id,
      title: `${projectType.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} Project for ${company || name}`,
      type: projectType,
      status: 'pending' as const,
      budget: budget || '',
      timeline: timeline || '',
      description: description || '',
      features: features || [],
      createdAt: new Date().toISOString()
    };

    projects.push(newProject);

    console.log('✅ New client intake received:', {
      intake: { id: newIntake.id, name: newIntake.name, email: newIntake.email, projectType: newIntake.projectType },
      client: { id: newClient.id, status: newClient.status },
      project: { id: newProject.id, title: newProject.title, status: newProject.status }
    });

    res.status(201).json({
      message: 'Client intake submitted successfully',
      intake: {
        id: newIntake.id,
        status: 'new',
        projectType: newIntake.projectType
      },
      client: {
        id: newClient.id,
        status: newClient.status
      },
      project: {
        id: newProject.id,
        title: newProject.title,
        status: newProject.status
      }
    });

  } catch (error) {
    console.error('Intake submission error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin: Activate client account (creates login credentials)
app.post('/api/admin/clients/:clientId/activate', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, 'test-jwt-secret') as any;
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { clientId } = req.params;
    const client = clients.find(c => c.id === parseInt(clientId));
    
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    if (client.status === 'active') {
      return res.status(400).json({ message: 'Client already active' });
    }
    
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    
    // Create user account for client
    const newUser = {
      id: users.length + 1,
      email: client.email,
      password: bcrypt.hashSync(tempPassword, 10),
      role: 'client',
      name: client.name,
      clientId: client.id,
      status: 'active'
    };
    
    users.push(newUser);
    
    // Update client status
    client.status = 'active';
    client.userId = newUser.id;
    
    // Update associated project status
    const project = projects.find(p => p.clientId === client.id);
    if (project) {
      project.status = 'active';
    }
    
    console.log('✅ Client activated:', {
      clientId: client.id,
      email: client.email,
      tempPassword: tempPassword,
      projectId: project?.id
    });
    
    res.json({
      message: 'Client activated successfully',
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        status: client.status
      },
      credentials: {
        email: client.email,
        tempPassword: tempPassword,
        loginUrl: 'http://localhost:5173/client-portal'
      },
      project: project ? {
        id: project.id,
        title: project.title,
        status: project.status
      } : null
    });
    
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Admin: Get all clients
app.get('/api/admin/clients', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, 'test-jwt-secret') as any;
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    // Get clients with their associated projects
    const clientsWithProjects = clients.map(client => {
      const clientProjects = projects.filter(p => p.clientId === client.id);
      return {
        ...client,
        projects: clientProjects
      };
    });
    
    res.json({
      clients: clientsWithProjects,
      total: clients.length,
      pending: clients.filter(c => c.status === 'pending').length,
      active: clients.filter(c => c.status === 'active').length
    });
    
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Admin: Get all projects
app.get('/api/admin/projects', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, 'test-jwt-secret') as any;
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    // Get projects with client info
    const projectsWithClients = projects.map(project => {
      const client = clients.find(c => c.id === project.clientId);
      return {
        ...project,
        client: client ? {
          id: client.id,
          name: client.name,
          email: client.email,
          company: client.company
        } : null
      };
    });
    
    res.json({
      projects: projectsWithClients,
      total: projects.length,
      pending: projects.filter(p => p.status === 'pending').length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length
    });
    
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Get all intakes (admin only endpoint for testing)
app.get('/api/intake', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, 'test-jwt-secret') as any;
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    res.json({
      intakes: intakes,
      total: intakes.length
    });
    
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'No Bhad Codes - Client Portal API',
    version: '1.0.0',
    endpoints: {
      // Authentication
      login: 'POST /api/auth/login',
      profile: 'GET /api/auth/profile',
      
      // Client Intake
      intake_submit: 'POST /api/intake',
      intake_list: 'GET /api/intake (admin only)',
      
      // Admin - Client Management
      admin_clients: 'GET /api/admin/clients (admin only)',
      admin_activate_client: 'POST /api/admin/clients/:id/activate (admin only)',
      admin_projects: 'GET /api/admin/projects (admin only)',
      
      // Health
      health: 'GET /health'
    },
    workflow: {
      client_onboarding: '1. Submit intake → 2. Admin reviews → 3. Admin activates client → 4. Client gets login credentials',
      admin_process: '1. View pending clients → 2. Activate client account → 3. Manage projects'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple Auth Server running on http://localhost:${PORT}`);
  console.log('📧 Test credentials: admin@nobhadcodes.com / password123');
});