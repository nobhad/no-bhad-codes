-- =====================================================
-- Migration 053: Seed Default Contract Template
-- =====================================================

-- UP

INSERT INTO contract_templates (
  name,
  type,
  content,
  variables,
  is_default,
  created_at,
  updated_at
)
SELECT
  'Standard Service Agreement',
  'standard',
  'SERVICE AGREEMENT\n\nThis Service Agreement ("Agreement") is made on {{date.today}} between {{business.name}} ("Service Provider") and {{client.name}} ("Client").\n\n1. Project Overview\nProject: {{project.name}}\nType: {{project.type}}\nDescription: {{project.description}}\n\n2. Timeline\nStart Date: {{project.start_date}}\nTarget Completion: {{project.due_date}}\n\n3. Payment Terms\nTotal Project Cost: {{project.price}}\nDeposit Amount: {{project.deposit_amount}}\n\n4. Scope and Deliverables\nThe Service Provider will deliver the scope outlined in the project documentation and agreed milestones.\n\n5. Changes and Revisions\nChanges to scope may affect timelines and cost and will be approved in writing.\n\n6. Ownership and Rights\nFinal deliverables are transferred to Client upon full payment.\n\n7. Termination\nEither party may terminate with written notice. Work completed to date remains billable.\n\n8. Contact\nService Provider: {{business.name}}\nEmail: {{business.email}}\nWebsite: {{business.website}}\n\nClient: {{client.name}}\nEmail: {{client.email}}\nCompany: {{client.company}}\n',
  '["client.name","client.email","client.company","project.name","project.type","project.description","project.start_date","project.due_date","project.price","project.deposit_amount","business.name","business.owner","business.contact","business.email","business.website","date.today"]',
  TRUE,
  datetime('now'),
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM contract_templates WHERE name = 'Standard Service Agreement'
);

-- DOWN

DELETE FROM contract_templates WHERE name = 'Standard Service Agreement';
