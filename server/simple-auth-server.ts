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
const users: Array<{id: number, email: string, password: string, role: string}> = [
  {
    id: 1,
    email: 'admin@nobhadcodes.com',
    password: bcrypt.hashSync('password123', 10),
    role: 'admin'
  }
];

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

    console.log('✅ New client intake received:', {
      id: newIntake.id,
      name: newIntake.name,
      email: newIntake.email,
      projectType: newIntake.projectType
    });

    res.status(201).json({
      message: 'Client intake submitted successfully',
      intake: {
        id: newIntake.id,
        status: 'new',
        projectType: newIntake.projectType
      }
    });

  } catch (error) {
    console.error('Intake submission error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    message: 'Simple Auth Server with Client Intake',
    endpoints: {
      login: 'POST /api/auth/login',
      profile: 'GET /api/auth/profile', 
      intake_submit: 'POST /api/intake',
      intake_list: 'GET /api/intake (admin only)',
      health: 'GET /health'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple Auth Server running on http://localhost:${PORT}`);
  console.log('📧 Test credentials: admin@nobhadcodes.com / password123');
});