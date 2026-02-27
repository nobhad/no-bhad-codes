#!/bin/bash
# Script to count console.log/error/warn statements in admin files

echo "Files needing logger replacement:"
echo "=================================="

for file in \
  src/features/admin/modules/admin-projects.ts \
  src/features/admin/modules/admin-proposals.ts \
  src/features/admin/modules/admin-analytics.ts \
  src/features/admin/modules/admin-contacts.ts \
  src/features/admin/modules/admin-client-details.ts \
  src/features/admin/modules/admin-overview.ts \
  src/features/admin/modules/admin-global-tasks.ts \
  src/features/admin/modules/admin-tasks.ts \
  src/features/admin/modules/admin-contracts.ts \
  src/features/admin/modules/admin-deleted-items.ts \
  src/features/admin/modules/admin-document-requests.ts \
  src/features/admin/modules/admin-email-templates.ts \
  src/features/admin/modules/admin-files.ts \
  src/features/admin/modules/admin-messaging.ts \
  src/features/admin/modules/admin-system-status.ts \
  src/features/admin/modules/admin-time-tracking.ts \
  src/features/admin/modules/admin-ad-hoc-requests.ts \
  src/features/admin/modules/admin-ad-hoc-analytics.ts \
  src/features/admin/modules/admin-design-review.ts \
  src/features/admin/modules/admin-deliverables.ts \
  src/features/admin/modules/admin-performance.ts \
  src/features/admin/project-details/invoices.ts \
  src/features/admin/project-details/invoice-actions.ts \
  src/features/admin/project-details/invoice-modals.ts \
  src/features/admin/project-details/invoice-scheduling.ts \
  src/features/admin/project-details/files.ts \
  src/features/admin/project-details/messages.ts \
  src/features/admin/project-details/milestones.ts \
  src/features/admin/project-details/actions.ts \
  src/features/admin/project-details/documents.ts \
  src/features/admin/admin-project-details.ts \
  src/features/admin/admin-command-palette.ts \
  src/features/admin/admin-dashboard.ts \
  src/features/admin/handlers/universal-handlers.ts
do
  if [ -f "$file" ]; then
    count=$(grep -c "console\.\(log\|error\|warn\)(" "$file" 2>/dev/null || echo "0")
    if [ "$count" -gt "0" ]; then
      echo "$file: $count statements"
    fi
  fi
done
