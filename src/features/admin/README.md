# Admin Dashboard

A secure, private dashboard for monitoring website performance and analytics.

## Access

The dashboard is accessible at `/admin.html` and requires authentication.

**Default Access Key:** `hello` (change in production)

## Features

### 🔐 Security
- **Authentication Required:** SHA-256 hashed access key
- **Rate Limiting:** Maximum 3 login attempts with 15-minute lockout
- **Session Management:** 1-hour session timeout with auto-extension
- **CSP Monitoring:** Content Security Policy violation detection
- **Integrity Checks:** Protection against script injection
- **Dev Tools Detection:** Alerts when developer tools are opened

### 📊 Overview Tab
- **Real-time Metrics:** Visitor count, page views, session duration
- **Business Card Interactions:** Track card flip interactions
- **Visual Charts:** Visitor trends and traffic sources (placeholder)

### ⚡ Performance Tab  
- **Core Web Vitals:** LCP, FID, CLS monitoring
- **Bundle Analysis:** JavaScript and CSS bundle sizes
- **Performance Timeline:** Historical performance data

### 📈 Analytics Tab
- **Popular Pages:** Most visited pages and sections
- **Device Breakdown:** Desktop, mobile, tablet usage
- **Geographic Data:** Visitor location distribution  
- **Engagement Events:** Interaction tracking

### 👥 Visitors Tab
- **Visitor Records:** Individual visitor tracking
- **Session Data:** Visit frequency and duration
- **Search & Filter:** Find specific visitors
- **Detailed Profiles:** Location and device information

### 🛠️ System Tab
- **Application Status:** Module and service health
- **Data Export:** Export analytics, visitor, and performance data
- **Data Management:** Clear old data or reset analytics

## Technical Details

### Architecture
- **Frontend:** TypeScript, Modern CSS, Secure Authentication
- **Build:** Vite with separate admin chunk (code-splitting)
- **Storage:** SessionStorage for auth, LocalStorage for rate limiting
- **Security:** Multiple layers of protection

### File Structure

```text
src/features/admin/
├── admin-dashboard.ts        # Main dashboard controller (~1,900 lines)
├── admin-project-details.ts  # Project detail view (~1,300 lines)
├── admin-auth.ts             # Authentication
├── admin-security.ts         # Rate limiting
└── README.md                 # This file

src/features/admin/modules/   # Extracted modules (10 modules)
├── admin-analytics.ts        # Analytics and charts (~900 lines)
├── admin-clients.ts          # Client management (~850 lines)
├── admin-contacts.ts         # Contact form submissions (~250 lines)
├── admin-leads.ts            # Leads management (~450 lines)
├── admin-messaging.ts        # Messaging system (~400 lines)
├── admin-overview.ts         # Dashboard overview (~200 lines)
├── admin-performance.ts      # Performance monitoring (~400 lines)
├── admin-projects.ts         # Projects management (~1000 lines)
├── admin-system-status.ts    # System status display (~340 lines)
└── index.ts                  # Module exports

admin/index.html              # Dashboard HTML entry point
src/styles/pages/admin.css    # Dashboard styles (~1,850 lines)
src/styles/admin/             # Admin style modules
├── auth.css                  # Authentication styles
├── modals.css                # Modal styles
├── analytics.css             # Analytics/charts styles
├── project-detail.css        # Project detail styles
└── index.css                 # Module imports
```

## Related Documentation

- [Admin Dashboard Feature](../../../docs/features/ADMIN_DASHBOARD.md) - Complete admin dashboard documentation

### Integration Points
- **NBW_DEBUG Global:** Integrates with main app debug utilities
- **Performance Service:** Real Core Web Vitals data
- **Visitor Tracking:** Actual analytics when available  
- **Bundle Analyzer:** Real bundle size information

## Development

### Running Locally

```bash
npm run dev:full
# Navigate to http://localhost:4000/admin
```

### Building
```bash
npm run build
# Creates dist/admin.html
```

### Authentication
The dashboard uses SHA-256 hashing for the access key. To change the key:

1. Generate new hash:
```javascript
const key = 'your-new-key';
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
console.log(Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
```

2. Update `AUTH_KEY_HASH` in `admin-dashboard.ts`

## Security Considerations

### Production Deployment
- [ ] Change default access key
- [ ] Enable HTTPS only
- [ ] Configure proper CSP headers
- [ ] Set up server-side rate limiting
- [ ] Enable security headers (HSTS, X-Frame-Options, etc.)
- [ ] Consider IP allowlisting
- [ ] Set up monitoring/alerting for access attempts

### Server Configuration
```nginx
# Nginx example
location /admin.html {
    # Restrict access by IP
    allow 203.0.113.0/24;
    deny all;
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

## Monitoring

The dashboard logs security events to the console:
- Failed authentication attempts
- Rate limiting activations  
- CSP violations
- Dev tools detection
- Suspicious referrers

## Data Export

All data can be exported as JSON files:
- **Analytics Export:** Page views, visitor data, events
- **Visitor Export:** Detailed visitor profiles and sessions
- **Performance Export:** Core Web Vitals and bundle metrics

## Privacy & Compliance

- No personal data storage (visitor IDs are anonymized)
- Respects DNT (Do Not Track) headers
- Cookie consent integration
- GDPR-compliant data handling
- Configurable data retention (default: 90 days)