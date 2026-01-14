-- Seed clients and projects data
-- This migration populates existing client and project data

-- Clients
INSERT OR IGNORE INTO clients (id, email, password_hash, company_name, contact_name, phone, status, created_at, updated_at) VALUES
(1,'arrow@nobhadcodes.com','$2b$10$kBkMQcnyN7I7feRZo2qhM.a6L1EzRVH69zVULRWAra7BxmPjzQS.G','Arrow Test Account','Arrow','555-0000','active','2025-12-02 00:27:06','2025-12-02 00:27:06'),
(2,'nmbhaduri@gmail.com','$2b$10$D02P0NGiw8wOkwehCcHIHOB0Uww8YkQfDrvSWgdmvkUgT6BI/khqm',NULL,'no','8572019325','pending','2025-12-03 06:00:02','2025-12-03 06:00:02'),
(3,'nobhaduri@gmail.com','$2b$10$UgjdwfOpRxhg.kg0dmUhrOpxhUo5Csfu5vF3NTiCTuRI7h2T4jp8O','No Bhad Codes','Noelle Bhaduri',NULL,'active','2025-12-03 20:59:51','2025-12-03 20:59:51'),
(4,'demo@example.com','$2b$10$FvuxdlIFbL3npxY7bWSqHuH1EMdvg5M6q.25GgadP/yXCKvjaSvXS','Demo Company','Demo User','555-0000','active','2025-12-22 08:56:05','2025-12-22 08:56:05'),
(5,'test@example.com','$2b$10$4aMhP59.v/aH5cVOVM9s/u62JxvSdFZFfQEjjULyz9pDnawl/mVu.',NULL,'Test User','555-123-4567','pending','2026-01-09 19:51:59','2026-01-09 19:51:59');

-- Projects
INSERT OR IGNORE INTO projects (id, client_id, project_name, description, status, priority, progress, start_date, estimated_end_date, budget_range, project_type, created_at, updated_at) VALUES
(1,1,'Arrow Test Project','A test project for Arrow','in-progress','medium',35,'2025-11-15','2026-02-15',NULL,NULL,'2025-12-02 00:27:06','2025-12-02 00:27:06'),
(2,2,'Personal Project - Simple Website','linktree with age verification','pending','medium',0,NULL,NULL,'under-1k','simple-site','2025-12-03 06:00:02','2025-12-03 06:00:02'),
(3,4,'Demo Project','A demo project for testing the client portal','in-progress','medium',50,'2025-12-22','2026-03-22',NULL,NULL,'2025-12-22 08:56:05','2025-12-22 08:56:05'),
(4,5,'Personal Project - Simple Website','A test project submission without a company field','pending','medium',0,NULL,NULL,'1000-2500','simple-site','2026-01-09 19:51:59','2026-01-09 19:51:59'),
(5,2,'Personal Project - Simple Website','not get flagged by IG for porn','pending','medium',0,NULL,NULL,'under-1k','simple-site','2026-01-09 22:13:31','2026-01-09 22:13:31'),
(6,2,'Personal Project - Simple Website','linktree','pending','medium',40,NULL,NULL,'under-1k','simple-site','2026-01-10 07:42:45','2026-01-10 07:42:45');
