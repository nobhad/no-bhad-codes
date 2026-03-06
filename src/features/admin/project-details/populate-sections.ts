/**
 * Functions to populate specific sections of the project detail view
 * @file src/features/admin/project-details/populate-sections.ts
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { getEmailWithCopyHtml } from '../../../utils/copy-email';
import { formatDate, formatDateTime } from '../../../utils/format-utils';
import { domCache } from './dom-cache';
import type { ProjectResponse } from '../../../types/api';

/**
 * Populate URL section links
 */
export function populateUrlSection(project: ProjectResponse): void {
  const previewUrlLink = domCache.get('previewUrlLink') as HTMLAnchorElement | null;
  const repoUrlLink = domCache.get('repoUrlLink') as HTMLAnchorElement | null;
  const productionUrlLink = domCache.get('productionUrlLink') as HTMLAnchorElement | null;

  if (previewUrlLink) {
    const previewText = previewUrlLink.querySelector('.url-link-text');
    if (project.preview_url) {
      previewUrlLink.href = project.preview_url;
      if (previewText) previewText.textContent = project.preview_url;
    } else {
      previewUrlLink.href = '#';
      if (previewText) previewText.textContent = '-';
    }
  }

  if (repoUrlLink) {
    const repoText = repoUrlLink.querySelector('.url-link-text');
    if (project.repository_url) {
      repoUrlLink.href = project.repository_url;
      if (repoText) repoText.textContent = project.repository_url;
    } else {
      repoUrlLink.href = '#';
      if (repoText) repoText.textContent = '-';
    }
  }

  if (productionUrlLink) {
    const prodText = productionUrlLink.querySelector('.url-link-text');
    if (project.production_url) {
      productionUrlLink.href = project.production_url;
      if (prodText) prodText.textContent = project.production_url;
    } else {
      productionUrlLink.href = '#';
      if (prodText) prodText.textContent = '-';
    }
  }
}

/**
 * Populate contract section
 */
export function populateContractSection(project: ProjectResponse): void {
  const contractStatusBadge = domCache.get('contractStatusBadge');
  const contractSignedInfo = domCache.get('contractSignedInfo');
  const contractDate = domCache.get('contractDate');
  const contractSignBtn = domCache.get('contractSignBtn');
  const contractCountersignedInfo = domCache.get('contractCountersignedInfo');
  const contractCountersignedDate = domCache.get('contractCountersignedDate');
  const contractCountersignBtn = domCache.get('contractCountersignBtn');
  const contractSignatureCard = domCache.get('contractSignatureCard');
  const contractSigner = domCache.get('contractSigner');
  const contractSignedDatetime = domCache.get('contractSignedDatetime');
  const contractCountersignRow = domCache.get('contractCountersignRow');
  const contractCountersignDateRow = domCache.get('contractCountersignDateRow');
  const contractCountersigner = domCache.get('contractCountersigner');
  const contractCountersignedDatetime = domCache.get('contractCountersignedDatetime');

  const hasClientSignature = Boolean(project.contract_signed_at);
  const hasCountersign = Boolean(project.contract_countersigned_at);

  if (hasClientSignature) {
    if (contractStatusBadge) {
      contractStatusBadge.textContent = hasCountersign ? 'Countersigned' : 'Client Signed';
      contractStatusBadge.className = 'status-badge status-completed';
    }
    if (contractSignedInfo) contractSignedInfo.style.display = '';
    if (contractDate) contractDate.textContent = formatDate(project.contract_signed_at);
    if (contractSignatureCard) contractSignatureCard.style.display = '';
    if (contractSigner) contractSigner.textContent = project.contract_signer_name || 'Client';
    if (contractSignedDatetime) {contractSignedDatetime.textContent = formatDateTime(project.contract_signed_at);}
    if (contractSignBtn) {
      contractSignBtn.textContent = 'View Contract';
      contractSignBtn.classList.remove('btn-primary');
      contractSignBtn.classList.add('btn-outline');
    }
    if (contractCountersignBtn) {
      contractCountersignBtn.style.display = hasCountersign ? 'none' : 'flex';
    }
    if (contractCountersignedInfo) {contractCountersignedInfo.style.display = hasCountersign ? '' : 'none';}
    if (contractCountersignedDate) {
      contractCountersignedDate.textContent =
        hasCountersign && project.contract_countersigned_at
          ? formatDate(project.contract_countersigned_at)
          : '-';
    }
    if (contractCountersignRow) {contractCountersignRow.style.display = hasCountersign ? '' : 'none';}
    if (contractCountersignDateRow) {contractCountersignDateRow.style.display = hasCountersign ? '' : 'none';}
    if (contractCountersigner) {contractCountersigner.textContent = project.contract_countersigner_name || 'Admin';}
    if (contractCountersignedDatetime) {
      contractCountersignedDatetime.textContent =
        hasCountersign && project.contract_countersigned_at
          ? formatDateTime(project.contract_countersigned_at)
          : '-';
    }
  } else {
    if (contractStatusBadge) {
      contractStatusBadge.textContent = 'Not Signed';
      contractStatusBadge.className = 'status-badge status-pending';
    }
    if (contractSignedInfo) contractSignedInfo.style.display = 'none';
    if (contractCountersignedInfo) contractCountersignedInfo.style.display = 'none';
    if (contractSignatureCard) contractSignatureCard.style.display = 'none';
    if (contractCountersignBtn) contractCountersignBtn.style.display = 'none';
    if (contractSignBtn) {
      contractSignBtn.textContent = 'Request Signature';
      contractSignBtn.classList.add('btn-primary');
      contractSignBtn.classList.remove('btn-outline');
    }
  }
}

