/**
 * ===============================================
 * SWAGGER API DOCUMENTATION CONFIGURATION
 * ===============================================
 * @file server/config/swagger.ts
 *
 * OpenAPI/Swagger documentation setup for API endpoints.
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

// Basic API information
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'No Bhad Codes API',
      version: process.env.npm_package_version || '1.0.0',
      description: `
        # No Bhad Codes Client Management API
        
        A comprehensive API for managing clients, projects, and portfolio data.
        
        ## Features
        - **Client Management**: Registration, authentication, and profile management
        - **Project Tracking**: Create, update, and monitor project progress
        - **File Management**: Upload, download, and organize project files
        - **Messaging**: Real-time communication between clients and team
        - **Analytics**: Performance monitoring and reporting
        
        ## Authentication
        This API uses JWT (JSON Web Token) for authentication. Include the token in the Authorization header:
        \`Authorization: Bearer <your_token>\`
        
        ## Rate Limiting
        - Authentication endpoints: 5 requests per 15 minutes per IP
        - General API endpoints: 100 requests per 15 minutes per user
        - File uploads: 10 requests per hour per user
        
        ## Error Handling
        All errors follow a consistent format:
        \`\`\`json
        {
          "error": "Error type",
          "message": "Human-readable error message",
          "code": "ERROR_CODE",
          "timestamp": "2025-01-01T00:00:00.000Z"
        }
        \`\`\`
      `,
      contact: {
        name: 'No Bhad Codes Support',
        email: 'support@nobhadcodes.com',
        url: 'https://nobhadcodes.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:4001',
        description: 'Development server',
      },
      {
        url: 'https://api.nobhadcodes.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        // Common response schemas
        Error: {
          type: 'object',
          required: ['error', 'message', 'timestamp'],
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
            },
            code: {
              type: 'string',
              description: 'Machine-readable error code',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp in ISO format',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          required: ['success', 'message'],
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)',
            },
          },
        },

        // Authentication schemas
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'client@example.com',
            },
            password: {
              type: 'string',
              minLength: 8,
              example: 'securePassword123',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          required: ['success', 'token', 'user'],
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            token: {
              type: 'string',
              description: 'JWT access token',
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token',
            },
            expiresIn: {
              type: 'string',
              example: '24h',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },

        // User schemas
        User: {
          type: 'object',
          required: ['id', 'email'],
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'client@example.com',
            },
            companyName: {
              type: 'string',
              example: 'Acme Corp',
            },
            contactName: {
              type: 'string',
              example: 'John Smith',
            },
            phone: {
              type: 'string',
              example: '+1-555-0123',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
              example: 'active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Project schemas
        Project: {
          type: 'object',
          required: ['id', 'clientId', 'projectName', 'status'],
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            clientId: {
              type: 'integer',
              example: 1,
            },
            projectName: {
              type: 'string',
              example: 'E-commerce Website',
            },
            description: {
              type: 'string',
              example: 'Modern e-commerce platform with payment integration',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in-progress', 'in-review', 'completed', 'on-hold'],
              example: 'in-progress',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              example: 'medium',
            },
            progress: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              example: 75,
            },
            startDate: {
              type: 'string',
              format: 'date',
            },
            estimatedEndDate: {
              type: 'string',
              format: 'date',
            },
            budgetRange: {
              type: 'string',
              example: '10k-25k',
            },
            projectType: {
              type: 'string',
              example: 'website',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        ProjectUpdate: {
          type: 'object',
          required: ['id', 'projectId', 'title'],
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            projectId: {
              type: 'integer',
              example: 1,
            },
            title: {
              type: 'string',
              example: 'Homepage design completed',
            },
            description: {
              type: 'string',
              example: 'Finished the homepage design and got client approval',
            },
            updateType: {
              type: 'string',
              enum: ['progress', 'milestone', 'issue', 'resolution', 'general'],
              example: 'progress',
            },
            author: {
              type: 'string',
              example: 'Development Team',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // File schema
        ProjectFile: {
          type: 'object',
          required: ['id', 'projectId', 'filename', 'filePath'],
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            projectId: {
              type: 'integer',
              example: 1,
            },
            filename: {
              type: 'string',
              example: 'project-wireframes.pdf',
            },
            originalFilename: {
              type: 'string',
              example: 'wireframes_v2.pdf',
            },
            filePath: {
              type: 'string',
              example: '/uploads/projects/1/documents/project-wireframes.pdf',
            },
            fileSize: {
              type: 'integer',
              example: 2048576,
              description: 'File size in bytes',
            },
            mimeType: {
              type: 'string',
              example: 'application/pdf',
            },
            fileType: {
              type: 'string',
              enum: ['document', 'image', 'video', 'archive', 'other'],
              example: 'document',
            },
            description: {
              type: 'string',
              example: 'Project wireframes and mockups',
            },
            uploadedBy: {
              type: 'string',
              example: 'client@example.com',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        // Message schema
        Message: {
          type: 'object',
          required: ['id', 'projectId', 'senderName', 'message'],
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            projectId: {
              type: 'integer',
              example: 1,
            },
            senderName: {
              type: 'string',
              example: 'John Smith',
            },
            senderRole: {
              type: 'string',
              enum: ['client', 'developer', 'system'],
              example: 'client',
            },
            message: {
              type: 'string',
              example: 'The wireframes look great! Can we adjust the header layout?',
            },
            isRead: {
              type: 'boolean',
              example: false,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Client authentication and session management',
      },
      {
        name: 'Users',
        description: 'User profile management',
      },
      {
        name: 'Projects',
        description: 'Project creation, management, and tracking',
      },
      {
        name: 'Files',
        description: 'File upload, download, and management',
      },
      {
        name: 'Messages',
        description: 'Client-team communication',
      },
      {
        name: 'Health',
        description: 'API health and monitoring endpoints',
      },
    ],
  },
  apis: [
    './server/routes/*.ts',
    './server/routes/*.js',
    './server/middleware/*.ts',
    './server/**/*.ts',
  ],
};

// Generate OpenAPI specification
const specs = swaggerJsdoc(options);

/**
 * Setup Swagger documentation for Express app
 */
export function setupSwagger(app: Express): void {
  // Swagger UI options
  const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { color: #00ff41; }
      .swagger-ui .scheme-container { background: #1a1a1a; }
    `,
    customSiteTitle: 'No Bhad Codes API Documentation',
    customfavIcon: '/favicon.png',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
  };

  // Serve Swagger JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(specs, swaggerUiOptions));

  console.log('📚 API Documentation available at:');
  console.log('   • Swagger UI: http://localhost:4001/api-docs');
  console.log('   • OpenAPI JSON: http://localhost:4001/api-docs.json');
}

export { specs };
export default setupSwagger;
