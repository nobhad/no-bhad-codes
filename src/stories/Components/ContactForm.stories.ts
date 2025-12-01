import type { Meta, StoryObj } from '@storybook/html';

const meta: Meta = {
  title: 'Components/Contact Form',
  parameters: {
    layout: 'centered'
  },
  argTypes: {
    showProjectDetails: {
      control: 'boolean',
      description: 'Show project details section'
    },
    showCompanyInfo: {
      control: 'boolean',
      description: 'Show company information'
    }
  },
  args: {
    showProjectDetails: false,
    showCompanyInfo: true
  }
};

export default meta;
type Story = StoryObj;

const createContactForm = (args: any) => {
  const { showProjectDetails, showCompanyInfo } = args;

  return `
    <div style="max-width: 600px; padding: 2rem;">
      <form class="contact-form" method="post" name="contact-form" data-netlify="true" netlify-honeypot="bot-field" oninput="validateForm(this)">
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
        
        ${
  showProjectDetails
    ? `
          <div class="project-details" id="project-details">
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
        `
    : ''
}
        
        <textarea autocomplete="off" class="form-textarea" data-name="Project Description" id="project-description" maxlength="1000" name="Project-Description" placeholder="Brief description of your project (What's the main goal? Who's your target audience?)" required=""></textarea>
        
        ${
  showCompanyInfo
    ? `
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
        `
    : ''
}
        
        <div class="form-actions">
          <input 
            class="form-button" 
            id="submit-button"
            data-wait="Sending..." 
            type="submit" 
            value="Let's Talk"
            onclick="event.preventDefault(); window.__STORYBOOK_ADDONS_CHANNEL__.emit('storybook/actions/action-event', {
              name: 'contact-form-submitted',
              args: [{ 
                formData: Object.fromEntries(new FormData(event.target.closest('form'))),
                action: 'submit-contact-form',
                isValid: event.target.closest('form').checkValidity()
              }]
            })"
          >
          <p class="form-note">Most inquiries will need to fill out the <a href="/intake-form" class="link">Intake Form</a></p>
        </div>
      </form>
      
      <script>
        function validateForm(form) {
          const submitButton = form.querySelector('#submit-button');
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
              name: 'form-validation-passed',
              args: [{ allFieldsValid: true, buttonState: 'green' }]
            });
          } else {
            submitButton.style.backgroundColor = '';
            submitButton.classList.remove('form-valid');
          }
        }
      </script>
      
      <style>
        .form-button.form-valid {
          background-color: #10b981 !important;
          transition: background-color 0.3s ease;
        }
        
        .form-button {
          transition: background-color 0.3s ease;
        }
      </style>
    </div>
  `;
};

export const Basic: Story = {
  render: createContactForm
};

export const WithProjectDetails: Story = {
  args: {
    showProjectDetails: true
  },
  render: createContactForm
};

export const WithoutCompanyInfo: Story = {
  args: {
    showCompanyInfo: false
  },
  render: createContactForm
};

export const FullForm: Story = {
  args: {
    showProjectDetails: true,
    showCompanyInfo: true
  },
  render: createContactForm
};
