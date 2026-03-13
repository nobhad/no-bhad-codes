-- Comprehensive questionnaire templates for all project types
-- Fixes project_type mismatch (old seeds used 'website'/'branding' which don't match constants)
-- Structure: 3 shared (all types) + 6 project-specific

-- Remove the old mismatched questionnaires (project_type 'website'/'branding' never matched constants)
DELETE FROM questionnaire_responses WHERE questionnaire_id IN (
  SELECT id FROM questionnaires WHERE name IN ('website_discovery', 'branding_discovery', 'project_kickoff')
);
DELETE FROM questionnaires WHERE name IN ('website_discovery', 'branding_discovery', 'project_kickoff');

-- ============================================================
-- SHARED QUESTIONNAIRE 1: Brand & Design Discovery (ALL types)
-- ============================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES (
  'brand_design_discovery',
  'Help us understand your visual identity and design preferences so we can build something that looks and feels like you.',
  NULL,
  '[
    {"id":"bd1","type":"textarea","question":"Describe your brand in 2-3 sentences. What do you do, and what makes you different?","required":true,"placeholder":"e.g. We are a boutique landscaping company focused on native plants and ecological design..."},
    {"id":"bd2","type":"multiselect","question":"What words best describe the look and feel you want?","options":["Clean/Minimal","Earthy/Organic","Bold/Vibrant","Elegant/Luxurious","Playful/Fun","Professional/Corporate","Rustic/Handmade","Modern/Techy","Warm/Inviting","Dark/Moody"],"required":true},
    {"id":"bd3","type":"multiselect","question":"What emotions should your site evoke in visitors?","options":["Trust","Excitement","Calm","Curiosity","Urgency","Nostalgia","Sophistication","Friendliness","Authority","Inspiration"],"required":true},
    {"id":"bd4","type":"textarea","question":"Do you have existing brand colors? If yes, list them (hex codes or descriptions). If no, describe colors you are drawn to.","required":true,"placeholder":"e.g. Deep forest green (#2d3f2d), warm cream, earthy brown tones"},
    {"id":"bd5","type":"textarea","question":"Do you have existing brand fonts? If yes, list them. If not, describe the type styles you like.","required":false,"placeholder":"e.g. Cormorant Garamond for headings, Lato for body text"},
    {"id":"bd6","type":"select","question":"Do you have a logo?","options":["Yes, and I love it","Yes, but it needs updating","No, I need one","No, and I do not need one right now"],"required":true},
    {"id":"bd7","type":"textarea","question":"List 2-3 websites you love the look of and explain what you like about each. They do not need to be in your industry.","required":true,"placeholder":"e.g. botanicalandcare.com - I love the whimsical feel and the eggshell background color..."},
    {"id":"bd8","type":"textarea","question":"Are there any design styles, colors, or trends you specifically want to AVOID?","required":false,"placeholder":"e.g. I do not want anything that looks like a generic template or uses bright neon colors"},
    {"id":"bd9","type":"select","question":"How important are animations and interactive elements to you?","options":["Very important - I want the site to feel alive","Somewhat - subtle touches are nice","Not important - keep it simple and fast","I am not sure, open to suggestions"],"required":true},
    {"id":"bd10","type":"textarea","question":"Is there anything else about your visual identity or design preferences we should know?","required":false}
  ]',
  1, 1, 1, 'system'
);

