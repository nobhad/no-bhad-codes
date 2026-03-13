# Installation Guide

This guide covers setting up the no-bhad-codes project locally from scratch.

For full system details see [`SYSTEM_DOCUMENTATION.md`](../SYSTEM_DOCUMENTATION.md) and
[`DEVELOPER_GUIDE.md`](../DEVELOPER_GUIDE.md).

## Prerequisites

- **Node.js** 20.x
- **npm** 8+
- **Git**
- Modern browser for testing (Chrome 90+, Firefox 88+, Safari 14+)

## Steps

### 1. Clone the repository

```bash
git clone https://github.com/noellebhaduri/no-bhad-codes.git
cd no-bhad-codes
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration. Required variables:

```bash
# Application
NODE_ENV=development
PORT=4001
FRONTEND_URL=http://localhost:4000

# Security — use a random string of at least 32 characters
JWT_SECRET="your-development-jwt-secret-min-32-chars"
JWT_EXPIRES_IN="7d"

# Database
DATABASE_PATH=./data/client_portal.db

# Admin accounts
ADMIN_EMAIL="your-admin@email.com"
SUPPORT_EMAIL="your-support@email.com"

# Email (optional for development)
EMAIL_ENABLED=false

# Feature flags
ENABLE_FILE_UPLOAD=true
MAINTENANCE_MODE=false
```

### 4. Set up the database

```bash
npm run db:setup
```

This runs all pending migrations and creates the SQLite database at `DATABASE_PATH`.

### 5. Start the development server

```bash
npm run dev:full
```

This starts both the Vite frontend (port 4000) and the Node.js backend (port 4001) concurrently.

- Frontend: `http://localhost:4000`
- Backend API: `http://localhost:4001`

## Verifying the installation

Once the server is running:

- Main site: `http://localhost:4000`
- Admin portal: `http://localhost:4000/admin/`
- Client portal: `http://localhost:4000/client/portal`
- API health: `http://localhost:4001/api/health`

## Troubleshooting

- **Port conflicts** — Change `PORT` in `.env` if 4001 is in use; change the Vite port in `vite.config.ts`
- **Database errors** — Run `npm run migrate:status` to check migration state; `npm run migrate` to apply pending ones
- **Missing env vars** — The server will log which required variables are missing on startup
