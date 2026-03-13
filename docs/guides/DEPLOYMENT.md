# Deployment Guide

This is a summary of deployment steps. Full details are in
[`SYSTEM_DOCUMENTATION.md`](../SYSTEM_DOCUMENTATION.md#deployment-guide).

## Build

```bash
npm run build
```

This produces a production-ready bundle in the `dist/` directory.

## Start the production server

```bash
npm start
```

## Production environment variables

Set these in your server environment (not in a committed `.env` file):

```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://yourdomain.com
DATABASE_PATH=/app/data/production.db

# Security — use a strong random secret
JWT_SECRET=your-production-secret

# Email
SMTP_HOST=your-smtp-server
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-email-password
SMTP_FROM=noreply@yourdomain.com

# Error tracking (optional)
SENTRY_DSN=
```

## Server requirements

- **Memory:** 512 MB minimum, 1 GB recommended
- **Storage:** 10 GB minimum (application + file uploads)
- **CPU:** 1 vCPU minimum, 2 vCPU recommended
- **Network:** HTTPS enabled, firewall configured
- **Database:** SQLite file with a backup strategy in place

## Deployment checklist

- [ ] All environment variables configured on the server
- [ ] Database migrations applied (`npm run migrate`)
- [ ] File upload directories created with correct permissions
- [ ] SSL certificate installed
- [ ] Email service configured and tested
- [ ] Error tracking (Sentry) configured if used
- [ ] Backup strategy in place
- [ ] Monitoring and logging set up

## Database backup

```bash
npm run db:backup
```

Retention policy: 7 daily backups, 4 weekly backups.

## Code quality before deployment

Always run these checks before deploying:

```bash
npm run typecheck   # TypeScript — must have 0 errors
npm run lint        # ESLint — must pass
npm run build       # Confirm build succeeds
```