-- ============================================================
-- SHARED QUESTIONNAIRE 2: Content & Assets Planning (ALL types)
-- ============================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES (
  'content_assets_planning',
  'Help us understand what content and assets you have ready, and what you still need to prepare. You will provide all written copy and photography for the site.',
  NULL,
  '[
    {"id":"ca1","type":"select","question":"Do you have written copy (text content) ready for your site?","options":["Yes, all ready to go","Partially - some pages are done","Not yet, but I will write it","I need to hire a copywriter"],"required":true},
    {"id":"ca2","type":"textarea","question":"List all the pages you want on your site and a brief description of what goes on each.","required":true,"placeholder":"e.g.\nHome - hero image, mission statement, services overview\nAbout - team bios, company story\nServices - descriptions of each offering\nContact - form, location, hours"},
    {"id":"ca3","type":"select","question":"Do you have professional photos ready to use?","options":["Yes, high-resolution photos ready","Some photos, but need more","No, I will arrange photography","I plan to use stock photos for now"],"required":true},
    {"id":"ca4","type":"select","question":"Do you have video content to include?","options":["Yes, edited and ready","Yes, but needs editing","No, but I plan to create some","No, not needed"],"required":false},
    {"id":"ca5","type":"select","question":"Do you have client testimonials or reviews?","options":["Yes, written testimonials ready","Yes, but need to collect them","Some on Google/Yelp I can share","No testimonials yet"],"required":true},
    {"id":"ca6","type":"select","question":"Do you need a blog on your site?","options":["Yes, and I have posts ready","Yes, but no content yet","Maybe in the future","No"],"required":true},
    {"id":"ca7","type":"multiselect","question":"What social media accounts do you have?","options":["Instagram","Facebook","LinkedIn","TikTok","YouTube","Pinterest","X/Twitter","None"],"required":true},
    {"id":"ca8","type":"select","question":"Do you want your social media feed embedded on the site?","options":["Yes, Instagram feed","Yes, multiple platforms","Just links to profiles","No social integration needed"],"required":false},
    {"id":"ca9","type":"textarea","question":"Are there any organizations, certifications, or affiliations you want featured on the site?","required":false,"placeholder":"e.g. NOFA certified, member of Ecological Landscape Alliance"},
    {"id":"ca10","type":"textarea","question":"Do you have any existing content from a current site that should be carried over? If yes, what specifically?","required":false,"placeholder":"e.g. All gallery photos, blog posts from 2024, team bios"}
  ]',
  1, 1, 2, 'system'
);

-- ============================================================
-- SHARED QUESTIONNAIRE 3: Technical & Access (ALL types)
-- ============================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES (
  'technical_access',
  'Help us set up the technical foundation for your site. This covers domain, hosting, email, and integrations.',
  NULL,
  '[
    {"id":"ta1","type":"select","question":"Do you own a domain name?","options":["Yes","No, I need to register one","Not sure"],"required":true},
    {"id":"ta2","type":"text","question":"What is your domain name (or desired domain)?","required":true,"placeholder":"e.g. hedgewitchhorticulture.com"},
    {"id":"ta3","type":"select","question":"Where is your domain registered?","options":["GoDaddy","Namecheap","Google Domains","Squarespace","Wix","Cloudflare","I do not know","Other"],"required":true},
    {"id":"ta4","type":"select","question":"Do you have a business email (e.g. info@yourdomain.com)?","options":["Yes, through Google Workspace","Yes, through Microsoft 365","Yes, through my hosting provider","No, I use a personal email","Not sure"],"required":true},
    {"id":"ta5","type":"select","question":"Do you currently have a website?","options":["Yes, on Squarespace","Yes, on WordPress","Yes, on Wix","Yes, on Shopify","Yes, other platform","No current website"],"required":true},
    {"id":"ta6","type":"select","question":"Do you have Google Analytics or any tracking set up?","options":["Yes, Google Analytics","Yes, other analytics","No, but I want it","No, not interested"],"required":false},
    {"id":"ta7","type":"multiselect","question":"Do you need any of these integrations?","options":["Google Maps","Contact Form","Newsletter Signup (Mailchimp etc.)","Booking/Scheduling (Calendly etc.)","Live Chat","Payment Processing","CRM Integration","None of these"],"required":false},
    {"id":"ta8","type":"select","question":"How comfortable are you making small updates to your site yourself?","options":["Very comfortable with technology","Somewhat comfortable","Not comfortable, prefer a user guide","I want you to handle all updates"],"required":true},
    {"id":"ta9","type":"textarea","question":"Can you provide login credentials for your current domain registrar and hosting? (We will send a secure link for this separately if needed)","required":false,"placeholder":"e.g. Squarespace - I can add you as a contributor, or I will share login details securely"},
    {"id":"ta10","type":"textarea","question":"Any other technical requirements or integrations you need?","required":false}
  ]',
  1, 1, 3, 'system'
);

