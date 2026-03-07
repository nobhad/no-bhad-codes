import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  CreditCard,
  FileText,
  Save,
  RefreshCw,
  Globe,
  Mail,
  User,
  Phone,
  Type
} from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { unwrapApiData } from '../../../../utils/api-client';

interface BusinessInfo {
  name: string;
  owner: string;
  contact: string;
  tagline: string;
  email: string;
  website: string;
}

interface PaymentSettings {
  venmoHandle: string;
  zelleEmail: string;
  paypalEmail: string;
}

interface InvoiceSettings {
  defaultCurrency: string;
  defaultTerms: string;
  prefix: string;
  nextSequence: number;
}

interface BusinessConfigurationProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  overviewMode?: boolean;
}

type ActiveSection = 'business' | 'payment' | 'invoice';

const SECTIONS: { id: ActiveSection; label: string; icon: React.ReactNode }[] = [
  { id: 'business', label: 'Business Info', icon: <Building2 className="icon-sm" /> },
  { id: 'payment', label: 'Payment Methods', icon: <CreditCard className="icon-sm" /> },
  { id: 'invoice', label: 'Invoice Settings', icon: <FileText className="icon-sm" /> }
];

export function BusinessConfiguration({ getAuthToken, showNotification, overviewMode }: BusinessConfigurationProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('business');
  const [hasChanges, setHasChanges] = useState(false);

  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: '', owner: '', contact: '', tagline: '', email: '', website: ''
  });
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    venmoHandle: '', zelleEmail: '', paypalEmail: ''
  });
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
    defaultCurrency: 'USD', defaultTerms: '', prefix: 'INV-', nextSequence: 1
  });

  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [getAuthToken]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [bizRes, payRes, invRes] = await Promise.all([
        fetch(API_ENDPOINTS.ADMIN.SETTINGS_BUSINESS_INFO, { headers: getHeaders(), credentials: 'include' }),
        fetch(API_ENDPOINTS.ADMIN.SETTINGS_PAYMENT, { headers: getHeaders(), credentials: 'include' }),
        fetch(API_ENDPOINTS.ADMIN.SETTINGS_INVOICE, { headers: getHeaders(), credentials: 'include' })
      ]);

      if (!bizRes.ok || !payRes.ok || !invRes.ok) {
        throw new Error('Failed to load settings');
      }

      const bizData = unwrapApiData<BusinessInfo>(await bizRes.json());
      const payData = unwrapApiData<PaymentSettings>(await payRes.json());
      const invData = unwrapApiData<InvoiceSettings>(await invRes.json());

      setBusinessInfo(bizData);
      setPaymentSettings(payData);
      setInvoiceSettings(invData);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const headers = getHeaders();
      const opts: RequestInit = { method: 'PUT', headers, credentials: 'include' };

      const requests: Promise<Response>[] = [];

      if (activeSection === 'business' || overviewMode) {
        requests.push(fetch(API_ENDPOINTS.ADMIN.SETTINGS_BUSINESS_INFO, { ...opts, body: JSON.stringify(businessInfo) }));
      }
      if (activeSection === 'payment' || overviewMode) {
        requests.push(fetch(API_ENDPOINTS.ADMIN.SETTINGS_PAYMENT, { ...opts, body: JSON.stringify(paymentSettings) }));
      }
      if (activeSection === 'invoice' || overviewMode) {
        requests.push(fetch(API_ENDPOINTS.ADMIN.SETTINGS_INVOICE, {
          ...opts,
          body: JSON.stringify({
            defaultCurrency: invoiceSettings.defaultCurrency,
            defaultTerms: invoiceSettings.defaultTerms,
            prefix: invoiceSettings.prefix
          })
        }));
      }

      const results = await Promise.all(requests);
      const failed = results.find(r => !r.ok);
      if (failed) throw new Error('Failed to save settings');

      showNotification?.('Settings saved successfully', 'success');
      setHasChanges(false);
    } catch (err) {
      showNotification?.(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [activeSection, businessInfo, paymentSettings, invoiceSettings, getHeaders, showNotification, overviewMode]);

  const updateBusinessField = (field: keyof BusinessInfo, value: string) => {
    setBusinessInfo(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updatePaymentField = (field: keyof PaymentSettings, value: string) => {
    setPaymentSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updateInvoiceField = (field: keyof InvoiceSettings, value: string) => {
    setInvoiceSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const renderBusinessForm = () => (
    <div className="config-form-section">
      <div className="config-form-grid">
        <FormField label="Business Name" icon={<Building2 className="icon-sm" />} value={businessInfo.name} onChange={(v) => updateBusinessField('name', v)} />
        <FormField label="Owner" icon={<User className="icon-sm" />} value={businessInfo.owner} onChange={(v) => updateBusinessField('owner', v)} />
        <FormField label="Contact Name" icon={<Phone className="icon-sm" />} value={businessInfo.contact} onChange={(v) => updateBusinessField('contact', v)} />
        <FormField label="Tagline" icon={<Type className="icon-sm" />} value={businessInfo.tagline} onChange={(v) => updateBusinessField('tagline', v)} />
        <FormField label="Email" icon={<Mail className="icon-sm" />} value={businessInfo.email} onChange={(v) => updateBusinessField('email', v)} type="email" />
        <FormField label="Website" icon={<Globe className="icon-sm" />} value={businessInfo.website} onChange={(v) => updateBusinessField('website', v)} type="url" />
      </div>
    </div>
  );

  const renderPaymentForm = () => (
    <div className="config-form-section">
      <div className="config-form-grid">
        <FormField label="Venmo Handle" icon={<CreditCard className="icon-sm" />} value={paymentSettings.venmoHandle} onChange={(v) => updatePaymentField('venmoHandle', v)} placeholder="@handle" />
        <FormField label="Zelle Email" icon={<Mail className="icon-sm" />} value={paymentSettings.zelleEmail} onChange={(v) => updatePaymentField('zelleEmail', v)} type="email" />
        <FormField label="PayPal Email" icon={<Mail className="icon-sm" />} value={paymentSettings.paypalEmail} onChange={(v) => updatePaymentField('paypalEmail', v)} type="email" />
      </div>
    </div>
  );

  const renderInvoiceForm = () => (
    <div className="config-form-section">
      <div className="config-form-grid">
        <FormField label="Default Currency" icon={<CreditCard className="icon-sm" />} value={invoiceSettings.defaultCurrency} onChange={(v) => updateInvoiceField('defaultCurrency', v)} />
        <FormField label="Invoice Prefix" icon={<FileText className="icon-sm" />} value={invoiceSettings.prefix} onChange={(v) => updateInvoiceField('prefix', v)} placeholder="INV-" />
        <div className="config-form-field config-form-field--wide">
          <label className="config-form-label">
            <FileText className="icon-sm" />
            <span>Default Payment Terms</span>
          </label>
          <textarea
            className="form-input config-textarea"
            value={invoiceSettings.defaultTerms}
            onChange={(e) => updateInvoiceField('defaultTerms', e.target.value)}
            rows={3}
          />
        </div>
        <div className="config-form-field">
          <label className="config-form-label">
            <FileText className="icon-sm" />
            <span>Next Invoice Number</span>
          </label>
          <div className="config-readonly-value">
            {invoiceSettings.prefix}{String(invoiceSettings.nextSequence).padStart(4, '0')}
          </div>
        </div>
      </div>
    </div>
  );

  // In overview mode, show a compact summary
  if (overviewMode) {
    return (
      <TableLayout
        containerRef={containerRef as React.Ref<HTMLDivElement>}
        title="CONFIGURATION"
        stats={
          <TableStats items={[
            { value: businessInfo.name || 'Not Set', label: 'business' },
            { value: '3', label: 'sections' }
          ]} />
        }
        actions={
          <>
            {hasChanges && (
              <IconButton icon="save" onClick={handleSave} title="Save All" loading={isSaving} />
            )}
            <IconButton action="refresh" onClick={loadSettings} title="Refresh" loading={isLoading} />
          </>
        }
      >
        {isLoading ? (
          <LoadingState message="Loading configuration..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadSettings} />
        ) : (
          <div className="config-overview">
            <div className="config-overview-section">
              <h4 className="config-section-title">
                <Building2 className="icon-sm" />
                <span>Business Info</span>
              </h4>
              <div className="config-overview-grid">
                <OverviewItem label="Name" value={businessInfo.name} />
                <OverviewItem label="Owner" value={businessInfo.owner} />
                <OverviewItem label="Email" value={businessInfo.email} />
                <OverviewItem label="Website" value={businessInfo.website} />
              </div>
            </div>
            <div className="config-overview-section">
              <h4 className="config-section-title">
                <CreditCard className="icon-sm" />
                <span>Payment Methods</span>
              </h4>
              <div className="config-overview-grid">
                <OverviewItem label="Venmo" value={paymentSettings.venmoHandle} />
                <OverviewItem label="Zelle" value={paymentSettings.zelleEmail} />
                <OverviewItem label="PayPal" value={paymentSettings.paypalEmail || 'Not set'} />
              </div>
            </div>
          </div>
        )}
      </TableLayout>
    );
  }

  return (
    <TableLayout
      containerRef={containerRef as React.Ref<HTMLDivElement>}
      title="CONFIGURATION"
      stats={
        <TableStats items={[
          { value: SECTIONS.find(s => s.id === activeSection)?.label || '', label: 'section' }
        ]} />
      }
      actions={
        <>
          {hasChanges && (
            <IconButton
              icon="save"
              onClick={handleSave}
              title="Save Changes"
              loading={isSaving}
              disabled={isSaving}
            />
          )}
          <IconButton action="refresh" onClick={loadSettings} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading configuration..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSettings} />
      ) : (
        <div className="config-content">
          {/* Section tabs */}
          <div className="config-section-tabs">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                className={`config-section-tab ${activeSection === section.id ? 'is-active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.icon}
                <span>{section.label}</span>
              </button>
            ))}
          </div>

          {/* Active form */}
          {activeSection === 'business' && renderBusinessForm()}
          {activeSection === 'payment' && renderPaymentForm()}
          {activeSection === 'invoice' && renderInvoiceForm()}

          {/* Save bar */}
          {hasChanges && (
            <div className="config-save-bar">
              <span className="config-save-hint">You have unsaved changes</span>
              <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <RefreshCw className="icon-sm config-spinner" /> : <Save className="icon-sm" />}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </TableLayout>
  );
}

/** Reusable form field */
function FormField({ label, icon, value, onChange, type = 'text', placeholder }: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="config-form-field">
      <label className="config-form-label">
        {icon}
        <span>{label}</span>
      </label>
      <input
        className="form-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Compact overview item */
function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="config-overview-item">
      <span className="config-overview-label">{label}</span>
      <span className="config-overview-value">{value || 'Not set'}</span>
    </div>
  );
}
