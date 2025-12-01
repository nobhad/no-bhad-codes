import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Complete Site',
  parameters: {
    layout: 'fullscreen'
  },
  argTypes: {
    page: {
      control: 'select',
      options: ['home', 'projects', 'admin', 'client-portal', 'client-intake'],
      description: 'Which page to show'
    }
  },
  args: {
    page: 'home'
  }
};

export default meta;
type Story = StoryObj;

const createPage = (args: any) => {
  const { page } = args;

  // HOME PAGE - Main landing page
  if (page === 'home') {
    return `
      <!DOCTYPE html>
      <html lang="en" data-theme="light">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>No Bhad Codes - Professional Web Development</title>
      </head>
      <body>
        <!-- HEADER -->
        <header class="header">
          <div class="container is--full">
            <nav class="nav-row">
              <a href="/" aria-label="home" class="nav-logo-row">
                no bhad codes
              </a>
              <div class="nav-row__right">
                <button id="toggle-theme" class="theme-button" aria-label="Toggle dark/light theme">
                  <div class="icon-wrap">
                    <svg class="theme-icon sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"></circle>
                      <path d="M12 2V4M12 20V22M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"></path>
                    </svg>
                    <svg class="theme-icon moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                     <path d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z"></path>
                    </svg>
                  </div>
                </button>
                <button role="button" data-menu-toggle="" class="menu-button">
                  <div class="menu-button-text">
                    <p class="p-large">Menu</p>
                    <p class="p-large">Close</p>
                  </div>
                  <div class="icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 16 16" fill="none" class="menu-button-icon">
                      <path d="M7.33333 16L7.33333 -3.2055e-07L8.66667 -3.78832e-07L8.66667 16L7.33333 16Z" fill="currentColor"></path>
                      <path d="M16 8.66667L-2.62269e-07 8.66667L-3.78832e-07 7.33333L16 7.33333L16 8.66667Z" fill="currentColor"></path>
                      <path d="M6 7.33333L7.33333 7.33333L7.33333 6C7.33333 6.73637 6.73638 7.33333 6 7.33333Z" fill="currentColor"></path>
                      <path d="M10 7.33333L8.66667 7.33333L8.66667 6C8.66667 6.73638 9.26362 7.33333 10 7.33333Z" fill="currentColor"></path>
                      <path d="M6 8.66667L7.33333 8.66667L7.33333 10C7.33333 9.26362 6.73638 8.66667 6 8.66667Z" fill="currentColor"></path>
                      <path d="M10 8.66667L8.66667 8.66667L8.66667 10C8.66667 9.26362 9.26362 8.66667 10 8.66667Z" fill="currentColor"></path>
                    </svg>
                  </div>
                </button>
              </div>
            </nav>
          </div>
        </header>

        <!-- NAVIGATION -->
        <nav data-nav="closed" class="nav">
          <div data-menu-toggle="" class="overlay"></div>
          <div class="menu">
            <div class="menu-bg">
              <div class="bg-panel first"></div>
              <div class="bg-panel second"></div>
              <div class="bg-panel"></div>
            </div>
            <div class="menu-inner">
              <ul class="menu-list">
                <li class="menu-list-item">
                  <a href="/" class="menu-link">
                    <p class="menu-link-heading" data-text="home">home</p>
                    <p class="eyebrow">00</p>
                    <div class="menu-link-bg"></div>
                  </a>
                </li>
                <li class="menu-list-item">
                  <a href="#about" class="menu-link">
                    <p class="menu-link-heading" data-text="about">about</p>
                    <p class="eyebrow">01</p>
                    <div class="menu-link-bg"></div>
                  </a>
                </li>
                <li class="menu-list-item">
                  <a href="#contact" class="menu-link">
                    <p class="menu-link-heading" data-text="contact">contact</p>
                    <p class="eyebrow">02</p>
                    <div class="menu-link-bg"></div>
                  </a>
                </li>
                <li class="menu-list-item">
                  <a href="/projects" class="menu-link disabled">
                    <p class="menu-link-heading" data-text="portfolio">portfolio</p>
                    <p class="eyebrow">03</p>
                    <div class="coming-soon-banner">Coming Soon</div>
                    <div class="menu-link-bg"></div>
                  </a>
                </li>
                <li class="menu-list-item">
                  <a href="/client/portal" class="menu-link">
                    <p class="menu-link-heading" data-text="client portal">client portal</p>
                    <p class="eyebrow">04</p>
                    <div class="menu-link-bg"></div>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </nav>

        <!-- MAIN CONTENT -->
        <main>
          <!-- BUSINESS CARD INTRO -->
          <section id="intro" class="business-card-section">
            <div class="business-card-container">
              <div id="business-card" class="business-card">
                <div id="business-card-inner" class="business-card-inner">
                  <div class="business-card-front">
                    <img src="/images/business-card_front.svg" alt="Business Card Front" class="card-svg" width="525" height="299.7">
                  </div>
                  <div class="business-card-back">
                    <img src="/images/business-card_back.svg" alt="Avatar" class="card-svg" width="525" height="299.7">
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ABOUT SECTION -->
          <section id="about" class="about-section">
            <h2>about</h2>
            <div class="about-content">
              <p>Hi, I'm Noelle Bhaduri – I build web solutions from simple link trees to complex custom software. My work includes animated landing pages, browser extensions, e-commerce platforms, content management systems, and responsive portfolios for creators and businesses.</p>
              
              <p>I combine technical expertise with creative design, developing type-safe applications with modern frameworks, architecting scalable backends, and crafting engaging user experiences. From concept to deployment, I deliver solutions tailored to your specific needs.</p>
              
              <p>Currently based in the Boston, MA area and actively seeking web development opportunities.</p>
              
              <div class="tech-stack">
                <h3>tech stack</h3>
                <p class="tech-list">JavaScript • TypeScript • React • Next.js • Vue.js • HTML5 • CSS3 • Node.js • Express.js • Git • npm/yarn • MongoDB • Mongoose • MySQL • Supabase • Tailwind CSS • Bootstrap • Webpack • Vite • JSON • AJAX • jQuery • PHP • GSAP • Vuetify • Bootstrap Vue • Jotai • Zod • EJS • XML • Chrome Extensions API • Adobe Illustrator • Photoshop • Claude Code CLI</p>
              </div>
              
              <p class="closing-statement">From link trees to browser extensions to custom web applications – I work on it all!</p>
            </div>
          </section>

          <!-- CONTACT SECTION -->
          <section id="contact" class="contact-section">
            <h2>contact</h2>
            
            <form class="contact-form" method="post" name="contact-form" data-netlify="true" netlify-honeypot="bot-field">
              <p class="form-intro">Whether you need a new project, have questions, or just want to say hello - I'd love to hear from you!</p>
              
              <input name="bot-field" style="display: none;" />
              
              <div class="form-row">
                <input autocomplete="off" class="form-input half" data-name="First Name" id="First-Name" maxlength="256" name="First-Name" placeholder="First Name" required="" type="text">
                <input autocomplete="off" class="form-input half" data-name="Last Name" id="Last-Name" maxlength="256" name="Last-Name" placeholder="Last Name" required="" type="text">
              </div>
              
              <input autocomplete="on" class="form-input" data-name="Email" id="Email" maxlength="256" name="Email" placeholder="Email Address" required="" type="email">
              
              <select class="form-select" data-name="Inquiry Type" id="inquiry-type" name="Inquiry-Type" required="">
                <option value="">What can I help you with?</option>
                <option value="New Project">New Project - I need something built</option>
                <option value="Existing Project">Existing Project - Updates/fixes needed</option>
                <option value="Consultation">Consultation - I have questions</option>
                <option value="Collaboration">Collaboration - Let's work together</option>
                <option value="General">General Inquiry</option>
                <option value="Other">Other</option>
              </select>
              
              <div class="project-details" id="project-details" style="display: none;">
                <select class="form-select" data-name="Project Type" id="project-type" name="Project-Type">
                  <option value="">What type of project?</option>
                  <option value="Simple Site">Simple Site (1-2 pages, landing page)</option>
                  <option value="Small Business Website">Small Business Website</option>
                  <option value="Portfolio Website">Portfolio Website</option>
                  <option value="E-commerce Store">E-commerce Store</option>
                  <option value="Web Application">Web Application</option>
                  <option value="Browser Extension">Browser Extension</option>
                  <option value="Other">Other - Let's discuss</option>
                </select>
                
                <div class="form-row">
                  <select class="form-select" data-name="Timeline" id="timeline" name="Timeline">
                    <option value="">Timeline?</option>
                    <option value="ASAP">ASAP</option>
                    <option value="1-2 months">1-2 months</option>
                    <option value="2-4 months">2-4 months</option>
                    <option value="4+ months">4+ months</option>
                    <option value="Flexible">Flexible</option>
                  </select>
                  
                  <select class="form-select" data-name="Budget Range" id="budget-range" name="Budget-Range">
                    <option value="">Budget range?</option>
                    <option value="Under $2K">Under $2K</option>
                    <option value="$2K-5K">$2K-5K</option>
                    <option value="$5K-10K">$5K-10K</option>
                    <option value="$10K-25K">$10K-25K</option>
                    <option value="$25K+">$25K+</option>
                    <option value="Let's discuss">Let's discuss</option>
                  </select>
                </div>
              </div>
              
              <textarea autocomplete="off" class="form-textarea" data-name="Project Description" id="project-description" maxlength="1000" name="Project-Description" placeholder="Brief description of your project (What's the main goal? Who's your target audience?)" required=""></textarea>
              
              <details class="company-details">
                <summary>+ Company Information (Optional)</summary>
                <div class="company-fields">
                  <input autocomplete="on" class="form-input" data-name="Company Name" id="Company-Name" maxlength="256" name="Company-Name" placeholder="Company/Organization Name" type="text">
                  
                  <select class="form-select" data-name="Business Size" id="business-size" name="Business-Size">
                    <option value="">Business Size (Optional)</option>
                    <option value="Solo">Just me - not a business</option>
                    <option value="Small">Small Business (2-10 employees)</option>
                    <option value="Medium">Medium Business (11-50 employees)</option>
                    <option value="Large">Large Business (50+ employees)</option>
                    <option value="Startup">Startup</option>
                    <option value="Non-Profit">Non-Profit</option>
                  </select>
                </div>
              </details>
              
              <div class="form-actions">
                <input class="form-button" data-wait="Sending..." type="submit" value="Let's Talk">
                <p class="form-note">Most inquiries will need to fill out the <a href="/intake-form" class="link">Intake Form</a></p>
              </div>
            </form>
          </section>
        </main>

        <!-- FOOTER -->
        <footer class="footer">
          <div class="container is--full">
            <p class="footer-text">© <span id="current-year">2025</span> NO BHAD CODES. All rights reserved.</p>
          </div>
        </footer>
      </body>
      </html>
    `;
  }

  // PROJECTS PAGE - Portfolio showcase
  if (page === 'projects') {
    return `
      <!DOCTYPE html>
      <html lang="en" data-theme="light">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Projects - No Bhad Codes</title>
      </head>
      <body>
        <!-- HEADER -->
        <header class="header">
          <div class="container is--full">
            <nav class="nav-row">
              <a href="/" aria-label="home" class="nav-logo-row">
                no bhad codes
              </a>
              <div class="nav-row__right">
                <button id="toggle-theme" class="theme-button" aria-label="Toggle dark/light theme">🌓</button>
                <button role="button" data-menu-toggle="" class="menu-button">
                  <span>Menu</span>
                </button>
              </div>
            </nav>
          </div>
        </header>

        <!-- MAIN CONTENT -->
        <main>
          <!-- Hero Section -->
          <section class="projects-hero">
            <div class="container">
              <div class="hero-content">
                <h1 class="hero-title">
                  <span class="title-line">Featured</span>
                  <span class="title-line accent">Projects</span>
                </h1>
                <p class="hero-description">
                  From simple link trees to complex web applications, explore my portfolio of digital solutions.
                </p>
              </div>
            </div>
          </section>

          <!-- Filter Section -->
          <section class="projects-filter">
            <div class="container">
              <div class="filter-wrapper">
                <div class="filter-group" role="group" aria-label="Project filters">
                  <button class="filter-btn active" data-filter="all">
                    All Projects
                    <span class="filter-count" data-count="all">0</span>
                  </button>
                  <button class="filter-btn" data-filter="websites">
                    Websites
                    <span class="filter-count" data-count="websites">0</span>
                  </button>
                  <button class="filter-btn" data-filter="applications">
                    Applications
                    <span class="filter-count" data-count="applications">0</span>
                  </button>
                  <button class="filter-btn" data-filter="ecommerce">
                    E-Commerce
                    <span class="filter-count" data-count="ecommerce">0</span>
                  </button>
                  <button class="filter-btn" data-filter="extensions">
                    Extensions
                    <span class="filter-count" data-count="extensions">0</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Projects Grid -->
          <section class="projects-grid-section">
            <div class="container">
              <div class="projects-grid" id="projects-grid">
                <!-- Sample project cards -->
                <article class="project-card" data-category="websites">
                  <a href="#" class="project-card-link">
                    <div class="project-card-image">
                      <img src="/images/placeholder-project.jpg" alt="Sample Project" loading="lazy">
                      <div class="project-card-overlay">
                        <span class="view-project">View Project →</span>
                      </div>
                    </div>
                    <div class="project-card-content">
                      <div class="project-card-header">
                        <h3 class="project-card-title">Sample Website</h3>
                        <span class="project-card-category">Website</span>
                      </div>
                      <p class="project-card-description">A modern responsive website with interactive features</p>
                      <div class="project-card-tech">
                        <span class="tech-tag">React</span>
                        <span class="tech-tag">TypeScript</span>
                        <span class="tech-tag">CSS3</span>
                      </div>
                      <div class="project-card-footer">
                        <span class="project-card-date">2024</span>
                        <span class="project-card-status">Live</span>
                      </div>
                    </div>
                  </a>
                </article>
              </div>
              
              <div class="projects-loading" id="projects-loading" style="display: none;">
                <div class="spinner"></div>
                <p>Loading projects...</p>
              </div>
              
              <div class="no-results" id="no-results" style="display: none;">
                <p>No projects found matching your criteria.</p>
              </div>
            </div>
          </section>
        </main>

        <!-- FOOTER -->
        <footer class="footer">
          <div class="container is--full">
            <p class="footer-text">© <span id="current-year">2025</span> NO BHAD CODES. All rights reserved.</p>
          </div>
        </footer>
      </body>
      </html>
    `;
  }

  // ADMIN DASHBOARD
  if (page === 'admin') {
    return `
      <!DOCTYPE html>
      <html lang="en" data-theme="light">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard - No Bhad Codes</title>
      </head>
      <body class="admin-page">
        <div class="admin-container">
          <header class="admin-header">
            <h1>Admin Dashboard</h1>
            <div class="admin-nav">
              <button class="admin-btn" id="clients-btn">Clients</button>
              <button class="admin-btn" id="projects-btn">Projects</button>
              <button class="admin-btn" id="messages-btn">Messages</button>
              <button class="admin-btn" id="analytics-btn">Analytics</button>
            </div>
          </header>
          
          <main class="admin-main">
            <div class="admin-grid">
              <div class="admin-card">
                <h3>Client Management</h3>
                <p>Manage client accounts and permissions</p>
                <button class="btn btn-primary">View Clients</button>
              </div>
              <div class="admin-card">
                <h3>Project Overview</h3>
                <p>Track all active projects and timelines</p>
                <button class="btn btn-primary">View Projects</button>
              </div>
              <div class="admin-card">
                <h3>Message Center</h3>
                <p>Review and respond to client messages</p>
                <button class="btn btn-primary">View Messages</button>
              </div>
              <div class="admin-card">
                <h3>Analytics</h3>
                <p>Performance metrics and insights</p>
                <button class="btn btn-primary">View Analytics</button>
              </div>
            </div>
          </main>
        </div>
      </body>
      </html>
    `;
  }

  // CLIENT PORTAL DASHBOARD
  if (page === 'client-portal') {
    return `
      <!DOCTYPE html>
      <html lang="en" data-theme="light">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Client Portal Dashboard - No Bhad Codes</title>
      </head>
      <body class="client-portal-page">
        <header class="dashboard-header">
          <div class="header-content">
            <div class="header-left">
              <h1 class="logo">NO BHAD CODES</h1>
            </div>
            <div class="header-right">
              <button class="header-btn" id="notifications-btn">🔔</button>
              <button class="header-btn" id="theme-toggle">🌓</button>
              <div class="user-menu">
                <button class="user-avatar" id="user-menu-toggle">👤</button>
              </div>
            </div>
          </div>
        </header>

        <div class="dashboard-container">
          <aside class="sidebar" id="sidebar">
            <button class="sidebar-toggle" id="sidebar-toggle">☰</button>
            <div class="sidebar-content">
              <h3>Navigation</h3>
              <div class="nav-section">
                <h4>Account</h4>
                <button class="nav-btn" id="nav-profile">👤 Profile</button>
                <button class="nav-btn" id="nav-billing">💳 Billing</button>
                <button class="nav-btn" id="nav-settings">⚙️ Settings</button>
              </div>
              <div class="nav-section">
                <h4>Projects</h4>
                <button class="nav-btn" id="nav-dashboard">📊 Dashboard</button>
                <button class="nav-btn" id="nav-projects">📁 My Projects</button>
                <button class="nav-btn" id="nav-messages">💬 Messages</button>
              </div>
              <div class="nav-section">
                <button class="nav-btn logout-btn" id="nav-logout">🚪 Logout</button>
              </div>
            </div>
          </aside>
          
          <main class="main-content" id="main-content">
            <div class="content-area">
              <div class="page-header">
                <h1>Dashboard</h1>
                <p>Welcome to your client dashboard</p>
              </div>
              
              <div class="action-buttons">
                <button class="btn btn-primary" id="btn-new-project">+ New Project</button>
                <button class="btn btn-secondary" id="btn-messages">View Messages</button>
                <button class="btn btn-secondary" id="btn-invoices">View Invoices</button>
              </div>
              
              <div class="content-cards">
                <div class="card">
                  <h3>Recent Activity</h3>
                  <p>Your latest project updates will appear here</p>
                  <button class="btn btn-outline">View All</button>
                </div>
                <div class="card">
                  <h3>Quick Actions</h3>
                  <p>Common tasks and shortcuts</p>
                  <button class="btn btn-outline">Get Started</button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </body>
      </html>
    `;
  }

  // CLIENT INTAKE FORM
  if (page === 'client-intake') {
    return `
      <!DOCTYPE html>
      <html lang="en" data-theme="light">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Intake Form - No Bhad Codes</title>
      </head>
      <body class="client-intake-page">
        <header class="intake-header">
          <div class="container">
            <h1>NO BHAD CODES</h1>
            <p>Project Intake Form</p>
          </div>
        </header>

        <main class="intake-main">
          <div class="container">
            <div class="intake-form-container">
              <h2>Tell us about your project</h2>
              <form class="intake-form" id="intake-form">
                <div class="form-section">
                  <h3>Project Overview</h3>
                  
                  <div class="form-group">
                    <label for="project-type">What type of project is this?</label>
                    <select id="project-type" name="project-type" required>
                      <option value="">Select project type...</option>
                      <option value="simple-site">Simple Landing Page (1-2 pages)</option>
                      <option value="business-site">Small Business Website</option>
                      <option value="portfolio">Portfolio/Personal Site</option>
                      <option value="ecommerce">E-commerce Store</option>
                      <option value="web-app">Web Application</option>
                      <option value="browser-extension">Browser Extension</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="project-description">Project Description</label>
                    <textarea id="project-description" name="project-description" rows="4" placeholder="Briefly describe your project goals and what you want to achieve..." required></textarea>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label for="budget">Budget Range</label>
                      <select id="budget" name="budget" required>
                        <option value="">Select budget range...</option>
                        <option value="under-2k">Under $2,000</option>
                        <option value="2k-5k">$2,000 - $5,000</option>
                        <option value="5k-10k">$5,000 - $10,000</option>
                        <option value="10k-25k">$10,000 - $25,000</option>
                        <option value="25k-plus">$25,000+</option>
                        <option value="discuss">Let's discuss</option>
                      </select>
                    </div>
                    
                    <div class="form-group">
                      <label for="timeline">Timeline</label>
                      <select id="timeline" name="timeline" required>
                        <option value="">Select timeline...</option>
                        <option value="asap">ASAP</option>
                        <option value="1-month">Within 1 month</option>
                        <option value="1-3-months">1-3 months</option>
                        <option value="3-6-months">3-6 months</option>
                        <option value="6-plus-months">6+ months</option>
                        <option value="flexible">Flexible</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="form-section">
                  <h3>Contact Information</h3>
                  
                  <div class="form-row">
                    <div class="form-group">
                      <label for="full-name">Full Name</label>
                      <input type="text" id="full-name" name="full-name" required>
                    </div>
                    
                    <div class="form-group">
                      <label for="email">Email Address</label>
                      <input type="email" id="email" name="email" required>
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label for="phone">Phone (optional)</label>
                      <input type="tel" id="phone" name="phone">
                    </div>
                    
                    <div class="form-group">
                      <label for="company">Company/Organization</label>
                      <input type="text" id="company" name="company">
                    </div>
                  </div>
                </div>

                <div class="form-actions">
                  <button type="submit" class="btn btn-primary">Submit Project Request</button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </body>
      </html>
    `;
  }

  return '';
};

// Main story with dropdown to switch between pages
export const CompleteSite: Story = {
  render: createPage
};

// Individual page stories
export const HomePage: Story = {
  args: {
    page: 'home'
  },
  render: createPage
};

export const ProjectsPage: Story = {
  args: {
    page: 'projects'
  },
  render: createPage
};

export const AdminDashboard: Story = {
  args: {
    page: 'admin'
  },
  render: createPage
};

export const ClientPortal: Story = {
  args: {
    page: 'client-portal'
  },
  render: createPage
};

export const ClientIntakeForm: Story = {
  args: {
    page: 'client-intake'
  },
  render: createPage
};