-- ============================================================
-- PROJECT-SPECIFIC: Simple Site
-- ============================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES (
  'simple_site_details',
  'A few quick questions specific to your simple site project.',
  'simple-site',
  '[
    {"id":"ss1","type":"select","question":"How many pages do you need?","options":["1 (single-page/landing page)","2-3","4-5","6+"],"required":true},
    {"id":"ss2","type":"select","question":"What is the primary goal of this site?","options":["Inform visitors about my business","Generate leads/inquiries","Showcase my work","Provide contact information","Sell a single product/service","Personal/resume site"],"required":true},
    {"id":"ss3","type":"select","question":"Do you need a contact form?","options":["Yes, simple (name, email, message)","Yes, detailed (with service selection, budget, etc.)","No, just display my email/phone","Not sure"],"required":true},
    {"id":"ss4","type":"select","question":"Do you need the site to be updated frequently?","options":["Rarely - set it and forget it","Occasionally - a few times per year","Monthly","Weekly or more"],"required":true},
    {"id":"ss5","type":"textarea","question":"What is the single most important thing a visitor should do when they land on your site?","required":true,"placeholder":"e.g. Fill out the contact form, call my phone number, learn about my services"}
  ]',
  1, 1, 10, 'system'
);

-- ============================================================
-- PROJECT-SPECIFIC: Business Site
-- ============================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES (
  'business_site_details',
  'Detailed questions to help us build your professional business website.',
  'business-site',
  '[
    {"id":"bs1","type":"multiselect","question":"Which of these pages/sections do you need?","options":["Home","About/Our Story","Services/Offerings","Team/Staff","Gallery/Portfolio","Blog","Contact","FAQ","Testimonials","Resources","Careers","Privacy Policy"],"required":true},
    {"id":"bs2","type":"textarea","question":"List your services or product categories with a brief description of each.","required":true,"placeholder":"e.g.\n1. Landscape Design - Custom garden plans for residential clients\n2. Installation - Full garden build-outs\n3. Maintenance - Ongoing garden care"},
    {"id":"bs3","type":"select","question":"Do you have team members to feature?","options":["Yes, with bios and photos ready","Yes, but need to gather info","Solo operation - just me","No team page needed"],"required":true},
    {"id":"bs4","type":"select","question":"How do clients typically find and contact you?","options":["Phone calls","Email inquiries","Contact form on website","Social media DMs","In-person/word of mouth","A mix of several"],"required":true},
    {"id":"bs5","type":"multiselect","question":"What lead generation features do you want?","options":["Contact form","Request a quote form","Newsletter signup","Free consultation booking","Download a guide/PDF","Chat widget","Phone click-to-call","None specifically"],"required":false},
    {"id":"bs6","type":"select","question":"Do you serve a specific geographic area?","options":["Yes, local area only","Yes, regional","National","International","Online/remote only"],"required":true},
    {"id":"bs7","type":"textarea","question":"If you serve a specific area, describe it.","required":false,"placeholder":"e.g. Greater Boston and Eastern Massachusetts"},
    {"id":"bs8","type":"select","question":"Do you want a gallery or portfolio section?","options":["Yes, with project categories and filtering","Yes, simple image gallery","No gallery needed","Not sure"],"required":true},
    {"id":"bs9","type":"textarea","question":"What makes your business different from competitors? This helps us highlight your unique value.","required":true,"placeholder":"e.g. We focus exclusively on native plants and ecological design, unlike most landscapers who use conventional methods"},
    {"id":"bs10","type":"textarea","question":"Are there any specific features or functionality you have seen on competitor sites that you want?","required":false}
  ]',
  1, 1, 11, 'system'
);

-- ============================================================
-- PROJECT-SPECIFIC: Portfolio
-- ============================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES (
  'portfolio_details',
  'Questions specific to building your portfolio site.',
  'portfolio',
  '[
    {"id":"pf1","type":"select","question":"How many projects/pieces do you want to showcase?","options":["Under 10","10-25","25-50","50+"],"required":true},
    {"id":"pf2","type":"select","question":"Do you want project categories or filtering?","options":["Yes, filter by category/type","Yes, filter by multiple criteria (type, year, etc.)","No, just a simple grid","Not sure"],"required":true},
    {"id":"pf3","type":"textarea","question":"What categories would you use to organize your work?","required":false,"placeholder":"e.g. Residential, Commercial, Public Spaces, or by service type: Design, Installation, Maintenance"},
    {"id":"pf4","type":"select","question":"How much detail do you want per project?","options":["Single image with title","Multiple images with description","Full case study (process, challenges, results)","Mix - some detailed, some simple"],"required":true},
    {"id":"pf5","type":"select","question":"Do you want to include client testimonials with projects?","options":["Yes, per project","Yes, separate testimonials section","Both per-project and separate section","No testimonials"],"required":true},
    {"id":"pf6","type":"select","question":"What happens when someone clicks a project?","options":["Opens a lightbox/slideshow","Goes to a dedicated project page","Expands inline with more details","Just displays the image larger"],"required":true},
    {"id":"pf7","type":"select","question":"Do you want project location or client name displayed?","options":["Yes, location only","Yes, client name and location","Just project title","No identifying info"],"required":false},
    {"id":"pf8","type":"textarea","question":"Is there a specific portfolio site you have seen that you love the layout of? What did you like about it?","required":false}
  ]',
  1, 1, 12, 'system'
);

