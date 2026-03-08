/**
 * ===============================================
 * CONTACT SERVICE EXTENDED TESTS
 * ===============================================
 * @file tests/unit/services/contact-service-extended.test.ts
 *
 * Extended coverage for src/services/contact-service.ts targeting
 * the methods and branches not covered by contact-service.test.ts.
 * Covers: all backend submission paths (netlify, formspree, emailjs,
 *         custom), rate-limit rejection, XSS rejection, network errors,
 *         getConfig, getStatus, updateConfig, validateForm,
 *         generateEmailTemplate, generateAutoReplyTemplate,
 *         getMetrics, resetMetrics, clearRateLimitData.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { ContactService, type ContactFormData } from '../../../src/services/contact-service';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// SanitizationUtils — pass-through for most methods; allow test control of
// detectXss and checkRateLimit via vi.fn().
vi.mock('../../../src/utils/sanitization-utils', () => ({
  SanitizationUtils: {
    sanitizeText: vi.fn((v: string) => (v ? v.trim() : '')),
    sanitizeEmail: vi.fn((v: string) => (v ? v.toLowerCase().trim() : '')),
    sanitizeMessage: vi.fn((v: string) => (v ? v.trim() : '')),
    detectXss: vi.fn(() => false),
    checkRateLimit: vi.fn(() => true),
    logSecurityViolation: vi.fn(),
    escapeHtml: vi.fn((v: string) => v ?? '')
  }
}));

// Config mocks
vi.mock('../../../src/config/api', () => ({
  getFormspreeUrl: vi.fn((formId: string) => `https://formspree.io/f/${formId}`)
}));

vi.mock('../../../src/config/branding', () => ({
  getContactEmail: vi.fn(() => 'contact@example.com')
}));

vi.mock('../../../src/config/constants', () => ({
  APP_CONSTANTS: {
    RATE_LIMITS: { FORM_SUBMISSIONS: 5 },
    TIMERS: { RATE_LIMIT_WINDOW: 300000 }
  }
}));

// Logger mock
vi.mock('../../../src/utils/logger', () => ({
  createLogger: () => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
global.fetch = vi.fn() as Mock;

const VALID_DATA: ContactFormData = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  companyName: 'ACME Corp',
  message: 'Hello, I am interested in your services!'
};

function makeOkResponse(body: unknown = { success: true }): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response;
}

function makeErrorResponse(status: number, statusText = 'Error'): Response {
  return {
    ok: false,
    status,
    statusText,
    text: vi.fn().mockResolvedValue(`Error ${status}`),
    json: vi.fn().mockRejectedValue(new Error('parse error'))
  } as unknown as Response;
}

async function makeNetlify(): Promise<ContactService> {
  // Always ensure rate limit passes and XSS is not detected by default
  const { SanitizationUtils } = await import('../../../src/utils/sanitization-utils');
  vi.mocked(SanitizationUtils.checkRateLimit).mockReturnValue(true);
  vi.mocked(SanitizationUtils.detectXss).mockReturnValue(false);
  const svc = new ContactService({ backend: 'netlify' });
  await svc.init();
  return svc;
}

// ---------------------------------------------------------------------------
// Netlify submission
// ---------------------------------------------------------------------------
describe('ContactService — submitToNetlify', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = await makeNetlify();
  });

  it('returns success: true on 200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse());
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(true);
    expect(result.message).toContain('thanks');
  });

  it('POSTs to "/" with url-encoded form-name field', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse());
    await svc.submitForm(VALID_DATA);

    expect(fetch).toHaveBeenCalledWith(
      '/',
      expect.objectContaining({ method: 'POST' })
    );
    const [, opts] = (fetch as Mock).mock.calls[0];
    expect(opts.body).toContain('form-name=contact-form');
  });

  it('includes companyName in form body when provided', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse());
    await svc.submitForm(VALID_DATA);
    const [, opts] = (fetch as Mock).mock.calls[0];
    expect(opts.body).toContain('Company-Name');
  });

  it('does not include companyName when it is absent', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse());
    const data = { ...VALID_DATA, companyName: undefined };
    await svc.submitForm(data as ContactFormData);
    const [, opts] = (fetch as Mock).mock.calls[0];
    expect(opts.body).not.toContain('Company-Name');
  });

  it('returns error message on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(500));
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(false);
  });

  it('returns network error message when fetch rejects', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Failed to fetch'));
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Network error');
  });

  it('returns Netlify-specific message on 404', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('404 Netlify form not found'));
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(false);
    expect(result.message).toContain('contact@example.com');
  });
});

// ---------------------------------------------------------------------------
// Formspree submission
// ---------------------------------------------------------------------------
describe('ContactService — submitToFormspree', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = new ContactService({ backend: 'formspree', formId: 'abc123' });
    await svc.init();
  });

  it('returns success: true on 200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse());
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(true);
  });

  it('POSTs to the formspree URL', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse());
    await svc.submitForm(VALID_DATA);
    expect(fetch).toHaveBeenCalledWith(
      'https://formspree.io/f/abc123',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sends JSON body with form fields', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse());
    await svc.submitForm(VALID_DATA);
    const [, opts] = (fetch as Mock).mock.calls[0];
    const body = JSON.parse(opts.body as string);
    expect(body.email).toBeDefined();
    expect(body.message).toBeDefined();
  });

  it('returns error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(422, 'Unprocessable'));
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(false);
  });

  it('returns network error on fetch rejection', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error here'));
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Network error');
  });
});

// ---------------------------------------------------------------------------
// EmailJS submission
// ---------------------------------------------------------------------------
describe('ContactService — submitToEmailJS', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = new ContactService({ backend: 'emailjs', apiKey: 'secret-key' });
    await svc.init();
  });

  afterEach(() => {
    // Clean up window.emailjs
    delete (window as unknown as Record<string, unknown>).emailjs;
    delete (import.meta.env as Record<string, unknown>).VITE_EMAILJS_SERVICE_ID;
    delete (import.meta.env as Record<string, unknown>).VITE_EMAILJS_TEMPLATE_ID;
  });

  it('throws (caught) when emailjs SDK is not loaded', async () => {
    // window.emailjs is not defined
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(false);
  });

  it('throws (caught) when service/template env vars are missing', async () => {
    (window as unknown as Record<string, unknown>).emailjs = { send: vi.fn() };
    // env vars NOT set
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(false);
  });

  it('returns success when emailjs.send resolves', async () => {
    (window as unknown as Record<string, unknown>).emailjs = {
      send: vi.fn().mockResolvedValue({ status: 200 })
    };
    (import.meta.env as Record<string, unknown>).VITE_EMAILJS_SERVICE_ID = 'svc_id';
    (import.meta.env as Record<string, unknown>).VITE_EMAILJS_TEMPLATE_ID = 'tmpl_id';

    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(true);
  });

  it('returns failure when emailjs.send rejects', async () => {
    (window as unknown as Record<string, unknown>).emailjs = {
      send: vi.fn().mockRejectedValue(new Error('emailjs failed'))
    };
    (import.meta.env as Record<string, unknown>).VITE_EMAILJS_SERVICE_ID = 'svc_id';
    (import.meta.env as Record<string, unknown>).VITE_EMAILJS_TEMPLATE_ID = 'tmpl_id';

    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Custom endpoint submission
// ---------------------------------------------------------------------------
describe('ContactService — submitToCustom', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = new ContactService({ backend: 'custom', endpoint: '/api/contact' });
    await svc.init();
  });

  it('returns success: true on 200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse({ message: 'Got it!' }));
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(true);
  });

  it('uses the custom endpoint message from response body', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse({ message: 'Custom success' }));
    const result = await svc.submitForm(VALID_DATA);
    expect(result.message).toBe('Custom success');
  });

  it('uses default message when response has no message field', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse({}));
    const result = await svc.submitForm(VALID_DATA);
    expect(result.message).toContain('thanks');
  });

  it('includes Authorization header when apiKey is configured', async () => {
    vi.clearAllMocks();
    const svcWithKey = new ContactService({
      backend: 'custom',
      endpoint: '/api/contact',
      apiKey: 'my-key'
    });
    await svcWithKey.init();
    vi.mocked(fetch).mockResolvedValue(makeOkResponse());
    await svcWithKey.submitForm(VALID_DATA);
    const [, opts] = (fetch as Mock).mock.calls[0];
    expect((opts.headers as Record<string, string>)['Authorization']).toContain('Bearer my-key');
  });

  it('does not include Authorization header when no apiKey', async () => {
    vi.mocked(fetch).mockResolvedValue(makeOkResponse());
    await svc.submitForm(VALID_DATA);
    const [, opts] = (fetch as Mock).mock.calls[0];
    expect((opts.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('returns error on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(500));
    const result = await svc.submitForm(VALID_DATA);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateConfig edge cases
// ---------------------------------------------------------------------------
describe('ContactService — validateConfig', () => {
  it('throws for emailjs backend without apiKey', async () => {
    const svc = new ContactService({ backend: 'emailjs' });
    await expect(svc.init()).rejects.toThrow('EmailJS backend requires apiKey');
  });

  it('does not throw for netlify backend (no extra config needed)', async () => {
    const svc = new ContactService({ backend: 'netlify' });
    await expect(svc.init()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
describe('ContactService — rate limiting', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Start with rate limit passing, then individual tests override
    const { SanitizationUtils } = await import('../../../src/utils/sanitization-utils');
    vi.mocked(SanitizationUtils.checkRateLimit).mockReturnValue(true);
    vi.mocked(SanitizationUtils.detectXss).mockReturnValue(false);
    svc = await makeNetlify();
  });

  it('rejects submission when rate limit is exceeded', async () => {
    const { SanitizationUtils } = await import('../../../src/utils/sanitization-utils');
    vi.mocked(SanitizationUtils.checkRateLimit).mockReturnValue(false);

    const result = await svc.submitForm(VALID_DATA);

    expect(result.success).toBe(false);
    expect(result.error).toBe('rate_limit');
  });

  it('logs a security violation on rate limit', async () => {
    const { SanitizationUtils } = await import('../../../src/utils/sanitization-utils');
    vi.mocked(SanitizationUtils.checkRateLimit).mockReturnValue(false);

    await svc.submitForm(VALID_DATA);

    expect(SanitizationUtils.logSecurityViolation).toHaveBeenCalledWith(
      'rate_limit_exceeded',
      expect.any(Object),
      expect.any(String)
    );
  });
});

// ---------------------------------------------------------------------------
// XSS detection
// ---------------------------------------------------------------------------
describe('ContactService — XSS detection', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure rate limit passes so XSS check is reached
    const { SanitizationUtils } = await import('../../../src/utils/sanitization-utils');
    vi.mocked(SanitizationUtils.checkRateLimit).mockReturnValue(true);
    // Default: no XSS detected
    vi.mocked(SanitizationUtils.detectXss).mockReturnValue(false);
    svc = await makeNetlify();
  });

  it('rejects submission containing XSS in the message field', async () => {
    const { SanitizationUtils } = await import('../../../src/utils/sanitization-utils');
    vi.mocked(SanitizationUtils.detectXss).mockImplementation((value: string) =>
      value.includes('<script>')
    );

    const result = await svc.submitForm({
      ...VALID_DATA,
      message: '<script>alert(1)</script> Hi!'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Security validation failed');
  });

  it('rejects submission containing XSS in the name field', async () => {
    const { SanitizationUtils } = await import('../../../src/utils/sanitization-utils');
    vi.mocked(SanitizationUtils.detectXss).mockImplementation((value: string) =>
      value.includes('javascript:')
    );

    const result = await svc.submitForm({
      ...VALID_DATA,
      name: 'javascript:alert(0)'
    });

    expect(result.success).toBe(false);
  });

  it('logs a security violation on XSS detection', async () => {
    const { SanitizationUtils } = await import('../../../src/utils/sanitization-utils');
    vi.mocked(SanitizationUtils.detectXss).mockReturnValue(true);

    await svc.submitForm(VALID_DATA);

    expect(SanitizationUtils.logSecurityViolation).toHaveBeenCalledWith(
      'xss_attempt',
      expect.any(Object),
      expect.any(String)
    );
  });
});

// ---------------------------------------------------------------------------
// validateForm (public alias)
// ---------------------------------------------------------------------------
describe('ContactService — validateForm', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = await makeNetlify();
  });

  it('returns isValid: true for valid data', () => {
    const result = svc.validateForm(VALID_DATA);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns isValid: false when name is missing', () => {
    const result = svc.validateForm({ ...VALID_DATA, name: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Name is required');
  });

  it('returns isValid: false when email is invalid', () => {
    const result = svc.validateForm({ ...VALID_DATA, email: 'not-an-email' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Please enter a valid email address');
  });

  it('returns isValid: false when message is too short', () => {
    const result = svc.validateForm({ ...VALID_DATA, message: 'Hi' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Message must be at least 10 characters long');
  });
});

// ---------------------------------------------------------------------------
// generateEmailTemplate
// ---------------------------------------------------------------------------
describe('ContactService — generateEmailTemplate', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = await makeNetlify();
  });

  it('includes the submitter name', () => {
    const html = svc.generateEmailTemplate(VALID_DATA);
    expect(html).toContain(VALID_DATA.name);
  });

  it('includes the submitter email', () => {
    const html = svc.generateEmailTemplate(VALID_DATA);
    expect(html).toContain(VALID_DATA.email);
  });

  it('includes the message text', () => {
    const html = svc.generateEmailTemplate(VALID_DATA);
    expect(html).toContain(VALID_DATA.message);
  });

  it('includes the company name when provided', () => {
    const html = svc.generateEmailTemplate(VALID_DATA);
    expect(html).toContain('ACME Corp');
  });

  it('shows N/A when companyName is absent', () => {
    const html = svc.generateEmailTemplate({ ...VALID_DATA, companyName: undefined });
    expect(html).toContain('N/A');
  });
});

// ---------------------------------------------------------------------------
// generateAutoReplyTemplate
// ---------------------------------------------------------------------------
describe('ContactService — generateAutoReplyTemplate', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = await makeNetlify();
  });

  it('includes the submitter name as a greeting', () => {
    const html = svc.generateAutoReplyTemplate(VALID_DATA);
    expect(html).toContain(VALID_DATA.name);
  });

  it('contains a thank-you message', () => {
    const html = svc.generateAutoReplyTemplate(VALID_DATA);
    expect(html.toLowerCase()).toContain('thank you');
  });
});

// ---------------------------------------------------------------------------
// getConfig / updateConfig
// ---------------------------------------------------------------------------
describe('ContactService — getConfig / updateConfig', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = new ContactService({
      backend: 'custom',
      endpoint: '/api/contact',
      apiKey: 'secret'
    });
    await svc.init();
  });

  it('getConfig returns config without apiKey', () => {
    const cfg = svc.getConfig();
    expect(cfg.backend).toBe('custom');
    expect(cfg.endpoint).toBe('/api/contact');
    expect((cfg as Record<string, unknown>).apiKey).toBeUndefined();
  });

  it('updateConfig merges new values into config', () => {
    svc.updateConfig({ endpoint: '/api/v2/contact' });
    const cfg = svc.getConfig();
    expect(cfg.endpoint).toBe('/api/v2/contact');
  });

  it('updateConfig preserves unchanged values', () => {
    svc.updateConfig({ endpoint: '/api/v2/contact' });
    const cfg = svc.getConfig();
    expect(cfg.backend).toBe('custom');
  });
});

// ---------------------------------------------------------------------------
// getStatus
// ---------------------------------------------------------------------------
describe('ContactService — getStatus', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = await makeNetlify();
  });

  it('returns status with backend field', () => {
    const status = svc.getStatus();
    expect(status.backend).toBe('netlify');
  });

  it('returns status with configured: true for valid config', () => {
    const status = svc.getStatus();
    expect(status.configured).toBe(true);
  });

  it('returns configured: false for invalid config', () => {
    // Create a service that will fail validateConfig
    const badSvc = new ContactService({ backend: 'formspree' }); // missing formId
    const status = badSvc.getStatus();
    expect(status.configured).toBe(false);
  });

  it('includes name and initialized from base status', () => {
    const status = svc.getStatus();
    expect(status.name).toBe('ContactService');
    expect(status.initialized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getMetrics / resetMetrics / clearRateLimitData
// ---------------------------------------------------------------------------
describe('ContactService — metrics / cleanup methods', () => {
  let svc: ContactService;

  beforeEach(async () => {
    vi.clearAllMocks();
    svc = await makeNetlify();
  });

  it('getMetrics returns default metric values', () => {
    const metrics = svc.getMetrics();
    expect(metrics.submissionCount).toBe(0);
    expect(metrics.validationFailures).toBe(0);
    expect(metrics.successRate).toBe(100);
  });

  it('resetMetrics does not throw', () => {
    expect(() => svc.resetMetrics()).not.toThrow();
  });

  it('clearRateLimitData does not throw', () => {
    expect(() => svc.clearRateLimitData()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// init idempotency (BaseService guard)
// ---------------------------------------------------------------------------
describe('ContactService — init idempotency', () => {
  it('calling init twice does not throw', async () => {
    const svc = new ContactService({ backend: 'netlify' });
    await svc.init();
    await expect(svc.init()).resolves.toBeUndefined();
  });
});
