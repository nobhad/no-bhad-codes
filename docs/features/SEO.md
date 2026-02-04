# SEO Optimization

**Status:** Complete
**Last Updated:** February 2, 2026

## Overview

Comprehensive SEO optimization for the No Bhad Codes portfolio site including meta tags, structured data, robots.txt, and sitemap.

## Implementation

### Meta Tags

Located in `/index.html` `<head>` section.

#### Core SEO Tags

```html
<meta name="description" content="Professional web development services by Noelle Bhaduri. Custom websites, client portals, and modern web applications." />
<meta name="author" content="Noelle Bhaduri" />
<meta name="keywords" content="web development, portfolio, typescript, client management, professional websites" />
<link rel="canonical" href="https://nobhad.codes/" />
```

#### Open Graph Tags

For Facebook, LinkedIn, and general social sharing:

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="No Bhad Codes - Professional Web Development" />
<meta property="og:description" content="Professional web development services by Noelle Bhaduri" />
<meta property="og:site_name" content="No Bhad Codes" />
<meta property="og:url" content="https://nobhad.codes/" />
<meta property="og:locale" content="en_US" />
```

#### Twitter Card Tags

For Twitter/X sharing:

```html
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="No Bhad Codes - Professional Web Development" />
<meta name="twitter:description" content="Professional web development services by Noelle Bhaduri" />
```

### JSON-LD Structured Data

Located in `/index.html` before `</head>`. Uses Schema.org vocabulary with three connected entities:

#### WebSite Schema

```json
{
  "@type": "WebSite",
  "@id": "https://nobhad.codes/#website",
  "url": "https://nobhad.codes/",
  "name": "No Bhad Codes",
  "description": "Professional web development services by Noelle Bhaduri",
  "publisher": { "@id": "https://nobhad.codes/#person" }
}
```

#### Person Schema

```json
{
  "@type": "Person",
  "@id": "https://nobhad.codes/#person",
  "name": "Noelle Bhaduri",
  "url": "https://nobhad.codes/",
  "email": "nobhaduri@gmail.com",
  "jobTitle": "Full-Stack Web Developer",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Boston",
    "addressRegion": "MA",
    "addressCountry": "US"
  },
  "sameAs": [
    "https://github.com/nobhad",
    "https://www.linkedin.com/in/noelle-b-676286106/"
  ],
  "knowsAbout": ["Web Development", "TypeScript", "React", "Node.js"]
}
```

#### ProfessionalService Schema

```json
{
  "@type": "ProfessionalService",
  "@id": "https://nobhad.codes/#service",
  "name": "No Bhad Codes",
  "url": "https://nobhad.codes/",
  "description": "Professional web development services",
  "provider": { "@id": "https://nobhad.codes/#person" },
  "areaServed": "Boston, MA",
  "serviceType": ["Web Development", "Custom Website Design", "Client Portal Development"]
}
```

### robots.txt

Located at `/public/robots.txt`. Controls search engine crawler access.

```text
User-agent: *
Allow: /

Disallow: /admin
Disallow: /admin/
Disallow: /client/
Disallow: /api/

Allow: /images/
Allow: /fonts/

Sitemap: https://nobhad.codes/sitemap.xml
```

**Crawl Rules:**

- Main site is fully crawlable
- Admin portal, client portal, and API are blocked from indexing
- Static assets (images, fonts) are explicitly allowed
- Sitemap location is declared

### sitemap.xml

Located at `/public/sitemap.xml`. Lists all crawlable pages.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://nobhad.codes/</loc>
    <lastmod>2026-02-02</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

**Note:** Hash-based routes (#/about, #/contact, #/projects) are not included because search engines do not follow hash fragments. All SPA content is accessible from the main URL.

## Files Modified/Created

|File|Action|Description|
|------|--------|-------------|
|`/index.html`|Modified|Added canonical, og:url, og:locale, Twitter Card, JSON-LD|
|`/public/robots.txt`|Created|Crawler access rules|
|`/public/sitemap.xml`|Created|Site map for search engines|

## Pending: OG Image

OG image tags are intentionally omitted until an image is created.

**When ready:**

1. Create a 1200x630 PNG image for social sharing previews
2. Save to: `/public/images/og-image.png`
3. Add to `/index.html`:

```html
<meta property="og:image" content="https://nobhad.codes/images/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="No Bhad Codes - Professional Web Development" />
<meta name="twitter:image" content="https://nobhad.codes/images/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
```

**Note:** When og:image is added, change `twitter:card` from `summary` to `summary_large_image` for better display.

## Verification Tools

Test the implementation with these tools:

- **Google Rich Results Test:** <https://search.google.com/test/rich-results>
- **Facebook Sharing Debugger:** <https://developers.facebook.com/tools/debug/>
- **Twitter Card Validator:** <https://cards-dev.twitter.com/validator>
- **Robots.txt Tester:** <https://www.google.com/webmasters/tools/robots-testing-tool>

## Maintenance

### Updating the Sitemap

Update `lastmod` in `/public/sitemap.xml` when significant content changes are made to the main site.

### Adding New Public Pages

If new public pages are added (not hash-based routes), add them to the sitemap:

```xml
<url>
  <loc>https://nobhad.codes/new-page</loc>
  <lastmod>YYYY-MM-DD</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

### Updating Structured Data

If contact information, social profiles, or service offerings change, update the JSON-LD in `/index.html`.

## Change Log

### February 2, 2026 - Initial Implementation

- Added canonical URL
- Added og:url and og:locale to Open Graph
- Added Twitter Card meta tags
- Added JSON-LD structured data (WebSite, Person, ProfessionalService)
- Created robots.txt
- Created sitemap.xml
