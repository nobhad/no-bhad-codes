import * as React from 'react';
import { useState, useCallback } from 'react';
import { Eye, EyeOff, ExternalLink, Globe, BarChart3 } from 'lucide-react';
import { InlineEdit } from '@react/components/portal/InlineEdit';
import type { Project } from '../../../types';

interface ServiceCredentialsCardProps {
  project: Project;
  onSaveField: (field: keyof Project, value: string) => Promise<boolean>;
}

/** Single credential group (URL + email + password) */
function CredentialGroup({
  label,
  icon,
  url,
  email,
  password,
  urlField,
  emailField,
  passwordField,
  onSave
}: {
  label: string;
  icon: React.ReactNode;
  url: string;
  email: string;
  password: string;
  urlField: keyof Project;
  emailField: keyof Project;
  passwordField: keyof Project;
  onSave: (field: keyof Project, value: string) => Promise<boolean>;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPassword((prev) => !prev);
  }, []);

  return (
    <div className="credential-group">
      <div className="credential-group-header">
        {icon}
        <span className="field-label">{label}</span>
      </div>

      <div className="credential-fields">
        <div className="layout-form-field">
          <span className="field-label">Email</span>
          <InlineEdit
            value={email}
            type="text"
            placeholder="Set login email"
            onSave={(value) => onSave(emailField, value)}
          />
        </div>

        <div className="layout-form-field">
          <span className="field-label">Password</span>
          <div className="project-info-field-value">
            <InlineEdit
              value={password}
              type="text"
              placeholder="Set password"
              formatDisplay={(val) => (showPassword ? val : '\u2022'.repeat(val.length || 0)) || 'Set password'}
              onSave={(value) => onSave(passwordField, value)}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={togglePassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="icon-sm" /> : <Eye className="icon-sm" />}
            </button>
          </div>
        </div>

        <div className="layout-form-field">
          <span className="field-label">Dashboard URL</span>
          <div className="project-info-field-value">
            <InlineEdit
              value={url}
              type="text"
              placeholder="Set dashboard URL"
              onSave={(value) => onSave(urlField, value)}
            />
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-link-external" aria-label={`Open ${label} dashboard`}>
                <ExternalLink className="icon-sm" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ServiceCredentialsCard
 * Displays and allows inline editing of Netlify and Umami credentials.
 */
export function ServiceCredentialsCard({ project, onSaveField }: ServiceCredentialsCardProps) {
  return (
    <div className="panel">
      <div className="data-table-header">
        <h3><span className="title-full">Service Logins</span></h3>
      </div>

      <div className="grid-2col">
        <CredentialGroup
          label="Netlify"
          icon={<Globe className="icon-sm" />}
          url={project.netlify_url || ''}
          email={project.netlify_email || ''}
          password={project.netlify_password || ''}
          urlField="netlify_url"
          emailField="netlify_email"
          passwordField="netlify_password"
          onSave={onSaveField}
        />

        <CredentialGroup
          label="Umami"
          icon={<BarChart3 className="icon-sm" />}
          url={project.umami_url || ''}
          email={project.umami_email || ''}
          password={project.umami_password || ''}
          urlField="umami_url"
          emailField="umami_email"
          passwordField="umami_password"
          onSave={onSaveField}
        />
      </div>
    </div>
  );
}
