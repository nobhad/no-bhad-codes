-- =====================================================
-- Migration 060: Proposal Contract Terms
-- =====================================================
-- Adds contract terms to proposals so they can function
-- as legally binding contracts when signed.
-- =====================================================

-- Add contract terms field to proposal_requests
ALTER TABLE proposal_requests ADD COLUMN contract_terms TEXT;

-- Add is_legally_binding flag (true when signed)
ALTER TABLE proposal_requests ADD COLUMN is_legally_binding BOOLEAN DEFAULT FALSE;

-- Add terms_accepted_at timestamp (when client agreed to terms)
ALTER TABLE proposal_requests ADD COLUMN terms_accepted_at DATETIME;

-- Add terms_version to track which version of terms was accepted
ALTER TABLE proposal_requests ADD COLUMN terms_version TEXT;

-- Create default contract terms template
CREATE TABLE IF NOT EXISTS proposal_contract_terms_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  terms_content TEXT NOT NULL,
  project_type TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  version TEXT DEFAULT '1.0',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default contract terms template
INSERT INTO proposal_contract_terms_templates (name, description, terms_content, is_default, version)
VALUES (
  'Standard Service Agreement',
  'Default terms and conditions for web development projects',
  '## Terms and Conditions

### 1. Scope of Work
The scope of work is defined by the selected tier and features outlined in this proposal. Any additional work outside this scope will require a separate agreement or change order.

### 2. Payment Terms
- A deposit of 50% is required before work begins
- Remaining balance is due upon project completion
- Payment is due within 14 days of invoice date
- Late payments may incur a 1.5% monthly fee

### 3. Timeline
Project timelines are estimates and may vary based on:
- Client feedback turnaround time
- Scope changes or additions
- Third-party integrations

### 4. Client Responsibilities
The client agrees to:
- Provide all necessary content, images, and assets in a timely manner
- Respond to requests for feedback within 5 business days
- Designate a single point of contact for project decisions

### 5. Revisions
- Each project phase includes 2 rounds of revisions
- Additional revisions will be billed at the hourly rate
- Major scope changes require a change order

### 6. Intellectual Property
- Upon final payment, all custom work becomes client property
- Third-party assets (stock photos, fonts, plugins) are subject to their respective licenses
- Developer retains the right to showcase work in portfolio

### 7. Warranty
- 30-day warranty on custom development work
- Bug fixes within warranty period are provided at no charge
- Warranty does not cover issues caused by third-party modifications

### 8. Limitation of Liability
Developer liability is limited to the total amount paid for services. Developer is not liable for:
- Lost profits or business opportunities
- Data loss or security breaches on client-managed systems
- Third-party service failures

### 9. Termination
Either party may terminate with 14 days written notice. Upon termination:
- Client pays for work completed to date
- Developer delivers all work completed
- Unused deposit may be refunded at developer discretion

### 10. Acceptance
By signing this proposal, you agree to these terms and conditions.',
  TRUE,
  '1.0'
);

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_proposal_contract_terms_templates_default
ON proposal_contract_terms_templates(is_default, is_active);
