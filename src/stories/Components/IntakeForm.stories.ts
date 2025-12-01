import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Intake Form',
  parameters: {
    layout: 'padded'
  },
  argTypes: {
    showHeader: {
      control: 'boolean',
      description: 'Show form header'
    },
    formStyle: {
      control: 'select',
      options: ['full', 'basic', 'minimal'],
      description: 'Form complexity'
    }
  },
  args: {
    showHeader: true,
    formStyle: 'full'
  }
};

export default meta;
type Story = StoryObj;

const createIntakeForm = (args: any) => {
  const { showHeader, formStyle } = args;

  return `
    <div style="max-width: 800px; margin: 0 auto;">
      ${
  showHeader
    ? `
        <header class="intake-header">
          <div class="container">
            <h1>NO BHAD CODES</h1>
            <p>Project Intake Form</p>
          </div>
        </header>
      `
    : ''
}

      <div class="intake-form-container">
        <h2>Tell us about your project</h2>
        <form class="intake-form" id="intake-form" oninput="validateIntakeForm(this)">
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

            ${
  formStyle !== 'minimal'
    ? `
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
            `
    : ''
}
          </div>

          ${
  formStyle === 'full'
    ? `
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
          `
    : ''
}

          <div class="form-actions">
            <button 
              type="submit" 
              class="btn btn-primary" 
              id="intake-submit-button"
              onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'intake-form-submitted',
                args: [{ 
                  formData: Object.fromEntries(new FormData(event.target.closest('form'))),
                  action: 'submit-intake-form',
                  isValid: event.target.closest('form').checkValidity()
                }]
              })"
            >Submit Project Request</button>
          </div>
        </form>
        
        <script>
          function validateIntakeForm(form) {
            const submitButton = form.querySelector('#intake-submit-button');
            const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
            
            let allValid = true;
            requiredFields.forEach(field => {
              if (!field.value.trim()) {
                allValid = false;
              }
            });
            
            if (allValid) {
              submitButton.style.backgroundColor = '#10b981';
              submitButton.classList.add('form-valid');
              window.__STORYBOOK_ADDONS_CHANNEL__ && window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
                name: 'intake-validation-passed',
                args: [{ allFieldsValid: true, buttonState: 'green', formType: 'intake' }]
              });
            } else {
              submitButton.style.backgroundColor = '';
              submitButton.classList.remove('form-valid');
            }
          }
        </script>
        
        <style>
          .btn.form-valid {
            background-color: #10b981 !important;
            transition: background-color 0.3s ease;
          }
          
          .btn.btn-primary {
            transition: background-color 0.3s ease;
          }
        </style>
      </div>
    </div>
  `;
};

export const Full: Story = {
  render: createIntakeForm
};

export const WithoutHeader: Story = {
  args: {
    showHeader: false
  },
  render: createIntakeForm
};

export const BasicForm: Story = {
  args: {
    formStyle: 'basic'
  },
  render: createIntakeForm
};

export const MinimalForm: Story = {
  args: {
    formStyle: 'minimal',
    showHeader: false
  },
  render: createIntakeForm
};
