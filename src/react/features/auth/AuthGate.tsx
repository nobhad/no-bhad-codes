import * as React from 'react';
import { authStore } from '../../../auth/auth-store';
import { ROUTES } from '../../../constants/api-endpoints';

type AuthGatePortalType = 'admin' | 'client';

type AuthGateProps = {
  portalType: AuthGatePortalType;
  businessName?: string;
  authTitle: string;
  authDescription: string;
};

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M10.733 5.08A10.744 10.744 0 0 1 12 5c7 0 11 7 11 7a18.49 18.49 0 0 1-2.582 3.902" />
      <path d="M6.61 6.61A18.49 18.49 0 0 0 1 12s4 7 11 7a10.744 10.744 0 0 0 5.08-1.267" />
      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

export function AuthGate(props: AuthGateProps) {
  const { portalType, businessName, authTitle, authDescription } = props;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [authError, setAuthError] = React.useState('');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  const [useMagicLink, setUseMagicLink] = React.useState(false);
  const [magicSuccess, setMagicSuccess] = React.useState(false);

  const passwordInputId = portalType === 'admin' ? 'admin-password' : 'portal-password';

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');

    if (!password.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await authStore.adminLogin({ password });
      if (result.success) {
        window.location.href = ROUTES.PORTAL.DASHBOARD;
      } else {
        setAuthError(result.error || 'Invalid password');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClientPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setMagicSuccess(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    setIsSubmitting(true);
    try {
      const result = await authStore.login({ email: trimmedEmail, password });
      if (result.success) {
        window.location.href = ROUTES.PORTAL.DASHBOARD;
      } else {
        setAuthError(result.error || 'Invalid email or password');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClientMagicSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setMagicSuccess(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setIsSubmitting(true);
    try {
      const result = await authStore.requestMagicLink(trimmedEmail);
      if (result.success) {
        setMagicSuccess(true);
      } else {
        setAuthError(result.error || 'Failed to send link. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-gate-container">
      <div className="auth-gate-header">
        <img src="/images/avatar.svg" alt={businessName ?? ''} className="auth-gate-logo" />
        <h1>{authTitle}</h1>
        <p>{authDescription}</p>
      </div>

      {portalType === 'admin' ? (
        <form
          className="auth-gate-form"
          id="admin-login-form"
          autoComplete="off"
          noValidate
          onSubmit={handleAdminSubmit}
        >
          <input
            type="email"
            id="admin-username"
            name="username"
            value=""
            autoComplete="username"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            readOnly
          />

          <div className="form-field">
            <label htmlFor="admin-password" className="sr-only">
              Admin Password
            </label>

            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="admin-password"
                name="password"
                placeholder="Admin Password"
                required
                autoComplete="current-password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                id="password-toggle"
                aria-label="Toggle password visibility"
                onClick={() => setShowPassword((s) => !s)}
              >
                {showPassword ? (
                  <EyeOffIcon className="eye-icon" width="20" height="20" aria-hidden="true" />
                ) : (
                  <EyeIcon className="eye-icon" width="20" height="20" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="auth-error" id="auth-error">
            {authError}
          </div>

          <button
            type="submit"
            className="btn btn-auth auth-submit"
            disabled={isSubmitting || !password.trim()}
          >
            <span className="btn-text" style={{ display: isSubmitting ? 'none' : 'inline' }}>
              Sign In
            </span>
            <span className="btn-loading" style={{ display: isSubmitting ? 'inline' : 'none' }}>
              Signing in...
            </span>
          </button>
        </form>
      ) : (
        <>
          {!useMagicLink ? (
            <form
              className="auth-gate-form"
              id="portal-login-form"
              noValidate
              onSubmit={handleClientPasswordSubmit}
            >
              <div className="form-field">
                <label htmlFor="portal-email" className="sr-only">
                  Email Address
                </label>
                <input
                  type="email"
                  id="portal-email"
                  name="email"
                  className="form-input"
                  placeholder="Email Address"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <span id="email-error" className="error-message" />
              </div>

              <div className="form-field">
                <label htmlFor="portal-password" className="sr-only">
                  Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="portal-password"
                    name="password"
                    className="form-input"
                    placeholder="Password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    id="portal-password-toggle"
                    data-password-toggle={passwordInputId}
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="eye-icon" width="20" height="20" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="eye-icon" width="20" height="20" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <span id="password-error" className="error-message" />
              </div>

              <div className="auth-error" id="auth-error">
                {authError}
              </div>

              <button
                type="submit"
                id="login-btn"
                className="btn btn-auth auth-submit"
                disabled={isSubmitting}
              >
                <span className="btn-text" style={{ display: isSubmitting ? 'none' : 'inline' }}>
                  Sign In
                </span>
                <span className="btn-loading" style={{ display: isSubmitting ? 'inline' : 'none' }}>
                  Signing in...
                </span>
              </button>
            </form>
          ) : (
            <form
              className="auth-gate-form"
              id="magic-link-form"
              noValidate
              onSubmit={handleClientMagicSubmit}
            >
              <div className="form-field">
                <label htmlFor="magic-link-email" className="sr-only">
                  Email Address
                </label>
                <input
                  type="email"
                  id="magic-link-email"
                  name="email"
                  className="form-input"
                  placeholder="Email Address"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <span id="magic-email-error" className="error-message" />
              </div>

              <div className="auth-error" id="magic-link-error">
                {authError}
              </div>

              <div
                className="magic-link-success"
                id="magic-link-success"
                style={{ display: magicSuccess ? 'block' : 'none' }}
              >
                <p>A secure login link has been sent to your email.</p>
                <p className="magic-link-info">Check your inbox and click the link to sign in.</p>
              </div>

              <button
                type="submit"
                id="magic-link-btn"
                className="btn btn-auth auth-submit"
                disabled={isSubmitting}
              >
                <span className="btn-text" style={{ display: isSubmitting ? 'none' : 'inline' }}>
                  Send Magic Link
                </span>
                <span className="btn-loading" style={{ display: isSubmitting ? 'inline' : 'none' }}>
                  Sending...
                </span>
              </button>
            </form>
          )}

          <div className="auth-gate-footer">
            <a href="/forgot-password" id="forgot-password-link" className="auth-link">
              Forgot password?
            </a>
            <span className="auth-divider">|</span>
            {!useMagicLink ? (
              <a
                href="#"
                id="magic-link-toggle"
                className="auth-link"
                onClick={(e) => {
                  e.preventDefault();
                  setUseMagicLink(true);
                  setAuthError('');
                  setMagicSuccess(false);
                }}
              >
                Use magic link instead
              </a>
            ) : (
              <a
                href="#"
                id="portal-page-back-to-login"
                className="auth-link"
                onClick={(e) => {
                  e.preventDefault();
                  setUseMagicLink(false);
                  setAuthError('');
                  setMagicSuccess(false);
                }}
              >
                Back to password login
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