/**
 * Populate features section
 */
export function populateFeatures(
  project: ProjectResponse,
  parseFeaturesFn: (featuresStr: string) => string[]
): void {
  const notes = domCache.get('notes');
  if (!notes) return;

  // Clear existing features
  const existingFeatures = notes.querySelector('.features-container');
  if (existingFeatures) existingFeatures.remove();

  // Parse and display features
  const features = project.features;
  if (!features) return;

  // Handle both string and string[] formats
  const featuresArray = Array.isArray(features) ? features : parseFeaturesFn(features);
  const excludedValues = ['basic-only', 'standard', 'premium', 'enterprise'];
  const featuresList = featuresArray
    .filter((f: string) => f && !excludedValues.includes(f.toLowerCase()))
    .map(
      (f: string) =>
        `<span class="feature-tag">${SanitizationUtils.escapeHtml(f.replace(/-/g, ' '))}</span>`
    )
    .join('');

  if (featuresList) {
    const featuresContainer = document.createElement('div');
    featuresContainer.className = 'meta-item features-container';
    featuresContainer.style.flexBasis = '100%';
    featuresContainer.innerHTML = `
      <span class="field-label">Features Requested</span>
      <div class="features-list">${featuresList}</div>
    `;
    notes.appendChild(featuresContainer);
  }
}

/**
 * Populate settings form
 */
export function populateSettingsForm(
  project: ProjectResponse,
  updateCustomDropdownFn: (status: string) => void,
  setupCustomStatusDropdownFn: () => void
): void {
  const settingName = domCache.getAs<HTMLInputElement>('settingName');
  const settingStatus = domCache.getAs<HTMLInputElement>('settingStatus');
  const settingProgress = domCache.getAs<HTMLInputElement>('settingProgress');

  if (settingName) settingName.value = project.project_name || '';
  if (settingStatus) {
    const projectStatus = project.status || 'pending';
    settingStatus.value = projectStatus;
    updateCustomDropdownFn(projectStatus);
    setupCustomStatusDropdownFn();
  }
  if (settingProgress) settingProgress.value = (project.progress || 0).toString();

  // Client account info
  const clientAccountEmail = domCache.get('clientAccountEmail');
  const clientAccountStatus = domCache.get('clientAccountStatus');
  const clientLastLogin = domCache.get('clientLastLogin');

  if (clientAccountEmail) {
    clientAccountEmail.innerHTML = getEmailWithCopyHtml(
      project.email || '',
      SanitizationUtils.escapeHtml(project.email || '')
    );
  }
  if (clientAccountStatus) {
    const hasAccount = project.client_id || project.password_hash;
    const hasLoggedIn = project.last_login_at;
    if (hasAccount && hasLoggedIn) {
      clientAccountStatus.textContent = 'Active';
    } else if (hasAccount) {
      clientAccountStatus.textContent = 'Pending';
    } else {
      clientAccountStatus.textContent = 'Not Invited';
    }
  }
  if (clientLastLogin) {
    clientLastLogin.textContent = project.last_login_at
      ? formatDateTime(project.last_login_at)
      : 'Never';
  }
}
