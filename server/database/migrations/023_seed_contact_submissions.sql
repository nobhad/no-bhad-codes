-- Seed contact submissions data
-- This migration runs only once to populate existing contact form data

INSERT OR IGNORE INTO contact_submissions (id, name, email, subject, message, status, ip_address, user_agent, message_id, created_at, updated_at, read_at, replied_at) VALUES
(1,'Test User','test@example.com','general','This is a test message for the contact form.','new','::1','curl/8.7.1','msg_1764867187247_krfeurido','2025-12-04 16:53:07','2025-12-04 16:53:07',NULL,NULL),
(2,'Noelle Bhad','nmbhaduri@gmail.com','Other','checking that this works!','new','::1','Mozilla/5.0','msg_1764867364220_vd4lr52c2','2025-12-04 16:56:04','2025-12-04 16:56:04',NULL,NULL),
(3,'No Bhad','nmbhaduri@gmail.com','Other','testing test','read','::1','Mozilla/5.0','msg_1764867862186_s759n3cxe','2025-12-04 17:04:22','2026-01-14 04:01:09','2026-01-14 04:01:09',NULL),
(4,'Noelle Bhad','nmbhaduri@gmail.com','Other','Testing testing!','read','::1','Mozilla/5.0','msg_1764869042454_j3pkf6gpv','2025-12-04 17:24:02','2026-01-14 03:59:20','2026-01-14 03:59:20',NULL),
(5,'No Bhaduri','nmbhaduri@gmail.com','Other','Testing email connection','read','::1','Mozilla/5.0','msg_1764877515761_j92wcq3l5','2025-12-04 19:45:15','2026-01-14 03:53:24','2026-01-14 03:53:24',NULL),
(6,'Noelle Bhaduri','nmbhaduri@gmail.com','Other','Testing this bugger','new','::1','Mozilla/5.0','msg_1764877837631_row0u420k','2025-12-04 19:50:37','2025-12-04 19:50:37',NULL,NULL),
(7,'Noelle Bhaduri','nmbhaduri@gmail.com','Other','Testing this bugger out','new','::1','Mozilla/5.0','msg_1764879079279_gjl0l5zyw','2025-12-04 20:11:19','2025-12-04 20:11:19',NULL,NULL),
(8,'Arrow Bhaduri','arrownbones@gmail.com','Other','Snarfing on through here','new','::1','Mozilla/5.0','msg_1765346779227_lrv09zkmm','2025-12-10 06:06:19','2025-12-10 06:06:19',NULL,NULL),
(9,'Arrow Bhad','arrownbones@gmail.com','Other','Helllooooooo','new','::1','Mozilla/5.0','msg_1765347042418_feoag8gzz','2025-12-10 06:10:42','2025-12-10 06:10:42',NULL,NULL),
(10,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','Testing this out','new','::1','Mozilla/5.0','msg_1765481680350_eicw9mspz','2025-12-11 19:34:40','2025-12-11 19:34:40',NULL,NULL),
(11,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','Test message 2','new','::1','Mozilla/5.0','msg_1765481791348_zcopkbt56','2025-12-11 19:36:31','2025-12-11 19:36:31',NULL,NULL),
(12,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','Boop boop bedoop','new','::1','Mozilla/5.0','msg_1765496298887_b7x66fdr1','2025-12-11 23:38:18','2025-12-11 23:38:18',NULL,NULL),
(13,'Arrow','nmbhaduri@gmail.com','Contact Form Submission','Testing contact form','new','::1','Mozilla/5.0','msg_1766172861713_7jcujq8km','2025-12-19 19:34:21','2025-12-19 19:34:21',NULL,NULL),
(14,'ME','nmbhaduri@gmail.com','Contact Form Submission','Hello testing this bad boy out','read','::1','Mozilla/5.0','msg_1766173877862_dtmi0qih7','2025-12-19 19:51:17','2026-01-13 20:48:51','2026-01-13 20:48:51',NULL),
(15,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','Testing this out','read','::1','Mozilla/5.0','msg_1766174318030_1h6g65jut','2025-12-19 19:58:38','2026-01-13 20:48:50','2026-01-13 20:48:50',NULL),
(16,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','Testing this out','read','::1','Mozilla/5.0','msg_1766175175465_m1nno5kkv','2025-12-19 20:12:55','2026-01-13 20:48:48','2026-01-13 20:48:48',NULL),
(17,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','Testing again','archived','::1','Mozilla/5.0','msg_1766175562685_g2tdtbn1y','2025-12-19 20:19:22','2026-01-13 20:49:00','2026-01-13 20:48:47',NULL),
(18,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','Testing testing','archived','::1','Mozilla/5.0','msg_1766175620727_e8aeiiglb','2025-12-19 20:20:20','2026-01-13 20:48:59',NULL,NULL),
(19,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','Message form test','archived','::1','Mozilla/5.0','msg_1766175883758_f5xnckqwv','2025-12-19 20:24:43','2026-01-13 20:48:58',NULL,NULL),
(20,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','testing again','archived','::1','Mozilla/5.0','msg_1766175987190_cw963e5vr','2025-12-19 20:26:27','2026-01-13 20:48:56','2026-01-13 20:48:37',NULL),
(21,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','testing one more time','archived','::1','Mozilla/5.0','msg_1766180475430_tqdeqjta2','2025-12-19 21:41:15','2026-01-13 20:48:54','2026-01-13 20:48:35',NULL),
(22,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','pasta dinner supper','read','::1','Mozilla/5.0','msg_1766276913488_fa67lchdo','2025-12-21 00:28:33','2026-01-13 20:48:33','2026-01-13 20:48:33','2026-01-13 20:48:32'),
(23,'Noelle','nmbhaduri@gmail.com','Contact Form Submission','Testing this out','new','::1','Mozilla/5.0','msg_1766435843605_vbd9eu41c','2025-12-22 20:37:23','2026-01-14 04:16:32','2026-01-13 20:48:30',NULL);