-- ============================================================
-- PROJECT-SPECIFIC: E-Commerce
-- ============================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES (
  'ecommerce_details',
  'Detailed questions for your e-commerce project. This helps us plan the shopping experience and backend setup.',
  'e-commerce',
  '[
    {"id":"ec1","type":"select","question":"How many products will you sell?","options":["Under 10","10-50","50-200","200-1000","1000+"],"required":true},
    {"id":"ec2","type":"select","question":"What type of products?","options":["Physical products (shipped)","Digital products (downloads)","Services/bookings","Subscriptions/memberships","Mix of several types"],"required":true},
    {"id":"ec3","type":"multiselect","question":"What payment methods do you need?","options":["Credit/debit cards (Stripe)","PayPal","Apple Pay/Google Pay","Buy now pay later (Afterpay, Klarna)","Bank transfer","Cash on delivery","Cryptocurrency"],"required":true},
    {"id":"ec4","type":"select","question":"Do you need shipping calculation?","options":["Yes, real-time carrier rates (USPS, UPS, etc.)","Yes, flat rate shipping","Free shipping","Local pickup only","Digital products - no shipping needed","I need to figure this out"],"required":true},
    {"id":"ec5","type":"select","question":"Do you need inventory management?","options":["Yes, track stock levels","Yes, with low-stock alerts","No, unlimited/made-to-order","Not sure"],"required":true},
    {"id":"ec6","type":"select","question":"Do you need product variations (sizes, colors, etc.)?","options":["Yes, multiple variations per product","Yes, simple options (like size only)","No, each product is one item","Not sure"],"required":true},
    {"id":"ec7","type":"select","question":"Do you need customer accounts?","options":["Yes, required to purchase","Yes, optional (guest checkout available)","No, guest checkout only","Not sure"],"required":true},
    {"id":"ec8","type":"multiselect","question":"What other e-commerce features do you need?","options":["Discount codes/coupons","Gift cards","Product reviews","Wishlist/favorites","Related products","Recently viewed","Email notifications (order confirmation, shipping)","Tax calculation","Returns/refund policy page"],"required":false},
    {"id":"ec9","type":"select","question":"Do you already have product photos?","options":["Yes, professional product photos","Yes, but they need improvement","No, I will arrange product photography","I will use manufacturer photos"],"required":true},
    {"id":"ec10","type":"textarea","question":"Are there any e-commerce sites you like the shopping experience of? What specifically did you like?","required":false},
    {"id":"ec11","type":"textarea","question":"Do you have any existing inventory data (spreadsheets, another platform) that needs to be migrated?","required":false}
  ]',
  1, 1, 13, 'system'
);

