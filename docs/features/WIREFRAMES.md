# Wireframe Preview System (Site Feature)

**Status:** Complete (Documentation Only)
**Last Updated:** February 2, 2026

**This doc is for the SITE FEATURE:** client-facing wireframe previews (admins upload wireframe screenshots to project Files; clients view them in the Files tab). For **greyscale portal mode** (admin/client UI with `?wireframe=1`) and **reusable components**, see [WIREFRAME_AND_COMPONENTS.md](../design/WIREFRAME_AND_COMPONENTS.md).

## Overview

Wireframe previews for client projects using the existing Files system. No code changes required - leverages existing file upload and preview infrastructure.

## Approach

Use **screenshots** of wireframes uploaded via the existing Files system:

- Zero development time
- Uses existing infrastructure (file uploads, preview)
- Can upgrade to interactive system later if clients request it

## Naming Convention

```text
{project-slug}_{page}_{tier}.png

Examples:
hedgewitch_homepage_better.png
hedgewitch_homepage_best.png
hedgewitch_gallery_better.png
hedgewitch_gallery_best.png
hedgewitch_contact_better.png
hedgewitch_admin_best.png
```

## File Organization

Upload wireframes to project Files tab with clear naming. Current file system is flat per project, so use naming prefix to group:

```text
wf_hedgewitch_homepage_better.png
wf_hedgewitch_homepage_best.png
wf_hedgewitch_gallery_better.png
wireframe_hedgewitch_contact_best.png
```

## Screenshot Best Practices

1. **Full page screenshots** - Capture entire page (browser extension or dev tools)
2. **Consistent browser width** - Use 1440px for desktop, 375px for mobile
3. **Both tiers** - Screenshot Better and Best versions of each page
4. **PNG format** - For crisp text and UI elements
5. **Descriptive names** - Include page name and tier in filename

## How to Take Full-Page Screenshots

### Chrome DevTools

1. Open DevTools (F12)
2. Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows)
3. Type "Capture full size screenshot"
4. Press Enter

### Firefox

1. Right-click on page
2. Select "Take Screenshot"
3. Click "Save full page"

### Browser Extensions

- **GoFullPage** (Chrome) - One-click full page capture
- **Fireshot** (Chrome/Firefox) - Full page with options

## Client Workflow

1. Admin uploads wireframe screenshots to project Files
2. Client receives notification (if enabled)
3. Client views in Files tab → Preview button
4. Client can download for offline review

## Existing Infrastructure Used

This approach uses:

- Existing file upload system (`portal-files.ts`)
- Existing file preview for images
- Existing client portal Files tab
- Existing download functionality

## Future Upgrade Path

If clients request more interactivity:

1. Add dedicated "Wireframes" tab to portal
2. Display screenshots in gallery view
3. Add tier comparison slider
4. Eventually: embed interactive HTML wireframes

## Related Documentation

- [FILES.md](./FILES.md) - File upload and preview system
- [CLIENT_PORTAL.md](./CLIENT_PORTAL.md) - Client portal overview
- [WIREFRAME_AND_COMPONENTS.md](../design/WIREFRAME_AND_COMPONENTS.md) - Greyscale portal mode and reusable components (different from this site feature)
