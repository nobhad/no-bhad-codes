# No Bhad Codes - Professional Portfolio & Client Management System

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![GSAP](https://img.shields.io/badge/GSAP-88CE02?style=for-the-badge&logo=greensock&logoColor=white)](https://greensock.com/gsap/)

> Modern TypeScript portfolio website and enterprise-grade client management system built with Vite, Express, and advanced web technologies.

## 🌟 Features

### 🎨 **Portfolio Website**

- **Interactive Business Card**: 3D flip animations with GSAP
- **Responsive Design**: Mobile-first approach with CSS Grid/Flexbox
- **Dark/Light Theme**: System preference detection with manual toggle
- **Progressive Web App**: Offline-first with service worker
- **Performance Optimized**: Core Web Vitals monitoring, lazy loading
- **SEO Ready**: Meta tags, structured data, sitemap generation

### 💼 **Client Management System**

- **Client Portal**: Secure dashboard for project tracking
- **Intake Forms**: Dynamic project requirement collection with automated processing
- **Project Generator**: Automated project plans and timelines
- **Invoice System**: Dynamic pricing with payment schedules
- **File Management**: Secure file uploads and sharing with type validation
- **Messaging System**: Real-time communication with thread management
  - Project-specific message threads
  - General inquiry and support threads
  - File attachments up to 5MB per message
  - Priority levels and read status tracking
  - Email notifications for new messages
  - Admin analytics and message management

### 🏗️ **Architecture**

- **TypeScript**: Full type safety with strict mode
- **Dependency Injection**: Container-based DI for testability
- **Module Pattern**: Consistent lifecycle management
- **Service Layer**: Clean separation of business logic
- **Component System**: Reusable UI components
- **State Management**: Centralized state with pub-sub pattern

### 🔒 **Security & Operations**

- **JWT Authentication**: Role-based access control
- **Rate Limiting**: Configurable request throttling
- **Input Validation**: Comprehensive data sanitization
- **Error Logging**: Centralized logging with correlation IDs
- **Environment Validation**: Type-safe configuration management
- **Database Security**: Parameterized queries, data encryption

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x and **npm** 8+
- **Git** for version control

### Installation

```bash
# Clone the repository
git clone https://github.com/noellebhaduri/no-bhad-codes.git
cd no-bhad-codes

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env
# (If .env.example is not present, see docs/CONFIGURATION.md for required variables.)
# Edit .env with your configuration

# Initialize database
npm run db:setup

# Start development servers
npm run dev:full
```

### Development URLs

- **Frontend**: http://localhost:4000
- **API Server**: http://localhost:4001
- **Admin Dashboard**: http://localhost:4000/admin
- **Client Portal**: http://localhost:4000/client/portal

## 📋 Available Scripts

### Development

```bash
npm run dev              # Start frontend dev server
npm run dev:server       # Start backend server only
npm run dev:full         # Start both frontend and backend
npm run dev:quiet        # Start with minimal output
```

### Building & Testing

```bash
npm run build           # Build for production
npm run build:server    # Build server only
npm run preview         # Preview production build
npm run typecheck       # TypeScript type checking
npm run test            # Run tests
npm run test:coverage   # Generate coverage report
```

### Code Quality

```bash
npm run lint            # Run ESLint
npm run format          # Format code with Prettier
npm run format:check    # Check code formatting
npm run optimize        # Full optimization check
```

### Database

```bash
npm run db:setup        # Initialize database
npm run migrate         # Run migrations
npm run migrate:status  # Check migration status
```

## 📁 Project Structure

```text
no-bhad-codes/
├── 📁 client/                    # Client portal pages
│   ├── intake.html              # Client intake form
│   ├── portal.html              # Client dashboard
│   └── set-password.html        # Invitation password setup
├── 📁 server/                    # Backend application
│   ├── 📁 config/               # Configuration management
│   │   └── environment.ts       # Environment validation
│   ├── 📁 database/             # Database setup and migrations
│   ├── 📁 middleware/           # Express middleware
│   │   ├── auth.ts              # Authentication middleware
│   │   ├── errorHandler.ts      # Global error handling
│   │   ├── logger.ts            # Request logging
│   │   ├── request-id.ts        # Request correlation IDs
│   │   ├── sanitization.ts      # Input sanitization
│   │   └── audit.ts             # Audit logging
│   ├── 📁 routes/               # API routes
│   │   ├── auth.ts              # Authentication endpoints
│   │   ├── admin.ts             # Admin dashboard
│   │   ├── clients.ts           # Client management
│   │   ├── projects.ts          # Project management
│   │   ├── messages.ts          # Messaging
│   │   ├── invoices.ts         # Invoices
│   │   ├── uploads.ts          # File uploads
│   │   ├── intake.ts           # Intake form processing
│   │   ├── proposals.ts         # Proposals
│   │   ├── analytics.ts        # Analytics
│   │   ├── approvals.ts        # Approval workflows
│   │   ├── triggers.ts         # Workflow triggers
│   │   ├── document-requests.ts # Document requests
│   │   ├── knowledge-base.ts   # Knowledge base (kb)
│   │   └── api.ts              # General API (contact, etc.)
│   ├── 📁 services/             # Business logic services
│   │   ├── email-service.ts     # Email notifications
│   │   ├── invoice-service.ts   # Invoice CRUD and generation
│   │   ├── invoice-generator.ts # PDF invoice generation
│   │   ├── logger.ts            # Centralized logging
│   │   ├── project-service.ts   # Project management
│   │   ├── project-generator.ts # Project planning
│   │   ├── message-service.ts   # Messaging
│   │   ├── client-service.ts   # Client management
│   │   ├── file-service.ts     # File uploads
│   │   └── (approvals, document-requests, knowledge-base, etc.)
│   └── app.ts                   # Express application
├── 📁 src/                      # Frontend source code
│   ├── 📁 config/               # Frontend configuration
│   │   ├── api.ts               # API endpoint configuration
│   │   ├── branding.ts          # Company branding constants
│   │   ├── constants.ts         # App-wide constants
│   │   ├── routes.ts            # Route path definitions
│   │   └── protection.config.ts # Code protection settings
│   ├── 📁 core/                 # Application core
│   │   ├── app.ts               # Main application
│   │   ├── container.ts         # Dependency injection
│   │   └── state.ts             # State management
│   ├── 📁 features/             # Feature modules
│   │   ├── 📁 admin/            # Admin features
│   │   └── 📁 client/           # Client portal features
│   ├── 📁 modules/              # Reusable UI modules
│   ├── 📁 services/             # Frontend services
│   ├── 📁 styles/               # CSS architecture
│   │   ├── 📁 base/             # Base styles (reset, typography)
│   │   ├── 📁 components/       # Component styles
│   │   └── 📁 pages/            # Page-specific styles
│   ├── 📁 utils/                # Utility functions
│   └── vite-env.d.ts            # Vite environment type definitions
├── 📁 templates/                # EJS templates
│   ├── 📁 pages/                # Page templates
│   └── 📁 partials/             # Reusable template parts
├── .env.example                 # Environment configuration template
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite build configuration
└── package.json                 # Dependencies and scripts
```

## 🗄️ Database Schema

The application uses SQLite with the following main entities:

### Users

- **id**: Primary key
- **email**: Unique email address
- **password**: Bcrypt hashed password
- **role**: 'admin' | 'client'
- **status**: 'active' | 'inactive' | 'pending'
- **createdAt**: Timestamp

### Clients

- **id**: Primary key
- **userId**: Foreign key to users
- **company**: Company name
- **contactName**: Primary contact
- **phone**: Phone number
- **address**: Business address
- **createdAt**: Timestamp

### Projects

- **id**: Primary key
- **clientId**: Foreign key to clients
- **title**: Project title
- **description**: Project description
- **status**: 'planning' | 'active' | 'completed' | 'cancelled'
- **budget**: Project budget
- **timeline**: Estimated timeline
- **createdAt**: Timestamp

### IntakeForms

- **id**: Primary key
- **intake_id**: Unique intake identifier
- **client_id**: Foreign key to clients
- **company_name**: Client company name
- **first_name**, **last_name**: Client contact information
- **email**: Client email address
- **phone**: Client phone number
- **project_type**: Type of project requested
- **budget_range**: Budget range selection
- **timeline**: Expected timeline
- **project_description**: Detailed project requirements
- **status**: 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'converted'
- **created_at**: Timestamp

### Messages & Communication

- **messages**: Project-specific messages
  - **id**: Primary key
  - **project_id**: Foreign key to projects
  - **sender_type**: 'client' | 'admin' | 'system'
  - **sender_name**: Message sender identifier
  - **message**: Message content
  - **message_type**: 'text' | 'system' | 'file' | 'update'
  - **priority**: 'low' | 'normal' | 'high' | 'urgent'
  - **reply_to**: Reference to parent message
  - **attachments**: JSON array of file attachments
  - **is_read**: Read status boolean
  - **thread_id**: Reference to message thread
  - **created_at**: Timestamp

- **message_threads**: Conversation organization
  - **id**: Primary key
  - **project_id**: Optional project association
  - **client_id**: Foreign key to clients
  - **subject**: Thread subject line
  - **thread_type**: 'general' | 'project' | 'support' | 'quote'
  - **status**: 'active' | 'closed' | 'archived'
  - **priority**: Message thread priority level
  - **last_message_at**: Last activity timestamp
  - **last_message_by**: Last message sender
  - **participant_count**: Number of thread participants
  - **created_at**: Timestamp

- **general_messages**: Non-project specific messages
  - **id**: Primary key
  - **client_id**: Foreign key to clients
  - **sender_type**: Message sender type
  - **subject**: Message subject
  - **message**: Message content
  - **message_type**: 'inquiry' | 'quote_request' | 'support' | 'feedback'
  - **priority**: Priority level
  - **status**: 'new' | 'read' | 'replied' | 'closed'
  - **reply_to**: Parent message reference
  - **attachments**: File attachments JSON
  - **thread_id**: Thread association
  - **created_at**: Timestamp

- **notification_preferences**: Client notification settings
  - **id**: Primary key
  - **client_id**: Foreign key to clients (unique)
  - **email_notifications**: Email notification enabled
  - **project_updates**: Project update notifications
  - **new_messages**: New message notifications
  - **milestone_updates**: Milestone notification preferences
  - **invoice_notifications**: Invoice-related notifications
  - **marketing_emails**: Marketing email preferences
  - **notification_frequency**: 'immediate' | 'daily' | 'weekly' | 'none'
  - **created_at**: Timestamp

### Project Management

- **milestones**: Project milestone tracking
  - **id**: Primary key
  - **project_id**: Foreign key to projects
  - **title**: Milestone title
  - **description**: Detailed description
  - **due_date**: Target completion date
  - **completed_date**: Actual completion date
  - **is_completed**: Completion status boolean
  - **deliverables**: JSON array of deliverable items
  - **created_at**, **updated_at**: Timestamps

- **invoices**: Financial tracking
  - **id**: Primary key
  - **invoice_number**: Unique invoice identifier
  - **project_id**: Associated project
  - **client_id**: Foreign key to clients
  - **amount_total**: Total invoice amount
  - **amount_paid**: Amount paid to date
  - **currency**: Currency code (default: USD)
  - **status**: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  - **due_date**: Payment due date
  - **issued_date**: Invoice issue date
  - **paid_date**: Payment completion date
  - **payment_method**: Payment method used
  - **payment_reference**: Payment reference number
  - **line_items**: JSON array of invoice line items
  - **notes**: Additional invoice notes
  - **terms**: Payment terms and conditions
  - **created_at**, **updated_at**: Timestamps

## 🛠️ Configuration

### Environment Variables

The application uses comprehensive environment configuration. Copy `.env.example` to `.env` and configure:

#### Required Variables

```env
NODE_ENV=development|production
PORT=4001
FRONTEND_URL=http://localhost:4000
JWT_SECRET=your-secret-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=secure-password
```

#### Optional Variables

```env
# Database
DATABASE_PATH=./data/client_portal.db

# Client Portal URLs
CLIENT_PORTAL_URL=http://localhost:4000/client/portal
WEBSITE_URL=http://localhost:4000

# Email Configuration
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="No Bhad Codes <nobhaduri@gmail.com>"
SMTP_REPLY_TO=nobhaduri@gmail.com
SUPPORT_EMAIL=nobhaduri@gmail.com

# Third-Party Services (Contact Forms)
VITE_FORMSPREE_FORM_ID=your-formspree-form-id
VITE_EMAILJS_SERVICE_ID=your-emailjs-service-id
VITE_EMAILJS_TEMPLATE_ID=your-emailjs-template-id
VITE_EMAILJS_PUBLIC_KEY=your-emailjs-public-key

# Error Tracking
SENTRY_DSN=
SENTRY_ENVIRONMENT=development

# Redis Cache (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### TypeScript Configuration

The project uses strict TypeScript configuration with:

- **Target**: ES2020
- **Module**: ES2020
- **Strict Mode**: Enabled
- **Path Mapping**: `@/*` → `src/*`

## 🔌 API Documentation

### Authentication Endpoints

#### POST `/api/auth/login`

Authenticate client credentials and return JWT token.

**Request Body:**

```json
{
  "email": "client@example.com",
  "password": "password123"
}
```

**Response:** JWT is set in an HttpOnly cookie; the body does not include the token.

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "client@example.com",
      "name": "John Doe",
      "companyName": "Example Corp",
      "contactName": "John Doe",
      "status": "active",
      "isAdmin": false
    },
    "expiresIn": "7d"
  }
}
```

#### POST `/api/intake`

Submit client intake form data.

**Request Body:**

```json
{
  "projectType": "business-site",
  "company": "Example Corp",
  "contactName": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "projectDescription": "Need a professional website",
  "timeline": "1-3-months",
  "budget": "5000-10000",
  "features": ["contact-form", "blog", "cms"],
  "pages": "6-10"
}
```

### Client Management Endpoints

#### GET `/api/clients`

Get all clients (admin only)

#### GET `/api/clients/:id`

Get specific client details

#### PUT `/api/clients/:id`

Update client information

### Project Management Endpoints

#### GET `/api/projects`

Get projects for authenticated user

#### POST `/api/projects`

Create new project

#### PUT `/api/projects/:id`

Update project status/details

### Messaging System Endpoints

#### GET `/api/messages/threads`

Get all message threads for authenticated user.

**Response:**

```json
{
  "threads": [
    {
      "id": 1,
      "subject": "Website Development Inquiry",
      "thread_type": "general",
      "status": "active",
      "priority": "normal",
      "last_message_at": "2025-01-02T10:30:00Z",
      "last_message_by": "John Doe",
      "message_count": 5,
      "unread_count": 2,
      "project_name": "E-commerce Site"
    }
  ]
}
```

#### POST `/api/messages/threads`

Create a new message thread.

**Request Body:**

```json
{
  "subject": "New Project Discussion",
  "thread_type": "project",
  "priority": "normal",
  "project_id": 123
}
```

#### GET `/api/messages/threads/:id/messages`

Get all messages in a specific thread.

**Response:**

```json
{
  "thread": {
    "id": 1,
    "subject": "Website Development",
    "status": "active"
  },
  "messages": [
    {
      "id": 1,
      "sender_type": "client",
      "sender_name": "John Doe",
      "message": "I need help with my website project",
      "priority": "normal",
      "attachments": [],
      "is_read": true,
      "created_at": "2025-01-02T10:00:00Z"
    }
  ]
}
```

#### POST `/api/messages/threads/:id/messages`

Send a new message in a thread (supports file attachments).

**Request Body (multipart/form-data):**

```text
message: "Here's my response to your question"
priority: "normal"
reply_to: 5
attachments: [File objects]
```

#### PUT `/api/messages/threads/:id/read`

Mark all messages in a thread as read.

#### POST `/api/messages/inquiry`

Send a quick inquiry (creates thread automatically).

**Request Body (multipart/form-data):**

```text
subject: "New Project Inquiry"
message: "I'm interested in developing a new website"
message_type: "inquiry"
priority: "normal"
attachments: [File objects]
```

#### GET `/api/messages/preferences`

Get client notification preferences.

#### PUT `/api/messages/preferences`

Update client notification preferences.

**Request Body:**

```json
{
  "email_notifications": true,
  "project_updates": true,
  "new_messages": true,
  "milestone_updates": false,
  "invoice_notifications": true,
  "marketing_emails": false,
  "notification_frequency": "immediate"
}
```

#### GET `/api/messages/analytics` *(Admin Only)*

Get messaging system analytics and statistics.

**Response:**

```json
{
  "analytics": {
    "total_threads": 45,
    "active_threads": 32,
    "total_messages": 234,
    "unread_messages": 12,
    "client_messages": 156,
    "admin_messages": 78,
    "inquiries": 23,
    "urgent_messages": 3
  },
  "recentActivity": [
    {
      "subject": "Website Updates",
      "thread_type": "project",
      "priority": "normal",
      "last_message_at": "2025-01-02T15:30:00Z",
      "last_message_by": "Admin",
      "company_name": "Example Corp",
      "contact_name": "John Doe"
    }
  ]
}
```

## 🎨 Frontend Architecture

### Module System

All frontend modules extend the `BaseModule` class:

```typescript
import { BaseModule } from './base.js';

export class MyModule extends BaseModule {
  constructor(container: HTMLElement) {
    super('my-module', container);
  }

  protected override async onInit(): Promise<void> {
    // Module initialization
  }

  protected override async onDestroy(): Promise<void> {
    // Cleanup logic
  }
}
```

### State Management

Centralized state management with pub-sub pattern:

```typescript
import { StateManager } from '@/core/state.js';

import { createLogger } from '../utils/logger';

const logger = createLogger('MyModule');

// Subscribe to state changes
StateManager.subscribe('user', (user) => {
  logger.log('User updated:', user); // Debug logs only in development
});

// Update state
StateManager.setState('user', { id: 1, name: 'John' });
```

### Key Frontend Modules

#### Communication & Messaging

- **MessagingModule** (`src/modules/messaging.ts`): Complete messaging system
  - Thread management with project association
  - Real-time message sending and receiving
  - File attachment handling up to 5MB
  - Priority levels and read status tracking
  - Email notification triggers
  - Responsive design with mobile support

#### Client Portal Features

- **ClientPortalModule** (`src/features/client/client-portal.ts`): Main portal interface
  - Secure authentication and session management
  - Project dashboard with progress tracking
  - Interactive project timeline and milestones
  - File management and downloads

#### Core UI Components

- **ThemeModule**: Dark/light theme switching with localStorage persistence
- **IntroAnimationModule**: CLS-safe intro animations using GSAP
- **BusinessCardRenderer**: Manages business card animations and interactions
- **NavigationModule**: Navigation with router service integration
- **ContactFormModule**: Form handling with backend service integration
- **FooterModule**: Footer interactions and visibility management

### Service Layer

Services are registered with the DI container:

```typescript
import { container } from '@/core/container.js';
import { ApiService } from '@/services/api.js';

// Register service
container.register('apiService', ApiService);

// Use service in modules
const apiService = container.get<ApiService>('apiService');
```

#### Available Services (Singleton Pattern)

- **RouterService**: Client-side routing with smooth scrolling
- **DataService**: Centralized data management with caching
- **ContactService**: Form submission handling (Netlify integration)
- **PerformanceService**: Core Web Vitals monitoring and reporting
- **BundleAnalyzerService**: Bundle size analysis and optimization
- **VisitorTrackingService**: Privacy-respecting analytics with consent
- **CodeProtectionService**: Security and code protection features

## 🔒 Security Features

### Authentication & Authorization

- **JWT Tokens**: Secure token-based authentication
- **Role-Based Access**: Admin and client role separation
- **Token Refresh**: Automatic token renewal
- **Session Management**: Secure session handling

### Input Validation & Sanitization

- **Schema Validation**: Comprehensive input validation
- **XSS Prevention**: HTML sanitization
- **SQL Injection Protection**: Parameterized queries
- **CSRF Protection**: Token-based CSRF prevention

### Security Headers & Middleware

- **Helmet.js**: Security headers configuration
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **File Upload Security**: Type and size validation

## 📊 Monitoring & Logging

### Centralized Logging

- **Structured Logging**: JSON-formatted log entries
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Request Correlation**: Unique request IDs
- **Performance Monitoring**: Request timing and metrics
- **Security Events**: Authentication and authorization logging

### Error Handling

- **Global Error Handler**: Centralized error processing
- **Error Categorization**: Structured error codes
- **Context Preservation**: Full request context in errors
- **Production Safety**: Sensitive data filtering

## 🧪 Testing

### Test Structure

```bash
tests/
├── unit/           # Unit tests (Vitest)
├── e2e/            # End-to-end tests (Playwright)
├── mocks/          # Test data and mocks
└── setup/          # Test setup and utilities
```

### Running Tests

```bash
# Unit tests
npm run test

# With UI
npm run test:ui

# Coverage report
npm run test:coverage

# E2E tests
npx playwright test
```

## 🚀 Deployment

### Production Build

```bash
# Build the application
npm run build

# Preview production build locally
npm run preview

# Run production server
NODE_ENV=production tsx server/app.ts
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secrets
4. Configure email service
5. Set up SSL/TLS certificates
6. Configure reverse proxy (nginx/apache)

### Docker Deployment (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY public/ ./public/
EXPOSE 4001
CMD ["node", "dist/server/app.js"]
```

## 🤝 Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open** Pull Request

### Code Standards

- **TypeScript**: Strict mode with comprehensive typing
- **ESLint**: Enforced code quality rules
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Semantic commit messages
- **Husky**: Pre-commit hooks for quality checks

### Pull Request Guidelines

- Follow existing code patterns
- Add tests for new features
- Update documentation
- Ensure all checks pass
- Provide clear description

## 🐛 Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Kill processes on ports 4000/4001
lsof -ti:4000 | xargs kill -9
lsof -ti:4001 | xargs kill -9
```

#### Database Issues

```bash
# Reset database
rm data/client_portal.db
npm run db:setup
```

#### TypeScript Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run typecheck
```

#### Build Issues

```bash
# Clear build cache
rm -rf dist
npm run build
```

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/noellebhaduri/no-bhad-codes/issues)
- **Discussions**: [GitHub Discussions](https://github.com/noellebhaduri/no-bhad-codes/discussions)
- **Email**: <nobhaduri@gmail.com>

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 👩‍💻 Author

### Noelle Bhaduri

- Website: [nobhad.codes](https://nobhad.codes)
- Email: <nobhaduri@gmail.com>
- GitHub: [@noellebhaduri](https://github.com/noellebhaduri)
- LinkedIn: [Noelle Bhaduri](https://linkedin.com/in/noellebhaduri)

---

### Built with ❤️ using modern web technologies

[TypeScript](https://www.typescriptlang.org/) • [Node.js](https://nodejs.org/) • [Express](https://expressjs.com/) • [Vite](https://vitejs.dev/) • [GSAP](https://greensock.com/gsap/)