-- ============================================================
-- PROJECT-SPECIFIC: Web App
-- ============================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES (
  'web_app_details',
  'Detailed questions for your web application project. This helps us plan the architecture and user experience.',
  'web-app',
  '[
    {"id":"wa1","type":"textarea","question":"Describe the core problem your app solves. What does it do that nothing else does (or does better)?","required":true},
    {"id":"wa2","type":"select","question":"Who are the primary users?","options":["Internal team/employees","Customers/clients","Both internal and external","General public","Other"],"required":true},
    {"id":"wa3","type":"select","question":"Do users need to create accounts and log in?","options":["Yes, email/password","Yes, social login (Google, etc.)","Yes, both options","No login needed","Not sure"],"required":true},
    {"id":"wa4","type":"select","question":"Are there different user roles with different permissions?","options":["Yes, 2 roles (e.g. admin + user)","Yes, 3+ roles","No, all users are equal","Not sure yet"],"required":true},
    {"id":"wa5","type":"textarea","question":"If there are different roles, describe each role and what they can do.","required":false,"placeholder":"e.g. Admin - manages all content and users\nEditor - can create and edit posts\nViewer - can only view content"},
    {"id":"wa6","type":"multiselect","question":"What features does your app need?","options":["User dashboard","Data entry forms","File uploads","Notifications (email/push)","Search functionality","Reporting/analytics","Real-time updates","Chat/messaging","Calendar/scheduling","Maps/location","API integrations","Data import/export"],"required":true},
    {"id":"wa7","type":"select","question":"Do you need a mobile app or is a responsive web app sufficient?","options":["Responsive web app is fine","I want a mobile app too (future phase)","Mobile-first is critical","Not sure"],"required":true},
    {"id":"wa8","type":"textarea","question":"What third-party services or APIs does this need to integrate with?","required":false,"placeholder":"e.g. Stripe for payments, Google Maps for location, Twilio for SMS"},
    {"id":"wa9","type":"select","question":"How much data will the app handle?","options":["Small (under 1,000 records)","Medium (1,000-100,000 records)","Large (100,000+ records)","Not sure"],"required":false},
    {"id":"wa10","type":"textarea","question":"Are there any existing apps (competitors or inspiration) that do something similar? What do you like/dislike about them?","required":false},
    {"id":"wa11","type":"textarea","question":"Do you have any existing data, databases, or spreadsheets that need to be migrated into the new app?","required":false}
  ]',
  1, 1, 14, 'system'
);

-- ============================================================
-- PROJECT-SPECIFIC: Browser Extension
-- ============================================================
INSERT OR IGNORE INTO questionnaires (name, description, project_type, questions, is_active, auto_send_on_project_create, display_order, created_by) VALUES (
  'browser_extension_details',
  'Questions specific to your browser extension project.',
  'browser-extension',
  '[
    {"id":"be1","type":"textarea","question":"What does the extension do? Describe the core functionality in 2-3 sentences.","required":true},
    {"id":"be2","type":"multiselect","question":"Which browsers should it support?","options":["Chrome","Firefox","Safari","Edge","All major browsers"],"required":true},
    {"id":"be3","type":"select","question":"What type of extension is it?","options":["Popup (small window when you click the icon)","Sidebar panel","Modifies/enhances existing web pages","Background service (runs silently)","New tab page replacement","Combination of several"],"required":true},
    {"id":"be4","type":"select","question":"Does the extension need user accounts or login?","options":["Yes, users create accounts","Yes, syncs with an existing web service","No, works locally without accounts","Not sure"],"required":true},
    {"id":"be5","type":"select","question":"Does it need to store data?","options":["Yes, locally in the browser","Yes, synced to a server/cloud","Yes, both local and cloud","No data storage needed"],"required":true},
    {"id":"be6","type":"multiselect","question":"What browser permissions will it need?","options":["Access to current page content","Access to all websites","Storage","Notifications","Clipboard","Downloads","Bookmarks","History","Tabs management","Not sure"],"required":false},
    {"id":"be7","type":"select","question":"Does it need to interact with any external APIs or services?","options":["Yes, specific APIs (describe below)","Yes, my own backend/API","No external services","Not sure"],"required":true},
    {"id":"be8","type":"textarea","question":"If it connects to external APIs, which ones?","required":false,"placeholder":"e.g. OpenAI API for text processing, Google Translate API"},
    {"id":"be9","type":"select","question":"Will this be published on browser extension stores?","options":["Yes, Chrome Web Store","Yes, multiple stores","No, private/internal use only","Eventually, but not right away"],"required":true},
    {"id":"be10","type":"textarea","question":"Are there any existing extensions that do something similar? What do you like/dislike about them?","required":false}
  ]',
  1, 1, 15, 'system'
);

-- DOWN
DELETE FROM questionnaires WHERE name IN (
  'brand_design_discovery', 'content_assets_planning', 'technical_access',
  'simple_site_details', 'business_site_details', 'portfolio_details',
  'ecommerce_details', 'web_app_details', 'browser_extension_details'
);
-- Old questionnaires are not restored in rollback since they had mismatched project_type values
